import type {
  AvailableDay,
  ExperienceLevel,
  FitnessGoal,
  SportOption,
  TrainingLocation,
} from './fitnessProfile';

/**
 * The onboarding wizard is a partial view of a {@link FitnessProfile} while the
 * user is filling it in: single-choice fields start as `null` ("not chosen yet"),
 * list/text fields always keep their (possibly empty) value.
 *
 * Keeping every field present — instead of `undefined` — means the form state is
 * trivially serialisable, never carries stale keys between steps, and can be
 * validated as one object.
 */
export interface OnboardingFormData {
  goal: FitnessGoal | null;
  experienceLevel: ExperienceLevel | null;
  trainingLocation: TrainingLocation | null;
  equipment: string[];
  availableDays: AvailableDay[];
  sessionDuration: number | null;
  preferredActivities: string[];
  excludedExercises: string[];
  sport: SportOption | null;
  /** Only meaningful when `sport === 'other'`; always "" otherwise. */
  sportName: string;
  /** Optional free text. */
  additionalNotes: string;
}

/** Wizard order — also used for progress display and "jump to invalid step". */
export const STEP_ORDER = [
  'goal',
  'experience',
  'environment',
  'availability',
  'preferences',
  'sport',
  'notes',
] as const;

export type StepId = (typeof STEP_ORDER)[number];

/** Safe starting point for a brand new user (never overwrites a saved profile). */
export const DEFAULT_ONBOARDING_FORM: OnboardingFormData = {
  goal: null,
  experienceLevel: null,
  trainingLocation: null,
  equipment: [],
  availableDays: [],
  sessionDuration: null,
  preferredActivities: [],
  excludedExercises: [],
  sport: null,
  sportName: '',
  additionalNotes: '',
};

/** Session lengths offered by the UI (minutes). Backend allows 5–300. */
export const SESSION_DURATIONS = [15, 30, 45, 60, 90] as const;
export type SessionDuration = (typeof SESSION_DURATIONS)[number];

/**
 * Shared contract for every step component: fully controlled — the parent owns
 * the form, so moving backwards can never discard what the user already typed.
 */
export interface StepProps {
  value: OnboardingFormData;
  onChange: (patch: Partial<OnboardingFormData>) => void;
}
