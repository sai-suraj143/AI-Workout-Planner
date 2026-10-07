import { Types } from 'mongoose';
import { WorkoutPlan, IWorkoutPlan } from '../models/WorkoutPlan';
import { WorkoutLog } from '../models/WorkoutLog';
import { ProfileService } from './profileService';
import { validateAiWorkoutPlan } from '../validators/workoutPlanValidators';
import { normalizeWorkoutPlan, NormalizedWorkoutPlan } from './planNormalizer';
import {
  ADAPTIVE_PROMPT_VERSION,
  buildAdaptiveWorkoutPlanPrompt,
  buildWorkoutPlanPrompt,
  isPromptProfile,
  PROMPT_VERSION,
  PromptProfile,
} from './prompts/workoutPlan.prompt';
import {
  GeminiJsonResult,
  GeminiServiceError,
  geminiService,
} from './gemini.service';
import {
  buildAdaptivePlanContext,
  evaluateAdaptationDecision,
  type AdaptivePlanContext,
  type AdaptationOutcome,
} from './adaptation';

/**
 * Workout plan business logic. Controllers stay thin; the prompt and the Gemini
 * wire protocol stay in their own modules; nothing here is reachable without
 * `requireAuth`.
 *
 * Pipeline: profile → prompt → Gemini → JSON parse → Zod → normalise → MongoDB,
 * with exactly one controlled retry when the model's output is structurally
 * wrong. Configuration, credential, rate-limit, timeout and database failures
 * are never retried.
 */

export class PlanServiceError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, message: string, code: string) {
    super(message);
    this.name = 'PlanServiceError';
    this.status = status;
    this.code = code;
  }
}

export type PlanGenerator = (prompt: string) => Promise<GeminiJsonResult>;

/** One retry after the first failure, never more (Phase 2 §17). */
const MAX_AI_ATTEMPTS = 2;

/**
 * Per-user in-flight guard so a double-clicked Generate button cannot start two
 * expensive generations. Process-local on purpose — no Redis for this phase.
 */
const inFlightGenerations = new Set<string>();

const GEMINI_STATUS: Record<string, number> = {
  not_configured: 503,
  credentials: 503,
  timeout: 504,
  rate_limited: 429,
  blocked: 502,
  unavailable: 502,
  malformed_json: 502,
};

const toPlanServiceError = (error: unknown): PlanServiceError => {
  if (error instanceof PlanServiceError) return error;
  if (error instanceof GeminiServiceError) {
    return new PlanServiceError(
      GEMINI_STATUS[error.kind] ?? 502,
      error.message,
      `ai_${error.kind}`,
    );
  }
  return new PlanServiceError(500, 'Something went wrong while generating your plan.', 'generation_failed');
};

export class WorkoutPlanService {
  constructor(private readonly generate: PlanGenerator = (prompt) => geminiService.generateJson(prompt)) {}

  private getAdaptiveGenerationKey(userId: string): string {
    const now = new Date();
    const iso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const day = iso.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const startOfWeek = new Date(iso);
    startOfWeek.setUTCDate(iso.getUTCDate() + mondayOffset);
    return `${userId}:${startOfWeek.toISOString().slice(0, 10)}:${ADAPTIVE_PROMPT_VERSION}`;
  }

  /** Full Phase 2 flow for the authenticated user. */
  async generateForUser(userId: string): Promise<IWorkoutPlan> {
    if (inFlightGenerations.has(userId)) {
      throw new PlanServiceError(
        409,
        'A plan is already being generated. Please wait for it to finish.',
        'generation_in_progress',
      );
    }
    inFlightGenerations.add(userId);
    const startedAt = Date.now();

    try {
      const profile = await ProfileService.getProfileByUserId(userId);
      if (!profile) {
        throw new PlanServiceError(
          400,
          'Complete your fitness profile before generating a workout plan.',
          'profile_missing',
        );
      }

      const promptProfile: PromptProfile = {
        goal: profile.goal,
        experienceLevel: profile.experienceLevel,
        trainingLocation: profile.trainingLocation,
        equipment: [...profile.equipment],
        availableDays: [...profile.availableDays],
        sessionDuration: profile.sessionDuration,
        preferredActivities: [...profile.preferredActivities],
        excludedExercises: [...profile.excludedExercises],
        sport: profile.sport,
        sportName: profile.sportName,
        additionalNotes: profile.additionalNotes,
      };

      if (!isPromptProfile(promptProfile) || promptProfile.availableDays.length === 0) {
        throw new PlanServiceError(
          400,
          'Your fitness profile is incomplete. Review it and try again.',
          'profile_incomplete',
        );
      }

      const { normalized, model } = await this.generateValidatedPlan(promptProfile);

      return this.save(userId, normalized, model, Date.now() - startedAt);
    } catch (error) {
      throw toPlanServiceError(error);
    } finally {
      inFlightGenerations.delete(userId);
    }
  }

  async generateAdaptiveForUser(userId: string): Promise<{ plan: IWorkoutPlan; adaptation: AdaptationOutcome }> {
    const generationGuard = `adaptive:${userId}`;
    if (inFlightGenerations.has(generationGuard)) {
      throw new PlanServiceError(
        409,
        'An adaptive plan is already being generated. Please wait for it to finish.',
        'generation_in_progress',
      );
    }
    inFlightGenerations.add(generationGuard);
    const startedAt = Date.now();

    try {
      const profile = await ProfileService.getProfileByUserId(userId);
      if (!profile) {
        throw new PlanServiceError(
          400,
          'Complete your fitness profile before generating an adaptive workout plan.',
          'profile_missing',
        );
      }

      const promptProfile: PromptProfile = {
        goal: profile.goal,
        experienceLevel: profile.experienceLevel,
        trainingLocation: profile.trainingLocation,
        equipment: [...profile.equipment],
        availableDays: [...profile.availableDays],
        sessionDuration: profile.sessionDuration,
        preferredActivities: [...profile.preferredActivities],
        excludedExercises: [...profile.excludedExercises],
        sport: profile.sport,
        sportName: profile.sportName,
        additionalNotes: profile.additionalNotes,
      };

      const recentLogs = await WorkoutLog.find({ userId: new Types.ObjectId(userId) })
        .sort({ workoutDate: -1 })
        .lean()
        .exec();

      const normalizedLogs = recentLogs.map((log) => ({
        userId: String(log.userId),
        workoutDate: log.workoutDate,
        status: String(log.status) as 'in_progress' | 'completed' | 'abandoned',
        plannedDuration: Number(log.plannedDuration ?? 0),
        actualDuration: typeof log.actualDuration === 'number' ? log.actualDuration : 0,
        dayName: log.dayName,
        focus: log.focus,
        exercises: (log.exercises ?? []).map((exercise) => ({
          exerciseName: exercise.exerciseName,
          completed: exercise.completed,
          skipped: exercise.skipped,
          actualDuration: exercise.actualDuration,
          plannedDuration: exercise.plannedDuration,
        })),
      }));

      const adaptation = evaluateAdaptationDecision(normalizedLogs, {
        goal: profile.goal,
        experienceLevel: profile.experienceLevel,
        trainingLocation: profile.trainingLocation,
        equipment: [...profile.equipment],
        availableDays: [...profile.availableDays],
        sessionDuration: profile.sessionDuration,
        preferredActivities: [...profile.preferredActivities],
        excludedExercises: [...profile.excludedExercises],
        sport: profile.sport,
        sportName: profile.sportName,
        additionalNotes: profile.additionalNotes,
      });

      const adaptiveContext = buildAdaptivePlanContext(
        {
          goal: profile.goal,
          experienceLevel: profile.experienceLevel,
          trainingLocation: profile.trainingLocation,
          equipment: [...profile.equipment],
          availableDays: [...profile.availableDays],
          sessionDuration: profile.sessionDuration,
          preferredActivities: [...profile.preferredActivities],
          excludedExercises: [...profile.excludedExercises],
          sport: profile.sport,
          sportName: profile.sportName,
          additionalNotes: profile.additionalNotes,
        },
        normalizedLogs,
        adaptation,
      );

      const generationKey = this.getAdaptiveGenerationKey(userId);
      const existingAdaptivePlan = await WorkoutPlan.findOne({
        userId: new Types.ObjectId(userId),
        'aiMetadata.generationType': 'adaptive_plan',
        'aiMetadata.generationKey': generationKey,
      }).lean().exec();

      if (existingAdaptivePlan) {
        throw new PlanServiceError(
          409,
          'An adaptive plan for this week already exists. Use the newest generated plan or wait for the next adaptation window.',
          'duplicate_generation',
        );
      }

      const { normalized, model } = await this.generateValidatedAdaptivePlan(promptProfile, adaptiveContext, adaptation);
      const plan = await this.save(userId, normalized, model, Date.now() - startedAt, {
        generationType: 'adaptive_plan',
        promptVersion: ADAPTIVE_PROMPT_VERSION,
        generationKey,
      });

      return { plan, adaptation };
    } catch (error) {
      throw toPlanServiceError(error);
    } finally {
      inFlightGenerations.delete(generationGuard);
    }
  }

  /** Gemini → parse → Zod → normalise, with one controlled retry. */
  private async generateValidatedPlan(
    promptProfile: PromptProfile,
  ): Promise<{ normalized: NormalizedWorkoutPlan; model: string }> {
    let validationIssues: string[] | undefined;
    let normalized: NormalizedWorkoutPlan | undefined;
    let model = '';

    for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt += 1) {
      const prompt = buildWorkoutPlanPrompt(promptProfile, { validationIssues });

      let result: GeminiJsonResult;
      try {
        result = await this.generate(prompt);
      } catch (error) {
        if (error instanceof GeminiServiceError && error.kind === 'malformed_json') {
          console.warn(`[plans] attempt ${attempt}/${MAX_AI_ATTEMPTS}: reply was not parseable JSON`);
          validationIssues = [
            'The reply was not a single valid JSON object. Return only the JSON object — no markdown fences and no surrounding text.',
          ];
          continue;
        }
        // Configuration, credentials, rate limits, timeouts: fail fast, no retry.
        throw error;
      }

      model = result.model;
      const validated = validateAiWorkoutPlan(result.data);
      if (validated.ok) {
        normalized = normalizeWorkoutPlan(validated.value, {
          goal: promptProfile.goal,
          experienceLevel: promptProfile.experienceLevel,
        });
        break;
      }

      console.warn(
        `[plans] attempt ${attempt}/${MAX_AI_ATTEMPTS} failed validation: ${validated.issues.join(' | ')}`,
      );
      validationIssues = validated.issues;
    }

    if (!normalized) {
      throw new PlanServiceError(
        502,
        'The generated plan did not match the expected format. Please try again.',
        'ai_invalid',
      );
    }

    return { normalized, model };
  }

  private async generateValidatedAdaptivePlan(
    promptProfile: PromptProfile,
    adaptiveContext: AdaptivePlanContext,
    adaptation: AdaptationOutcome,
  ): Promise<{ normalized: NormalizedWorkoutPlan; model: string }> {
    let validationIssues: string[] | undefined;
    let normalized: NormalizedWorkoutPlan | undefined;
    let model = '';

    for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt += 1) {
      const prompt = buildAdaptiveWorkoutPlanPrompt(promptProfile, {
        decision: adaptation.decision,
        adherence: adaptation.adherence,
        trend: adaptation.trend,
        reasons: adaptation.reasons,
        performance: adaptiveContext.performance,
      });

      let result: GeminiJsonResult;
      try {
        result = await this.generate(prompt);
      } catch (error) {
        if (error instanceof GeminiServiceError && error.kind === 'malformed_json') {
          console.warn(`[plans] adaptive attempt ${attempt}/${MAX_AI_ATTEMPTS}: reply was not parseable JSON`);
          validationIssues = [
            'The reply was not a single valid JSON object. Return only the JSON object — no markdown fences and no surrounding text.',
          ];
          continue;
        }
        throw error;
      }

      model = result.model;
      const validated = validateAiWorkoutPlan(result.data);
      if (validated.ok) {
        normalized = normalizeWorkoutPlan(validated.value, {
          goal: promptProfile.goal,
          experienceLevel: promptProfile.experienceLevel,
        });
        break;
      }

      console.warn(
        `[plans] adaptive attempt ${attempt}/${MAX_AI_ATTEMPTS} failed validation: ${validated.issues.join(' | ')}`,
      );
      validationIssues = validated.issues;
    }

    if (!normalized) {
      throw new PlanServiceError(
        502,
        'The generated adaptive plan did not match the expected format. Please try again.',
        'ai_invalid',
      );
    }

    return { normalized, model };
  }

  /** Zod output never reaches Mongo before this point. */
  private async save(
    userId: string,
    plan: NormalizedWorkoutPlan,
    model: string,
    generationDurationMs: number,
    metadata: {
      generationType?: 'manual_plan' | 'adaptive_plan';
      promptVersion?: string;
      generationKey?: string;
    } = {},
  ): Promise<IWorkoutPlan> {
    try {
      const document = new WorkoutPlan({
        ...plan,
        userId: new Types.ObjectId(userId),
        status: 'generated',
        aiMetadata: {
          model,
          promptVersion: metadata.promptVersion ?? PROMPT_VERSION,
          generatedAt: new Date(),
          generationDurationMs,
          generationType: metadata.generationType ?? 'manual_plan',
          generationKey: metadata.generationKey,
        },
      });
      return await document.save();
    } catch (error) {
      console.error(
        '[plans] failed to persist plan:',
        error instanceof Error ? `${error.name}: ${error.message}` : typeof error,
      );
      throw new PlanServiceError(500, 'Your plan could not be saved. Please try again.', 'save_failed');
    }
  }

  /** Only the authenticated user's plans, newest first. */
  async listForUser(userId: string): Promise<IWorkoutPlan[]> {
    return WorkoutPlan.find({ userId }).sort({ createdAt: -1 }).select('-__v');
  }

  /** Ownership-scoped read; malformed ids return null instead of a CastError 500. */
  async getForUser(userId: string, planId: string): Promise<IWorkoutPlan | null> {
    if (!Types.ObjectId.isValid(planId)) return null;
    return WorkoutPlan.findOne({ _id: planId, userId }).select('-__v');
  }

  /** Ownership-scoped delete. Returns null when it does not exist or not yours. */
  async deleteForUser(userId: string, planId: string): Promise<IWorkoutPlan | null> {
    if (!Types.ObjectId.isValid(planId)) return null;
    return WorkoutPlan.findOneAndDelete({ _id: planId, userId });
  }
}

export const workoutPlanService = new WorkoutPlanService();
