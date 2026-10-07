export interface WorkoutExerciseLog {
  _id: string;
  workoutLogId: string;
  exerciseId: string; // Reference to exercise in plan
  exerciseName: string;
  plannedSets?: number; // For repetition-based exercises
  plannedReps?: number; // For repetition-based exercises
  plannedDuration?: number; // seconds for timed exercises
  actualSets?: number; // Completed sets
  actualReps?: number; // Completed reps (for last set if tracking per set)
  actualDuration?: number; // seconds actually spent
  completed: boolean; // Whether the exercise was completed
  skipped: boolean; // Whether the exercise was skipped
  notes?: string;
}