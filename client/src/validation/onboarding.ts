import { z } from 'zod';
import {
  AvailableDay,
  ExperienceLevel,
  FitnessGoal,
  SportOption,
  TrainingLocation,
} from '../types/fitnessProfile';
import type { FitnessProfile } from '../types/fitnessProfile';
import { STEP_ORDER } from '../types/onboarding';
import type { OnboardingFormData, StepId } from '../types/onboarding';

/**
 * Frontend mirror of `server/src/validators/profileValidators.ts`.
 *
 * This is a convenience layer so the wizard can never *send* malformed data —
 * it is NOT a replacement for the server validation, which remains the final
 * authority on what is stored.
 */

/* ------------------------------------------------------------ shared shapes */

/**
 * Form state as a validated object.
 *
 * Every field is `.catch()`-ed, so parsing a saved profile, a local draft or
 * plain garbage never throws — unusable values simply fall back to the neutral
 * default for that single field.
 */
export const onboardingFormSchema: z.ZodType<OnboardingFormData> = z.object({
  goal: z.enum(FitnessGoal).nullable().catch(null),
  experienceLevel: z.enum(ExperienceLevel).nullable().catch(null),
  trainingLocation: z.enum(TrainingLocation).nullable().catch(null),
  equipment: z.array(z.string()).catch([]),
  availableDays: z.array(z.enum(AvailableDay)).catch([]),
  sessionDuration: z.number().nullable().catch(null),
  preferredActivities: z.array(z.string()).catch([]),
  excludedExercises: z.array(z.string()).catch([]),
  sport: z.enum(SportOption).nullable().catch(null),
  sportName: z.string().catch(''),
  additionalNotes: z.string().catch(''),
});

/* ------------------------------------------------------------------ payloads */

export const fitnessProfilePayloadSchema = z.object({
  goal: z.enum(FitnessGoal),
  experienceLevel: z.enum(ExperienceLevel),
  trainingLocation: z.enum(TrainingLocation),
  equipment: z
    .array(z.string().trim().min(1, 'Equipment cannot be blank').max(60, 'Equipment name is too long'))
    .min(1, 'Choose at least one equipment option')
    .max(30),
  availableDays: z.array(z.enum(AvailableDay)).min(1, 'Select at least one training day').max(7),
  sessionDuration: z
    .number()
    .int('Session duration must be a whole number of minutes')
    .min(5, 'Session duration must be at least 5 minutes')
    .max(300, 'Session duration must be 300 minutes or fewer'),
  preferredActivities: z
    .array(z.string().trim().min(1, 'Activity cannot be blank').max(60, 'Activity name is too long'))
    .max(30),
  excludedExercises: z
    .array(z.string().trim().min(1, 'Exercise cannot be blank').max(80, 'Exercise name is too long'))
    .max(50),
  sport: z.enum(SportOption),
  sportName: z.string().trim().max(60, 'Sport name must be 60 characters or fewer'),
  additionalNotes: z.string().trim().max(2000, 'Notes must be 2000 characters or fewer'),
}).superRefine((data, ctx) => {
  // Mirrors the server's `.superRefine`: "other" is meaningless without a name.
  if (data.sport === 'other' && data.sportName.length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['sportName'],
      message: 'Sport name is required when the sport is "other"',
    });
  }
});

/** Exact wire shape sent to `PUT /api/profile`. */
export type FitnessProfilePayload = z.infer<typeof fitnessProfilePayloadSchema>;

/* ------------------------------------------------------------- step schemas */

const equipmentList = z
  .array(z.string().trim().min(1, 'Equipment cannot be blank').max(60, 'Equipment name is too long'))
  .min(1, 'Choose at least one equipment option')
  .max(30);

const activityList = z
  .array(z.string().trim().min(1, 'Activity cannot be blank').max(60, 'Activity name is too long'))
  .max(30);

const excludedList = z
  .array(z.string().trim().min(1, 'Exercise cannot be blank').max(80, 'Exercise name is too long'))
  .max(50);

const sessionDurationField = z
  .number()
  .int('Session duration must be a whole number of minutes')
  .min(5, 'Session duration must be at least 5 minutes')
  .max(300, 'Session duration must be 300 minutes or fewer');

const stepSchemas: Record<StepId, z.ZodType<unknown>> = {
  goal: z.object({ goal: z.enum(FitnessGoal) }),
  experience: z.object({ experienceLevel: z.enum(ExperienceLevel) }),
  environment: z.object({
    trainingLocation: z.enum(TrainingLocation),
    equipment: equipmentList,
  }),
  availability: z.object({
    availableDays: z.array(z.enum(AvailableDay)).min(1, 'Select at least one training day').max(7),
    sessionDuration: sessionDurationField,
  }),
  preferences: z.object({
    preferredActivities: activityList,
    excludedExercises: excludedList,
  }),
  sport: z
    .object({
      sport: z.enum(SportOption),
      sportName: z.string().trim().max(60, 'Sport name must be 60 characters or fewer'),
    })
    .refine((data) => data.sport !== 'other' || data.sportName.length > 0, {
      message: 'Enter the name of your sport',
      path: ['sportName'],
    }),
  notes: z.object({
    additionalNotes: z.string().max(2000, 'Notes must be 2000 characters or fewer'),
  }),
};

/** Human readable explanation per failing field — never a raw library error. */
const STEP_MESSAGES: Record<StepId, Record<string, string>> = {
  goal: { goal: 'Choose the goal that best matches what you want to achieve.' },
  experience: { experienceLevel: 'Select your experience level to continue.' },
  environment: {
    trainingLocation: 'Choose where you usually train.',
    equipment: 'Choose at least one equipment option so we know what you can use.',
  },
  availability: {
    availableDays: 'Select at least one day you can train.',
    sessionDuration: 'Choose how long a typical session should be.',
  },
  preferences: {
    preferredActivities: 'Activity names cannot be blank.',
    excludedExercises: 'Exercises to avoid must be 80 characters or fewer.',
  },
  sport: {
    sport: 'Select a sport, or choose None.',
    sportName: 'Enter the name of your sport.',
  },
  notes: { additionalNotes: 'Notes must be 2000 characters or fewer.' },
};

const STEP_FALLBACK: Record<StepId, string> = {
  goal: 'Choose a fitness goal to continue.',
  experience: 'Select your experience level to continue.',
  environment: 'Complete the training environment step to continue.',
  availability: 'Complete the availability step to continue.',
  preferences: 'Complete the preferences step to continue.',
  sport: 'Complete the sport step to continue.',
  notes: 'Complete the final step to continue.',
};

const messageFor = (stepId: StepId, issuePath: readonly PropertyKey[]): string => {
  const key = issuePath[0];
  const message = typeof key === 'string' ? STEP_MESSAGES[stepId][key] : undefined;
  return message ?? STEP_FALLBACK[stepId];
};

/* ------------------------------------------------------------------ helpers */

const dedupe = <T>(values: T[]): T[] => Array.from(new Set(values));

/**
 * Normalises raw form state into the exact shape both the per-step schemas and
 * the payload schema validate against:
 *
 * - trims every free-text value,
 * - drops blanks and duplicates,
 * - only ever keeps `sportName` when `sport === 'other'`, so contradictory
 *   values cannot reach the API,
 * - treats `additionalNotes` as an optional field.
 */
const toProfileDraft = (form: OnboardingFormData): OnboardingFormData => ({
  goal: form.goal,
  experienceLevel: form.experienceLevel,
  trainingLocation: form.trainingLocation,
  equipment: dedupe(form.equipment.map((item) => item.trim()).filter(Boolean)),
  availableDays: dedupe(form.availableDays),
  sessionDuration: form.sessionDuration,
  preferredActivities: dedupe(form.preferredActivities.map((item) => item.trim()).filter(Boolean)),
  excludedExercises: dedupe(form.excludedExercises.map((item) => item.trim()).filter(Boolean)),
  sport: form.sport,
  sportName: form.sport === 'other' ? form.sportName.trim() : '',
  additionalNotes: form.additionalNotes.trim(),
});

/** Returns `null` when the step is valid, otherwise a friendly message. */
export const validateStep = (stepId: StepId, form: OnboardingFormData): string | null => {
  const result = stepSchemas[stepId].safeParse(toProfileDraft(form));
  if (result.success) return null;
  const issue = result.error.issues[0];
  return issue ? messageFor(stepId, issue.path) : STEP_FALLBACK[stepId];
};

/** First step (in wizard order) that is still invalid, or `null` when complete. */
export const findInvalidStep = (form: OnboardingFormData): StepId | null =>
  STEP_ORDER.find((stepId) => validateStep(stepId, form) !== null) ?? null;

export type BuildPayloadResult =
  | { ok: true; payload: FitnessProfilePayload }
  | { ok: false; step: StepId; message: string };

/** Full-form validation immediately before `PUT /api/profile`. */
export const buildProfilePayload = (form: OnboardingFormData): BuildPayloadResult => {
  const parsed = fitnessProfilePayloadSchema.safeParse(toProfileDraft(form));

  if (parsed.success) {
    return { ok: true, payload: parsed.data };
  }

  const invalidStep = findInvalidStep(form);
  const issue = parsed.error.issues[0];
  const step = invalidStep ?? 'goal';
  return {
    ok: false,
    step,
    message: issue ? messageFor(step, issue.path) : STEP_FALLBACK[step],
  };
};

/* ----------------------------------------------------------- server → form */

/**
 * Maps a saved profile onto wizard state. Only fields that are genuinely
 * unusable (unknown enum value, missing list) fall back to the neutral default —
 * an existing profile is never wholesale replaced by empty defaults.
 */
export const formFromProfile = (profile: FitnessProfile): OnboardingFormData =>
  onboardingFormSchema.parse({
    goal: profile.goal,
    experienceLevel: profile.experienceLevel,
    trainingLocation: profile.trainingLocation,
    equipment: profile.equipment,
    availableDays: profile.availableDays,
    sessionDuration: profile.sessionDuration,
    preferredActivities: profile.preferredActivities,
    excludedExercises: profile.excludedExercises,
    sport: profile.sport,
    sportName: profile.sport === 'other' ? profile.sportName ?? '' : '',
    additionalNotes: profile.additionalNotes ?? '',
  });

/* ---------------------------------------------------------- draft → form */

/**
 * Validates an untrusted object (e.g. `JSON.parse` output from a local draft)
 * into usable form state. Returns `null` when the object cannot be continued
 * from the first step.
 */
export const parseStoredForm = (raw: unknown): OnboardingFormData | null => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;

  const form = onboardingFormSchema.parse(raw);
  return validateStep('goal', form) === null ? form : null;
};
