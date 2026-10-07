import {
  GoogleGenerativeAI,
  GoogleGenerativeAIAbortError,
  GoogleGenerativeAIError,
  GoogleGenerativeAIFetchError,
  GoogleGenerativeAIRequestInputError,
  GoogleGenerativeAIResponseError,
} from '@google/generative-ai';

/**
 * Thin Gemini wrapper: prompt in → parsed JSON out.
 *
 * It knows nothing about the workout-plan schema (that is Zod's job in the
 * workout-plan service) and it never puts the API key anywhere but the request
 * header the SDK sets itself. Every failure is translated into a classified,
 * client-safe error; raw model output is only ever logged, truncated, server-side.
 */

export type GeminiFailureKind =
  | 'not_configured'
  | 'timeout'
  | 'rate_limited'
  | 'credentials'
  | 'blocked'
  | 'unavailable'
  | 'malformed_json';

const CLIENT_MESSAGES: Record<GeminiFailureKind, string> = {
  not_configured: 'AI plan generation is not configured on this server. Set GEMINI_API_KEY and restart it.',
  timeout: 'The AI service timed out while creating your plan. Please try again.',
  rate_limited: 'The AI service is busy right now. Please wait a minute and try again.',
  credentials: 'The AI service rejected this server\'s credentials. Check GEMINI_API_KEY on the server.',
  blocked: 'The AI service could not produce a safe response for this profile. Please try again.',
  unavailable: 'The AI service is unavailable right now. Please try again later.',
  malformed_json: 'The AI service returned a response we could not read. Please try again.',
};

export class GeminiServiceError extends Error {
  readonly kind: GeminiFailureKind;
  readonly httpStatus?: number;

  constructor(kind: GeminiFailureKind, detail?: string, httpStatus?: number) {
    super(detail ? `${CLIENT_MESSAGES[kind]} (${detail})` : CLIENT_MESSAGES[kind]);
    this.name = 'GeminiServiceError';
    this.kind = kind;
    this.httpStatus = httpStatus;
  }
}

/** Configuration problem — must never be retried. */
export class GeminiConfigError extends GeminiServiceError {
  constructor(detail?: string) {
    super('not_configured', detail);
    this.name = 'GeminiConfigError';
  }
}

export interface GeminiJsonResult {
  /** Parsed JSON of unknown shape — Zod owns validation. */
  data: unknown;
  /** Model that actually answered (recorded in aiMetadata). */
  model: string;
  durationMs: number;
}

interface GeminiServiceOptions {
  /** Testing hook. Falls back to GEMINI_API_KEY at call time. */
  apiKey?: string;
  /** Testing hook. Falls back to GEMINI_MODEL at call time. */
  model?: string;
  timeoutMs?: number;
}

const DEFAULT_MODEL = 'gemini-1.5-flash';
const DEFAULT_TIMEOUT_MS = 45_000;
/** Room for a full 7-day plan with per-exercise instructions. */
const MAX_OUTPUT_TOKENS = 8192;

/**
 * Pull the JSON object out of a model reply that may be wrapped in markdown
 * fences or preceded/followed by prose. Uses a string-aware brace scan so a `}`
 * inside an instruction cannot truncate the object.
 */
export const extractJsonObject = (text: string): unknown => {
  let candidate = text.trim();

  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidate = fenced[1].trim();

  const start = candidate.indexOf('{');
  if (start === -1) {
    throw new GeminiServiceError('malformed_json');
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < candidate.length; i += 1) {
    const char = candidate[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        const json = candidate.slice(start, i + 1);
        try {
          return JSON.parse(json);
        } catch {
          throw new GeminiServiceError('malformed_json');
        }
      }
    }
  }

  throw new GeminiServiceError('malformed_json');
};

export class GeminiService {
  private readonly apiKeyOverride?: string;
  private readonly modelOverride?: string;
  private readonly timeoutMs: number;

  constructor(options: GeminiServiceOptions = {}) {
    this.apiKeyOverride = options.apiKey;
    this.modelOverride = options.model;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private resolveConfig(): { apiKey: string; model: string } {
    // Read at call time so a restarted server picks up .env changes without a
    // rebuild, and so a missing key fails this request only — never the app.
    const apiKey = (this.apiKeyOverride ?? process.env.GEMINI_API_KEY ?? '').trim();
    if (!apiKey) {
      throw new GeminiConfigError('missing GEMINI_API_KEY');
    }

    const model = (this.modelOverride ?? process.env.GEMINI_MODEL ?? '').trim() || DEFAULT_MODEL;
    return { apiKey, model };
  }

  /**
   * Ask Gemini for one JSON document.
   *
   * @throws {GeminiConfigError} missing/invalid configuration (never retried)
   * @throws {GeminiServiceError} classified, client-safe failure
   */
  async generateJson(prompt: string): Promise<GeminiJsonResult> {
    const { apiKey, model } = this.resolveConfig();
    const startedAt = Date.now();

    const client = new GoogleGenerativeAI(apiKey);
    const generativeModel = client.getGenerativeModel({ model });

    let responseText: string;
    try {
      const result = await generativeModel.generateContent(
        {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.5,
            topP: 0.9,
            topK: 40,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            responseMimeType: 'application/json',
          },
        },
        { timeout: this.timeoutMs },
      );

      const response = await result.response;

      if (response.promptFeedback?.blockReason) {
        // Log the reason only — never the prompt contents or a key.
        console.error(`[gemini] request blocked: ${response.promptFeedback.blockReason}`);
        throw new GeminiServiceError('blocked');
      }

      if (!response.candidates || response.candidates.length === 0) {
        console.error('[gemini] response contained no candidates');
        throw new GeminiServiceError('blocked');
      }

      responseText = response.text();
      if (!responseText.trim()) {
        throw new GeminiServiceError('malformed_json');
      }
    } catch (error) {
      throw this.classify(error);
    }

    try {
      const data = extractJsonObject(responseText);
      return { data, model, durationMs: Date.now() - startedAt };
    } catch (error) {
      // Diagnostic only: enough of the reply to debug, truncated, never returned.
      console.error(
        `[gemini] unparseable reply (model=${model}, chars=${responseText.length}): ` +
          `${responseText.slice(0, 400)}`,
      );
      if (error instanceof GeminiServiceError) throw error;
      throw new GeminiServiceError('malformed_json');
    }
  }

  private classify(error: unknown): GeminiServiceError {
    if (error instanceof GeminiServiceError) {
      return error;
    }

    const mapped = this.mapError(error);
    // Server-side diagnostic only: kind + HTTP status + a truncated SDK message.
    // The API key travels in a header the SDK strips from error output, and the
    // client only ever receives `mapped.message`.
    console.error(
      `[gemini] request failed: kind=${mapped.kind} status=${mapped.httpStatus ?? '-'} detail=${
        error instanceof Error ? error.message.slice(0, 300) : typeof error
      }`,
    );
    return mapped;
  }

  private mapError(error: unknown): GeminiServiceError {
    if (error instanceof GeminiServiceError) {
      return error;
    }

    if (error instanceof GoogleGenerativeAIAbortError) {
      return new GeminiServiceError('timeout');
    }

    if (error instanceof GoogleGenerativeAIFetchError) {
      const status = error.status;
      if (status === 429) return new GeminiServiceError('rate_limited', undefined, status);
      if (status === 401 || status === 403) return new GeminiServiceError('credentials', undefined, status);
      if (status === 404) return new GeminiServiceError('not_configured', 'unknown model name', status);
      if (status && status >= 500) return new GeminiServiceError('unavailable', undefined, status);
      return new GeminiServiceError('unavailable', status ? `HTTP ${status}` : undefined, status);
    }

    if (error instanceof GoogleGenerativeAIResponseError) {
      return new GeminiServiceError('blocked');
    }

    if (error instanceof GoogleGenerativeAIRequestInputError) {
      return new GeminiServiceError('unavailable', 'request rejected');
    }

    const message = error instanceof Error ? error.message : '';
    if (/timed? ?out|timeout|aborted/i.test(message)) {
      return new GeminiServiceError('timeout');
    }
    if (/fetch failed|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|network/i.test(message)) {
      return new GeminiServiceError('unavailable', 'network error');
    }
    if (error instanceof GoogleGenerativeAIError) {
      return new GeminiServiceError('unavailable');
    }

    return new GeminiServiceError('unavailable');
  }
}

export const geminiService = new GeminiService();
