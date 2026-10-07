export type AdaptationDecision = 'BASELINE' | 'PROGRESS' | 'MAINTAIN' | 'REDUCE' | 'MODIFY';
export type AdherenceLevel = 'HIGH' | 'NORMAL' | 'LOW' | 'INSUFFICIENT_DATA';
export type TrendDirection = 'IMPROVING' | 'STABLE' | 'DECLINING' | 'UNKNOWN';

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

export interface AdaptationResponse {
  success: boolean;
  summary: AdaptationSummary;
  adherence: AdherenceLevel;
  trend: TrendDirection;
  decision: AdaptationDecision;
  reasons: string[];
  historyAvailable: boolean;
}

export interface AdaptivePlanResponse {
  success: boolean;
  plan: any;
  adaptation: {
    summary: AdaptationSummary;
    adherence: AdherenceLevel;
    trend: TrendDirection;
    decision: AdaptationDecision;
    reasons: string[];
    historyAvailable: boolean;
  };
}
