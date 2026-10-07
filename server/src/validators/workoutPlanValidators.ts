import { z } from 'zod';
import {
  DayOfWeek,
  ExperienceLevel,
  ExerciseCategory,
  FitnessGoal,
  IntensityLevel,
} from '../models/WorkoutPlan';

// Helper to convert enum array to z.enum preserving literal types
const enumToZod = <T extends readonly string[]>(enumArr: T) => z.enum(enumArr);

/* --------------------------------------------------------------- primitives */

/**
 * Bounds are deliberately generous but finite: they exist to stop runaway model
 * output from reaching Mongo, not to micromanage wording.
 */
const text = (max: number) => z.string().trim().min(1, 'Cannot be empty').max(max);

/** Free text that the model may omit, emit as `null`, or emit as "". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .nullish();

/**
 * Numeric fields the model frequently writes as `null` instead of omitting
 * (e.g. `"reps": null` for a timed exercise). `null` and "absent" mean the same
 * thing here, so both are accepted and normalised away later.
 */
const optionalInt = (min: number, max: number) =>
  z
    .number()
    .int()
    .min(min)
    .max(max)
    .nullish();

/* ----------------------------------------------------------------- schemas */

// Exercise validation schema (raw AI output)
export const exerciseSchema = z.object({
  exerciseId: optionalText(120),
  name: text(120),
  category: enumToZod(ExerciseCategory),
  muscleGroup: optionalText(60),
  equipment: optionalText(80),
  // Timed work uses durationSeconds instead of sets/reps — never both required.
  sets: optionalInt(1, 20),
  reps: optionalInt(1, 300),
  durationSeconds: optionalInt(1, 7200),
  restSeconds: z.number().int().min(0).max(900).nullish(),
  intensity: enumToZod(IntensityLevel).nullish(),
  instructions: text(1500),
  safetyNotes: optionalText(600),
  alternatives: z.array(z.string().trim().min(1).max(80)).max(6).nullish(),
});

// Workout day validation schema (raw AI output)
export const workoutDaySchema = z.object({
  // dayIndex is re-derived from dayName during normalisation; it only has to be
  // in range here so a wildly wrong value still fails loudly.
  dayIndex: z.number().int().min(0).max(6),
  dayName: enumToZod(DayOfWeek),
  focus: text(120),
  // 0 is allowed so rest days do not have to invent a duration.
  estimatedDuration: z.number().int().min(0).max(600),
  restDay: z.boolean(),
  exercises: z.array(exerciseSchema).max(30),
  // Rest days may still come back with exercises attached; normalisation drops
  // them (§10). A *training* day with no exercises is structurally wrong and is
  // rejected here so the single retry can correct it.
}).superRefine((day, ctx) => {
  if (!day.restDay && day.exercises.length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['exercises'],
      message: 'A non-rest day must contain at least one exercise',
    });
  }
});

/**
 * The exact shape we ask Gemini for. Deliberately does NOT include
 * `model` / `promptVersion` / `generatedAt` — those are server-side facts
 * recorded by the service in `aiMetadata`, never values we trust from the model.
 */
export const aiWorkoutPlanSchema = z
  .object({
    title: text(120),
    summary: z.string().trim().min(1, 'Summary is required').max(1000),
    goal: enumToZod(FitnessGoal),
    experienceLevel: enumToZod(ExperienceLevel),
    totalWeeks: z.number().int().min(1).max(52).default(1),
    weekNumber: z.number().int().min(1).max(52).default(1),
    days: z.array(workoutDaySchema).min(1).max(7),
  })
  .superRefine((plan, ctx) => {
    const names = plan.days.map((day) => day.dayName);
    const unique = new Set(names);

    if (unique.size !== names.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['days'],
        message: 'Each dayName may appear at most once',
      });
    }

    const missing = DayOfWeek.filter((day) => !unique.has(day));
    if (missing.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['days'],
        message: `The week must cover all 7 days; missing: ${missing.join(', ')}`,
      });
    }
  });

// Type inference exports
export const exerciseSubstitutionRequestSchema = z.object({
  reason: z.enum(['equipment_unavailable', 'dont_prefer', 'too_difficult', 'too_easy', 'different_variation', 'other']),
  notes: z.string().trim().max(300, 'Notes must be 300 characters or fewer').optional(),
});

export const dayRegenerationRequestSchema = z.object({
  reason: z.string().trim().max(200, 'Reason must be 200 characters or fewer').optional(),
  notes: z.string().trim().max(300, 'Notes must be 300 characters or fewer').optional(),
});

export const exerciseReplacementResultSchema = z.object({
  exercise: exerciseSchema,
});

export const dayRegenerationResultSchema = z.object({
  day: workoutDaySchema,
});

export type AIWorkoutPlanInput = z.infer<typeof aiWorkoutPlanSchema>;
export type ExerciseInput = z.infer<typeof exerciseSchema>;
export type WorkoutDayInput = z.infer<typeof workoutDaySchema>;
export type ExerciseSubstitutionRequestInput = z.infer<typeof exerciseSubstitutionRequestSchema>;
export type DayRegenerationRequestInput = z.infer<typeof dayRegenerationRequestSchema>;

/* ------------------------------------------------------------- validation */

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: string[] };

/**
 * JSON → Zod. Never throws: failures come back as short, human-readable issues
 * that are logged server-side and fed to the single controlled retry.
 */
export const validateAiWorkoutPlan = (raw: unknown): ValidationResult<AIWorkoutPlanInput> => {
  const result = aiWorkoutPlanSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, value: result.data };
  }

  return {
    ok: false,
    issues: result.error.issues
      .slice(0, 15)
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
  };
};
