import { z } from 'zod';
import { FitnessGoal, ExperienceLevel, TrainingLocation, AvailableDay, SportOption } from '../models/FitnessProfile';

// Helper to convert enum array to z.enum preserving literal types
const enumToZod = <T extends readonly string[]>(enumArr: T) => z.enum(enumArr);

/**
 * Bounded free-text list. The frontend offers curated options plus free-form
 * additions, so entries are plain strings — but they must be non-empty and the
 * list as a whole must stay small enough to store and feed to the planner.
 */
const boundedTextList = (maxItems: number, maxItemLength: number, label: string) =>
  z
    .array(
      z
        .string()
        .trim()
        .min(1, `${label} cannot be empty`)
        .max(maxItemLength, `${label} must be ${maxItemLength} characters or fewer`)
    )
    .max(maxItems, `A maximum of ${maxItems} ${label.toLowerCase()}s is allowed`);

/**
 * Optional free text. An empty string is normalised to `undefined` so the field
 * is removed from the document rather than stored as "" — that keeps
 * `sport: 'none'` from ever travelling alongside a leftover sport name.
 */
const optionalText = (maxItemLength: number) =>
  z
    .string()
    .trim()
    .max(maxItemLength, `Must be ${maxItemLength} characters or fewer`)
    .optional()
    .or(z.literal(''))
    .transform((val) => val || undefined);

export const fitnessProfileSchema = z
  .object({
    goal: enumToZod(FitnessGoal),
    experienceLevel: enumToZod(ExperienceLevel),
    trainingLocation: enumToZod(TrainingLocation),
    equipment: boundedTextList(30, 60, 'Equipment item'),
    availableDays: z
      .array(enumToZod(AvailableDay))
      .min(1, 'At least one day must be selected')
      .max(7, 'A week only has seven days'),
    // Supported session lengths are 5–300 minutes; the UI offers 15/30/45/60/90.
    sessionDuration: z
      .number()
      .int('Session duration must be a whole number of minutes')
      .min(5, 'Session duration must be at least 5 minutes')
      .max(300, 'Session duration must be 300 minutes or fewer'),
    preferredActivities: boundedTextList(30, 60, 'Preferred activity'),
    excludedExercises: boundedTextList(50, 80, 'Excluded exercise'),
    sport: enumToZod(SportOption),
    sportName: optionalText(60),
    additionalNotes: optionalText(2000),
  })
  .superRefine((data, ctx) => {
    // "other" is meaningless without the actual sport name.
    if (data.sport === 'other' && !data.sportName) {
      ctx.addIssue({
        code: 'custom',
        path: ['sportName'],
        message: 'Sport name is required when the sport is "other"',
      });
    }
  });

export type FitnessProfileInput = z.infer<typeof fitnessProfileSchema>;
