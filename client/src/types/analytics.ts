export type AnalyticsRange = '7d' | '30d' | '90d';

export interface FrequencyEntry {
  date: string;
  count: number;
}

export interface PlannedVsActualEntry {
  date: string;
  plannedMinutes: number;
  actualMinutes: number;
}

export interface CompletionBreakdown {
  completed: number;
  abandoned: number;
}

export interface ExercisePerformanceEntry {
  exerciseName: string;
  date?: string;
  plannedSets: number;
  plannedReps: number;
  actualSets: number;
  actualReps: number;
}

export interface RecentActivityEntry {
  _id: string;
  workoutDate: string | Date;
  dayName: string;
  focus: string;
  plannedDuration: number;
  actualDuration: number | null;
  status: 'completed' | 'abandoned' | 'in_progress';
  completedAt: string | Date | null;
  startedAt: string | Date;
}

export interface StreakSummary {
  currentStreak: number;
  longestStreak: number;
}

export interface AnalyticsSummary {
  totalWorkouts: number;
  completedWorkouts: number;
  abandonedWorkouts: number;
  inProgressWorkouts: number;
  completionRate: number;
  totalPlannedMinutes: number;
  totalActualMinutes: number;
  averageActualMinutes: number;
  frequency: FrequencyEntry[];
  plannedVsActual: PlannedVsActualEntry[];
  completion: CompletionBreakdown;
  exercisePerformance: ExercisePerformanceEntry[];
  recentActivity: RecentActivityEntry[];
  streaks?: StreakSummary;
}

export interface AnalyticsResponse {
  success: boolean;
  analytics: AnalyticsSummary;
}
