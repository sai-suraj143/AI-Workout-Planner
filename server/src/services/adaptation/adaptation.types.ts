export const AdherenceLevel = {
  HIGH: 'HIGH',
  NORMAL: 'NORMAL',
  LOW: 'LOW',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
} as const;
export type AdherenceLevel = typeof AdherenceLevel[keyof typeof AdherenceLevel];

export const DecisionType = {
  BASELINE: 'BASELINE',
  PROGRESS: 'PROGRESS',
  MAINTAIN: 'MAINTAIN',
  REDUCE: 'REDUCE',
  MODIFY: 'MODIFY',
} as const;
export type DecisionType = typeof DecisionType[keyof typeof DecisionType];

export const TrendDirection = {
  IMPROVING: 'IMPROVING',
  STABLE: 'STABLE',
  DECLINING: 'DECLINING',
  UNKNOWN: 'UNKNOWN',
} as const;
export type TrendDirection = typeof TrendDirection[keyof typeof TrendDirection];

export interface WorkoutLogLike {
  userId: string;
  workoutDate: Date | string;
  status: 'in_progress' | 'completed' | 'abandoned';
  plannedDuration: number;
  actualDuration?: number | null;
  dayName?: string;
  focus?: string;
  exercises?: Array<{
    exerciseName?: string;
    completed?: boolean;
    skipped?: boolean;
    actualDuration?: number;
    plannedDuration?: number;
  }>;
}

export interface ProfileConstraints {
  userId?: string;
  goal?: string;
  experienceLevel?: string;
  trainingLocation?: string;
  equipment: string[];
  availableDays: string[];
  sessionDuration: number;
  preferredActivities?: string[];
  excludedExercises: string[];
  sport?: string;
  sportName?: string;
  additionalNotes?: string;
}

export interface AdaptationSummary {
  totalRecentWorkouts: number;
  completedWorkouts: number;
  abandonedWorkouts: number;
  inProgressWorkouts: number;
  completionRate: number;
  exerciseCompletionRate: number;
  plannedTotalMinutes: number;
  actualTotalMinutes: number;
  averagePlannedMinutes: number;
  averageActualMinutes: number;
  recentAdherence: number;
  recentConsistency: number;
  recentWorkoutCount: number;
  consecutiveSuccessfulSessions: number;
  recentTrend: TrendDirection;
  historyAvailable: boolean;
  sessionDurationMinutes: number;
}

export interface AdaptationOutcome {
  summary: AdaptationSummary;
  adherence: AdherenceLevel;
  trend: TrendDirection;
  decision: DecisionType;
  reasons: string[];
  historyAvailable: boolean;
}

export interface AdaptiveProfileContext {
  goal?: string;
  experienceLevel?: string;
  trainingLocation?: string;
  equipment: string[];
  availableDays: string[];
  sessionDuration: number;
  preferredActivities: string[];
  excludedExercises: string[];
  sport?: string;
  sportName?: string;
  additionalNotes?: string;
}

export interface AdaptivePerformanceContext {
  recentWorkoutCount: number;
  completionRate: number;
  exerciseCompletionRate: number;
  plannedMinutes: number;
  actualMinutes: number;
  averagePlannedMinutes: number;
  averageActualMinutes: number;
  trend: TrendDirection;
}

export interface AdaptiveDecisionContext {
  decision: DecisionType;
  adherence: AdherenceLevel;
  reasons: string[];
}

export interface AdaptivePlanContext {
  profile: AdaptiveProfileContext;
  performance: AdaptivePerformanceContext;
  adaptation: AdaptiveDecisionContext;
}
