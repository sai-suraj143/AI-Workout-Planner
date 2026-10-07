import type { WorkoutDay } from './workoutDay';

/**
 * Client-side view of the workout plan returned by `/api/plans*`.
 *
 * The server normalises every plan before saving, so the shapes here mirror the
 * normalised documents (no `null`s, `aiMetadata` present, ISO date strings from
 * JSON).
 */

export type PlanGoal =
  | 'general_fitness'
  | 'strength'
  | 'endurance'
  | 'weight_management'
  | 'sports_performance'
  | 'mobility';

export type PlanExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export type PlanStatus = 'draft' | 'generated' | 'completed';

export interface PlanAIMetadata {
  model: string;
  promptVersion: string;
  /** ISO timestamp. */
  generatedAt: string;
  generationDurationMs?: number;
}

export interface WorkoutPlan {
  _id: string;
  userId: string;
  title: string;
  summary: string;
  goal: PlanGoal;
  experienceLevel: PlanExperienceLevel;
  totalWeeks: number;
  weekNumber: number;
  status: PlanStatus;
  days: WorkoutDay[];
  aiMetadata?: PlanAIMetadata;
  /** ISO timestamps (serialised from BSON dates by the API). */
  createdAt: string;
  updatedAt: string;
}
