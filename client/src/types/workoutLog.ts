export interface WorkoutLog {
  _id: string;
  userId: string;
  planId: string;
  planDayId: string; // Reference to the specific day in the plan
  dayIndex: number; // 0-6 for week (mirrors plan dayIndex)
  workoutDate: Date;
  dayName: string; // e.g., 'monday'
  focus: string;
  plannedDuration: number; // minutes from plan
  actualDuration: number; // minutes actually spent
  status: 'in_progress' | 'completed' | 'abandoned';
  exercises: WorkoutExerciseLog[];
  startedAt: Date;
  completedAt?: Date | string | null;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

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
  // For detailed set tracking (optional enhancement):
  // sets?: Array<{
  //   setNumber: number;
  //   plannedReps?: number;
  //   actualReps?: number;
  //   completed: boolean;
  // }>;
}