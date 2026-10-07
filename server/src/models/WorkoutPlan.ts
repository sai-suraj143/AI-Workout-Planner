import mongoose, { Schema, Document, Model } from 'mongoose';

// Enums for string literal types (matching client-side definitions)
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

export const IntensityLevel = ['low', 'moderate', 'high'] as const;
export type IntensityLevel = typeof IntensityLevel[number];

export const DayOfWeek = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
] as const;
export type DayOfWeek = typeof DayOfWeek[number];

export const EquipmentType = [
  'bodyweight',
  'dumbbells',
  'barbell',
  'kettlebells',
  'resistance_bands',
  'pull_up_bar',
  'none'
] as const;
export type EquipmentType = typeof EquipmentType[number];

export const ExerciseCategory = [
  'strength',
  'cardio',
  'flexibility',
  'balance',
  'core'
] as const;
export type ExerciseCategory = typeof ExerciseCategory[number];

export const WorkoutStatus = [
  'draft',
  'generated',
  'completed'
] as const;
export type WorkoutStatus = typeof WorkoutStatus[number];

// Sub-interfaces for nested objects
export interface IExercise {
  exerciseId?: string; // Reference to exercise library if we had one
  name: string;
  category: ExerciseCategory;
  muscleGroup?: string;
  equipment?: EquipmentType | string;
  sets?: number;
  reps?: number;
  durationSeconds?: number; // For timed exercises like planks, cardio
  restSeconds?: number;
  intensity?: IntensityLevel;
  instructions: string;
  safetyNotes?: string;
  alternatives?: string[]; // Alternative exercises
}

export interface IWorkoutDay {
  dayIndex: number; // 0-6 for week
  dayName: DayOfWeek;
  focus: string;
  estimatedDuration: number; // in minutes
  restDay: boolean;
  exercises: IExercise[];
}

export interface IAIMetadata {
  model: string;
  promptVersion: string;
  generatedAt: Date;
  generationDurationMs?: number;
  generationType?: 'manual_plan' | 'adaptive_plan';
  generationKey?: string;
}

export interface IWorkoutPlan extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  summary: string;
  goal: FitnessGoal;
  experienceLevel: ExperienceLevel;
  totalWeeks: number;
  weekNumber: number;
  status: WorkoutStatus;
  days: IWorkoutDay[];
  aiMetadata?: IAIMetadata;
  createdAt: Date;
  updatedAt: Date;
}

// Define the schema
const WorkoutPlanSchema: Schema<IWorkoutPlan> = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    title: { type: String, required: true },
    summary: { type: String, required: true },
    goal: { type: String, required: true, enum: FitnessGoal },
    experienceLevel: { type: String, required: true, enum: ExperienceLevel },
    totalWeeks: { type: Number, required: true, min: 1, default: 1 },
    weekNumber: { type: Number, required: true, min: 1, default: 1 },
    status: {
      type: String,
      required: true,
      enum: WorkoutStatus,
      default: 'generated'
    },
    days: [{
      dayIndex: { type: Number, required: true, min: 0, max: 6 },
      dayName: { type: String, required: true, enum: DayOfWeek },
      focus: { type: String, required: true },
      // 0 is valid: a pure rest day has no training time. (Was min: 1, which
      // made an honest "0 minutes today" rest day impossible to persist.)
      estimatedDuration: { type: Number, required: true, min: 0 },
      restDay: { type: Boolean, required: true, default: false },
      exercises: [{
        exerciseId: { type: String },
        name: { type: String, required: true },
        category: { type: String, required: true, enum: ExerciseCategory },
        muscleGroup: { type: String },
        equipment: { type: String },
        sets: { type: Number },
        reps: { type: Number },
        durationSeconds: { type: Number },
        restSeconds: { type: Number, default: 60 },
        intensity: { type: String, enum: IntensityLevel },
        instructions: { type: String, required: true },
        safetyNotes: { type: String },
        alternatives: { type: [String], default: [] }
      }]
    }],
    aiMetadata: {
      model: { type: String, required: true },
      promptVersion: { type: String, required: true },
      generatedAt: { type: Date, required: true, default: Date.now },
      generationDurationMs: { type: Number },
      generationType: { type: String, enum: ['manual_plan', 'adaptive_plan'], default: 'manual_plan' },
      generationKey: { type: String }
    }
  },
  { timestamps: true }
);

// Indexes
WorkoutPlanSchema.index({ userId: 1, createdAt: -1 });
WorkoutPlanSchema.index({ userId: 1, status: 1 });

export const WorkoutPlan: Model<IWorkoutPlan> = mongoose.model<IWorkoutPlan>('WorkoutPlan', WorkoutPlanSchema);