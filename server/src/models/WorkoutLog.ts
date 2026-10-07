import mongoose, { Schema, Document, Model } from 'mongoose';

// Enums for workout log status (matching client-side definitions)
export const WorkoutLogStatus = [
  'in_progress',
  'completed',
  'abandoned'
] as const;
export type WorkoutLogStatus = typeof WorkoutLogStatus[number];

// Sub-interfaces for nested objects
export interface IWorkoutExerciseLog {
  _id: mongoose.Types.ObjectId | string;
  exerciseId: string; // Reference to exercise in plan ('' when the plan did not specify one, e.g. Gemini-generated plans)
  exerciseName: string;
  plannedSets?: number; // For repetition-based exercises
  plannedReps?: number; // For repetition-based exercises
  plannedDuration?: number; // seconds for timed exercises
  actualSets?: number; // Completed sets
  actualReps?: number; // Completed reps (for last set if tracking per set)
  actualDuration?: number; // seconds actually spent
  completed: boolean; // Whether the exercise was completed
  skipped: boolean; // Whether the exercise was skipped
  notes?: string | null;
}

export interface IWorkoutLog extends Document {
  userId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  planDayId: string; // Reference to the specific day in the plan
  dayIndex: number; // 0-6 for week (mirrors plan dayIndex)
  workoutDate: Date;
  dayName: string; // e.g., 'monday'
  focus: string;
  plannedDuration: number; // minutes from plan
  actualDuration: number; // minutes actually spent
  status: WorkoutLogStatus;
  exercises: IWorkoutExerciseLog[];
  startedAt: Date;
  completedAt?: Date | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Define the schema
const WorkoutExerciseLogSchema: Schema<IWorkoutExerciseLog> = new Schema({
  // NOTE: not `required` — plan exercises (see WorkoutPlan.ts) treat exerciseId as
  // optional, so AI-generated plans frequently have none. Empty string is stored
  // instead, which keeps existing documents valid and lets analytics fall back to
  // exerciseName when grouping.
  exerciseId: { type: String, default: '' },
  exerciseName: { type: String, required: true },
  plannedSets: { type: Number },
  plannedReps: { type: Number },
  plannedDuration: { type: Number },
  actualSets: { type: Number },
  actualReps: { type: Number },
  actualDuration: { type: Number },
  completed: { type: Boolean, required: true, default: false },
  skipped: { type: Boolean, required: true, default: false },
  notes: { type: String }
}, { _id: true });

const WorkoutLogSchema: Schema<IWorkoutLog> = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'WorkoutPlan',
      required: true
    },
    planDayId: { type: String, required: true },
    dayIndex: { type: Number, required: true, min: 0, max: 6 },
    workoutDate: { type: Date, required: true },
    dayName: { type: String, required: true },
    focus: { type: String, required: true },
    plannedDuration: { type: Number, required: true, min: 0 },
    actualDuration: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      required: true,
      enum: WorkoutLogStatus,
      default: 'in_progress'
    },
    exercises: [{ type: WorkoutExerciseLogSchema, _id: true }],
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date, default: null },
    notes: { type: String }
  },
  { timestamps: true }
);

// Indexes for efficient querying
WorkoutLogSchema.index({ userId: 1, createdAt: -1 });
WorkoutLogSchema.index({ userId: 1, status: 1 });
WorkoutLogSchema.index({ planId: 1 });
WorkoutLogSchema.index({ userId: 1, workoutDate: -1 });
WorkoutLogSchema.index(
  { userId: 1, planId: 1, dayIndex: 1 },
  { unique: true, partialFilterExpression: { status: 'in_progress' } }
);

export const WorkoutLog: Model<IWorkoutLog> = mongoose.model<IWorkoutLog>('WorkoutLog', WorkoutLogSchema);