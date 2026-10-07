import mongoose, { Schema, Document, Model } from 'mongoose';

// Enums for string literal types
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

// 'basketball' and 'tennis' were added so the onboarding flow can offer the
// sports the product promises without falling back to a lossy "other" value.
// The value is still a closed enum, so existing documents remain valid.
export const SportOption = ['none', 'cricket', 'football', 'basketball', 'tennis', 'other'] as const;
export type SportOption = typeof SportOption[number];

export interface IFitnessProfile extends Document {
  userId: mongoose.Types.ObjectId;
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
  createdAt: Date;
  updatedAt: Date;
}

// Define the schema
const FitnessProfileSchema: Schema<IFitnessProfile> = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    goal: { type: String, required: true, enum: FitnessGoal },
    experienceLevel: { type: String, required: true, enum: ExperienceLevel },
    trainingLocation: { type: String, required: true, enum: TrainingLocation },
    equipment: [{ type: String, required: true }],
    availableDays: [{ type: String, required: true, enum: AvailableDay }],
    sessionDuration: { type: Number, required: true, min: 1 },
    preferredActivities: [{ type: String }],
    excludedExercises: [{ type: String }],
    sport: { type: String, required: true, enum: SportOption },
    sportName: { type: String },
    additionalNotes: { type: String },
  },
  { timestamps: true }
);

// The unique index on `userId` is declared on the field itself (`unique: true`),
// so no separate schema-level index is needed here.

export const FitnessProfile: Model<IFitnessProfile> = mongoose.model<IFitnessProfile>('FitnessProfile', FitnessProfileSchema);