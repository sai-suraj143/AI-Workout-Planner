import { Types } from 'mongoose';
import { WorkoutPlan, IWorkoutPlan } from '../models/WorkoutPlan';
import { WorkoutLog } from '../models/WorkoutLog';
import { ProfileService } from './profileService';
import {
  validateAiWorkoutPlan,
  exerciseReplacementResultSchema,
  dayRegenerationResultSchema,
  exerciseSubstitutionRequestSchema,
  dayRegenerationRequestSchema,
  type ExerciseSubstitutionRequestInput,
  type DayRegenerationRequestInput,
} from '../validators/workoutPlanValidators';
import { normalizeWorkoutPlan, NormalizedWorkoutPlan } from './planNormalizer';
import {
  ADAPTIVE_PROMPT_VERSION,
  buildAdaptiveWorkoutPlanPrompt,
  buildDayRegenerationPrompt,
  buildExerciseSubstitutionPrompt,
  buildWorkoutPlanPrompt,
  DAY_REGENERATION_PROMPT_VERSION,
  EXERCISE_SUBSTITUTION_PROMPT_VERSION,
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
const inFlightExerciseSubstitutions = new Set<string>();
const inFlightDayRegenerations = new Set<string>();

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

  private normalizeExerciseName(value: string): string {
    return value.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  private async runQuery<T>(queryLike: unknown): Promise<T> {
    if (queryLike && typeof queryLike === 'object' && 'exec' in queryLike && typeof (queryLike as { exec: unknown }).exec === 'function') {
      return await (queryLike as { exec: () => Promise<T> }).exec();
    }
    if (queryLike && typeof queryLike === 'object' && 'then' in queryLike && typeof (queryLike as { then: unknown }).then === 'function') {
      return await Promise.resolve(queryLike as Promise<T>);
    }
    return queryLike as T;
  }

  private async getOwnedPlan(userId: string, planId: string): Promise<IWorkoutPlan | null> {
    if (!Types.ObjectId.isValid(planId)) return null;
    const query = WorkoutPlan.findOne({ _id: new Types.ObjectId(planId), userId: new Types.ObjectId(userId) });
    if (query && typeof query === 'object' && 'lean' in query && typeof (query as { lean: unknown }).lean === 'function') {
      const leanQuery = (query as { lean: () => { exec?: () => Promise<IWorkoutPlan | null> } }).lean();
      if (leanQuery && typeof leanQuery.exec === 'function') {
        return await leanQuery.exec();
      }
      return await Promise.resolve(leanQuery as IWorkoutPlan | null);
    }
    return await this.runQuery<IWorkoutPlan | null>(query);
  }

  private validateTargetDay(plan: IWorkoutPlan, dayIndex: number, exerciseIndex?: number): { day: IWorkoutPlan['days'][number]; exercise?: IWorkoutPlan['days'][number]['exercises'][number] } {
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= plan.days.length) {
      throw new PlanServiceError(400, 'Invalid workout day index.', 'invalid_day');
    }

    const day = plan.days[dayIndex];
    if (!day) {
      throw new PlanServiceError(400, 'Invalid workout day index.', 'invalid_day');
    }

    if (exerciseIndex !== undefined) {
      if (!Number.isInteger(exerciseIndex) || exerciseIndex < 0 || exerciseIndex >= day.exercises.length) {
        throw new PlanServiceError(400, 'Invalid exercise index.', 'invalid_exercise');
      }

      const exercise = day.exercises[exerciseIndex];
      if (!exercise) {
        throw new PlanServiceError(400, 'Invalid exercise index.', 'invalid_exercise');
      }

      return { day, exercise };
    }

    return { day };
  }

  private async ensureDayIsModifiable(userId: string, planId: string, dayIndex: number, type: 'exercise' | 'day'): Promise<void> {
    const query = WorkoutLog.find({
      userId: new Types.ObjectId(userId),
      planId: new Types.ObjectId(planId),
      dayIndex,
    });
    const existingLogs = query && typeof query === 'object' && 'lean' in query && typeof (query as { lean: unknown }).lean === 'function'
      ? await (async () => {
          const leanQuery = (query as { lean: () => { exec?: () => Promise<Array<{ status: string }>> } }).lean();
          if (leanQuery && typeof leanQuery.exec === 'function') {
            return await leanQuery.exec();
          }
          return await Promise.resolve(leanQuery as Array<{ status: string }>);
        })()
      : await this.runQuery<Array<{ status: string }>>(query as unknown);

    const active = existingLogs.some((log) => log.status === 'in_progress');
    if (active) {
      throw new PlanServiceError(409, 'This workout day is currently in progress and cannot be modified.', 'active_workout');
    }

    const completed = existingLogs.some((log) => log.status === 'completed' || log.status === 'abandoned');
    if (completed) {
      throw new PlanServiceError(409, 'This workout day has already been completed and cannot be modified.', 'completed_day');
    }

    if (type === 'exercise' && existingLogs.some((log) => log.status === 'completed')) {
      throw new PlanServiceError(409, 'This workout day has already been completed and cannot be modified.', 'completed_day');
    }
  }

  private enforceExerciseConstraints(
    profile: Awaited<ReturnType<typeof ProfileService.getProfileByUserId>>,
    day: IWorkoutPlan['days'][number],
    originalExercise: IWorkoutPlan['days'][number]['exercises'][number],
    replacement: Record<string, unknown>,
  ): void {
    if (!profile) {
      throw new PlanServiceError(400, 'Complete your fitness profile before editing a workout plan.', 'profile_missing');
    }

    const excluded = new Set(profile.excludedExercises.map((value) => this.normalizeExerciseName(value)));
    const normalizedReplacementName = typeof replacement.name === 'string' ? this.normalizeExerciseName(replacement.name) : '';
    if (normalizedReplacementName && excluded.has(normalizedReplacementName)) {
      throw new PlanServiceError(400, 'The suggested replacement is excluded by your profile.', 'excluded_exercise');
    }

    const allowedEquipment = new Set(profile.equipment.map((value) => value.toLowerCase().trim()));
    const equipment = typeof replacement.equipment === 'string' ? replacement.equipment.toLowerCase().trim() : '';
    if (equipment && !allowedEquipment.has(equipment) && !['bodyweight', 'none'].includes(equipment)) {
      throw new PlanServiceError(400, 'The suggested replacement uses equipment that is not available in your profile.', 'equipment_unavailable');
    }

    if (profile.trainingLocation === 'home' && ['barbell', 'dumbbells', 'kettlebells', 'pull_up_bar'].includes(equipment)) {
      throw new PlanServiceError(400, 'This replacement is not compatible with a home-based training plan.', 'training_location_mismatch');
    }

    const sameDayNames = day.exercises
      .filter((exercise, index) => exercise.name !== originalExercise.name)
      .map((exercise) => this.normalizeExerciseName(exercise.name));
    if (sameDayNames.includes(normalizedReplacementName) && normalizedReplacementName) {
      throw new PlanServiceError(400, 'The replacement would duplicate an exercise already on this day.', 'duplicate_exercise');
    }

    const goal = profile.goal;
    const category = String(replacement.category ?? '').toLowerCase();
    const allowedByGoal: Record<string, string[]> = {
      general_fitness: ['strength', 'cardio', 'flexibility', 'core', 'balance'],
      strength: ['strength'],
      endurance: ['cardio', 'strength'],
      weight_management: ['strength', 'cardio', 'core'],
      sports_performance: ['strength', 'cardio', 'balance'],
      mobility: ['flexibility', 'balance', 'core'],
    };

    if (category && goal in allowedByGoal && !allowedByGoal[goal].includes(category)) {
      throw new PlanServiceError(400, 'The replacement is not aligned with your current training goal.', 'goal_mismatch');
    }
  }

  async substituteExerciseForUser(
    userId: string,
    planId: string,
    dayIndex: number,
    exerciseIndex: number,
    input: ExerciseSubstitutionRequestInput,
  ): Promise<{ day: IWorkoutPlan['days'][number]; exercise: IWorkoutPlan['days'][number]['exercises'][number]; plan: IWorkoutPlan }> {
    const validBody = exerciseSubstitutionRequestSchema.parse(input);
    const guardKey = `exercise:${planId}:${dayIndex}:${exerciseIndex}`;
    if (inFlightExerciseSubstitutions.has(guardKey)) {
      throw new PlanServiceError(409, 'A replacement is already being generated for this exercise. Please wait.', 'duplicate_request');
    }
    inFlightExerciseSubstitutions.add(guardKey);

    try {
      const plan = await this.getOwnedPlan(userId, planId);
      if (!plan) {
        throw new PlanServiceError(404, 'Workout plan not found', 'plan_not_found');
      }

      const { day, exercise } = this.validateTargetDay(plan, dayIndex, exerciseIndex);
      if (!exercise) {
        throw new PlanServiceError(400, 'Invalid exercise index.', 'invalid_exercise');
      }
      await this.ensureDayIsModifiable(userId, planId, dayIndex, 'exercise');

      const profile = await ProfileService.getProfileByUserId(userId);
      if (!profile) {
        throw new PlanServiceError(400, 'Complete your fitness profile before editing a workout plan.', 'profile_missing');
      }

      const prompt = buildExerciseSubstitutionPrompt(
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
        { dayIndex: day.dayIndex, dayName: day.dayName, focus: day.focus },
        {
          name: exercise.name,
          category: exercise.category,
          muscleGroup: exercise.muscleGroup,
          equipment: exercise.equipment,
          sets: exercise.sets,
          reps: exercise.reps,
          durationSeconds: exercise.durationSeconds,
          instructions: exercise.instructions,
          alternatives: exercise.alternatives,
        },
        validBody.reason,
        validBody.notes,
      );

      const result = await this.generate(prompt);
      const parsed = exerciseReplacementResultSchema.safeParse(result.data);
      if (!parsed.success) {
        throw new PlanServiceError(502, 'The replacement exercise did not match the expected format.', 'ai_invalid');
      }

      const replacement = {
        ...parsed.data.exercise,
        restSeconds: parsed.data.exercise.restSeconds ?? 60,
        alternatives: parsed.data.exercise.alternatives ?? [],
      };

      this.enforceExerciseConstraints(profile, day, exercise, replacement as Record<string, unknown>);

      const updateQuery = WorkoutPlan.findOneAndUpdate(
        { _id: new Types.ObjectId(planId), userId: new Types.ObjectId(userId) },
        {
          $set: {
            [`days.${dayIndex}.exercises.${exerciseIndex}`]: replacement,
            'aiMetadata.model': result.model,
            'aiMetadata.promptVersion': EXERCISE_SUBSTITUTION_PROMPT_VERSION,
            'aiMetadata.generatedAt': new Date(),
            'aiMetadata.generationDurationMs': result.durationMs,
            'aiMetadata.generationType': 'exercise_substitution',
          },
        },
        { new: true },
      );
      const updatedPlan = await this.runQuery<IWorkoutPlan | null>(updateQuery);

      if (!updatedPlan) {
        throw new PlanServiceError(409, 'This workout plan changed while processing your request. Please reload and try again.', 'duplicate_request');
      }

      return {
        day: updatedPlan.days[dayIndex],
        exercise: updatedPlan.days[dayIndex].exercises[exerciseIndex],
        plan: updatedPlan,
      };
    } finally {
      inFlightExerciseSubstitutions.delete(guardKey);
    }
  }

  async regenerateDayForUser(
    userId: string,
    planId: string,
    dayIndex: number,
    input: DayRegenerationRequestInput,
  ): Promise<{ day: IWorkoutPlan['days'][number]; plan: IWorkoutPlan }> {
    const validBody = dayRegenerationRequestSchema.parse(input);
    const guardKey = `day:${planId}:${dayIndex}`;
    if (inFlightDayRegenerations.has(guardKey)) {
      throw new PlanServiceError(409, 'This day is already being regenerated. Please wait.', 'duplicate_request');
    }
    inFlightDayRegenerations.add(guardKey);

    try {
      const plan = await this.getOwnedPlan(userId, planId);
      if (!plan) {
        throw new PlanServiceError(404, 'Workout plan not found', 'plan_not_found');
      }

      const { day } = this.validateTargetDay(plan, dayIndex);
      await this.ensureDayIsModifiable(userId, planId, dayIndex, 'day');

      const profile = await ProfileService.getProfileByUserId(userId);
      if (!profile) {
        throw new PlanServiceError(400, 'Complete your fitness profile before editing a workout plan.', 'profile_missing');
      }

      const prompt = buildDayRegenerationPrompt(
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
        {
          dayIndex: day.dayIndex,
          dayName: day.dayName,
          focus: day.focus,
          estimatedDuration: day.estimatedDuration,
          restDay: day.restDay,
          exercises: day.exercises.map((exercise) => ({ ...exercise })),
        },
        {
          title: plan.title,
          summary: plan.summary,
          goal: plan.goal,
          experienceLevel: plan.experienceLevel,
        },
        validBody.reason,
        validBody.notes,
      );

      const result = await this.generate(prompt);
      const parsed = dayRegenerationResultSchema.safeParse(result.data);
      if (!parsed.success) {
        throw new PlanServiceError(502, 'The regenerated day did not match the expected format.', 'ai_invalid');
      }

      const regeneratedDay = {
        ...parsed.data.day,
        dayIndex,
        dayName: day.dayName,
        restDay: Boolean(parsed.data.day.restDay),
        exercises: Array.isArray(parsed.data.day.exercises) ? parsed.data.day.exercises : [],
      };

      if (regeneratedDay.dayName !== day.dayName) {
        throw new PlanServiceError(400, 'The regenerated day must keep the same weekday identity.', 'invalid_day');
      }

      const updateQuery = WorkoutPlan.findOneAndUpdate(
        { _id: new Types.ObjectId(planId), userId: new Types.ObjectId(userId) },
        {
          $set: {
            [`days.${dayIndex}`]: regeneratedDay,
            'aiMetadata.model': result.model,
            'aiMetadata.promptVersion': DAY_REGENERATION_PROMPT_VERSION,
            'aiMetadata.generatedAt': new Date(),
            'aiMetadata.generationDurationMs': result.durationMs,
            'aiMetadata.generationType': 'day_regeneration',
          },
        },
        { new: true },
      );
      const updatedPlan = await this.runQuery<IWorkoutPlan | null>(updateQuery);

      if (!updatedPlan) {
        throw new PlanServiceError(409, 'This workout plan changed while processing your request. Please reload and try again.', 'duplicate_request');
      }

      return { day: updatedPlan.days[dayIndex], plan: updatedPlan };
    } finally {
      inFlightDayRegenerations.delete(guardKey);
    }
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
