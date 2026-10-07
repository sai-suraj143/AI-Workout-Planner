import {
  AdherenceLevel,
  DecisionType,
  TrendDirection,
  type AdaptationOutcome,
  type ProfileConstraints,
  type WorkoutLogLike,
} from './adaptation.types';
import { analyzeRecentPerformance } from './performanceAnalyzer';

const decisionPriority = (decision: DecisionType): number => {
  switch (decision) {
    case DecisionType.PROGRESS:
      return 5;
    case DecisionType.MAINTAIN:
      return 4;
    case DecisionType.MODIFY:
      return 3;
    case DecisionType.REDUCE:
      return 2;
    case DecisionType.BASELINE:
    default:
      return 1;
  }
};

const determineAdherence = (summary: ReturnType<typeof analyzeRecentPerformance>): AdherenceLevel => {
  if (!summary.historyAvailable) {
    return AdherenceLevel.INSUFFICIENT_DATA;
  }

  if (summary.completionRate >= 85 && summary.recentConsistency >= 80) {
    return AdherenceLevel.HIGH;
  }

  if (summary.completionRate >= 60 && summary.recentConsistency >= 55) {
    return AdherenceLevel.NORMAL;
  }

  return AdherenceLevel.LOW;
};

const determineTrend = (summary: ReturnType<typeof analyzeRecentPerformance>): TrendDirection => {
  if (!summary.historyAvailable) {
    return TrendDirection.UNKNOWN;
  }

  return summary.recentTrend;
};

const buildReasons = (
  summary: ReturnType<typeof analyzeRecentPerformance>,
  adherence: AdherenceLevel,
  decision: DecisionType,
  trend: TrendDirection,
): string[] => {
  const reasons: string[] = [];

  if (!summary.historyAvailable) {
    return ['Not enough workout history yet to adapt the plan.'];
  }

  if (summary.completionRate >= 70) {
    reasons.push('Recent workout completion is consistently high.');
  } else if (summary.completionRate >= 50) {
    reasons.push('Recent workout completion is moderate, so the plan should stay conservative.');
  } else {
    reasons.push('Recent workout completion has been inconsistent, so plan difficulty should be reduced.');
  }

  if (summary.recentWorkoutCount >= 3) {
    reasons.push(`You have ${summary.recentWorkoutCount} recent workouts available for adaptation.`);
  }

  if (summary.consecutiveSuccessfulSessions >= 2) {
    reasons.push('You have maintained consecutive successful sessions.');
  }

  if (summary.averagePlannedMinutes > 0) {
    const delta = Math.abs(summary.averageActualMinutes - summary.averagePlannedMinutes);
    if (delta <= 10) {
      reasons.push('Actual workout duration remains close to the planned duration.');
    } else {
      reasons.push('Workout duration varies more than expected, so the session structure may need adjustment.');
    }
  }

  if (adherence === AdherenceLevel.HIGH && decision === DecisionType.PROGRESS) {
    reasons.push('High adherence supports a slightly more challenging, but still safe, plan.');
  }

  if ((decision === DecisionType.REDUCE || decision === DecisionType.MODIFY) && trend === TrendDirection.DECLINING) {
    reasons.push('The recent trend suggests a more manageable structure would better fit current performance.');
  }

  if (decision === DecisionType.MAINTAIN) {
    reasons.push('The current structure is working well enough to maintain without major changes.');
  }

  if (adherence === AdherenceLevel.LOW) {
    reasons.push('Lower adherence indicates that the current plan may be too demanding or too rigid.');
  }

  return reasons.slice(0, 6);
};

export const evaluateAdaptationDecision = (
  logs: WorkoutLogLike[],
  profile: ProfileConstraints,
): AdaptationOutcome => {
  const summary = analyzeRecentPerformance(logs, profile);
  const adherence = determineAdherence(summary);
  const trend = determineTrend(summary);

  let decision: DecisionType = DecisionType.BASELINE;

  if (!summary.historyAvailable || adherence === AdherenceLevel.INSUFFICIENT_DATA) {
    decision = DecisionType.BASELINE;
  } else if (adherence === AdherenceLevel.HIGH && summary.completionRate >= 80 && trend !== TrendDirection.DECLINING) {
    decision = DecisionType.PROGRESS;
  } else if (
    adherence === AdherenceLevel.NORMAL &&
    (trend === TrendDirection.STABLE || trend === TrendDirection.UNKNOWN)
  ) {
    decision = DecisionType.MAINTAIN;
  } else if (adherence === AdherenceLevel.LOW || trend === TrendDirection.DECLINING) {
    decision = summary.averageActualMinutes < summary.averagePlannedMinutes * 0.75
      ? DecisionType.REDUCE
      : DecisionType.MODIFY;
  } else if (adherence === AdherenceLevel.NORMAL && trend === TrendDirection.IMPROVING) {
    decision = DecisionType.MAINTAIN;
  } else {
    decision = DecisionType.MAINTAIN;
  }

  const reasons = buildReasons(summary, adherence, decision, trend);

  return {
    summary,
    adherence,
    trend,
    decision,
    reasons,
    historyAvailable: summary.historyAvailable,
  };
};

export const chooseStrongestDecision = (...outcomes: AdaptationOutcome[]): AdaptationOutcome | null => {
  if (outcomes.length === 0) return null;
  return outcomes.reduce((best, current) => (
    decisionPriority(current.decision) > decisionPriority(best.decision) ? current : best
  ));
};
