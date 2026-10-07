/**
 * Domain types for a generated week.
 *
 * `dayIndex` is 0 = monday … 6 = sunday, matching the server's normalisation
 * order; `dayName` is the lower-case day itself.
 */

export interface WorkoutDay {
  dayIndex: number; // 0 = monday … 6 = sunday
  dayName: string; // 'monday' … 'sunday'
  focus: string;
  estimatedDuration: number; // minutes; 0 for rest days
  restDay: boolean;
  exercises: Exercise[];
}

export interface Exercise {
  exerciseId?: string;
  name: string;
  category: string;
  muscleGroup?: string;
  equipment?: string;
  /** Absent for timed work. */
  sets?: number;
  /** Absent for timed work. */
  reps?: number;
  /** Absent for repetition-based work. */
  durationSeconds?: number;
  /** Always present: the server fills the schema default (60s). */
  restSeconds: number;
  intensity?: string;
  instructions: string;
  safetyNotes?: string;
  alternatives?: string[];
}
