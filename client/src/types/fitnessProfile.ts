export const FitnessGoal = [
  'general_fitness',
  'strength',
  'endurance',
  'weight_management',
  'sports_performance',
  'mobility'
] as const;
export type FitnessGoal = typeof FitnessGoal[number];

export const ExperienceLevel = ['beginner', 'intermediate', 'advanced'] as const;
export type ExperienceLevel = typeof ExperienceLevel[number];

export const TrainingLocation = ['home', 'gym', 'both'] as const;
export type TrainingLocation = typeof TrainingLocation[number];

export const AvailableDay = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
] as const;
export type AvailableDay = typeof AvailableDay[number];

// Mirrors server/src/models/FitnessProfile.ts -> SportOption.
export const SportOption = ['none', 'cricket', 'football', 'basketball', 'tennis', 'other'] as const;
export type SportOption = typeof SportOption[number];

export interface FitnessProfile {
  userId: string;
  goal: FitnessGoal;
  experienceLevel: ExperienceLevel;
  trainingLocation: TrainingLocation;
  equipment: string[];
  availableDays: AvailableDay[];
  sessionDuration: number;
  preferredActivities: string[];
  excludedExercises: string[];
  sport: SportOption;
  sportName?: string;
  additionalNotes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}