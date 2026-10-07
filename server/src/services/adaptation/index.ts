export * from './adaptation.types';
export * from './performanceAnalyzer';
export * from './adaptation.rules';

import { TrendDirection, type AdaptivePlanContext, type AdaptationOutcome, type ProfileConstraints, type WorkoutLogLike } from './adaptation.types';

export const buildAdaptivePlanContext = (
  profile: ProfileConstraints,
  logs: WorkoutLogLike[],
  outcome: Pick<AdaptationOutcome, 'decision' | 'adherence' | 'reasons' | 'trend'>,
): AdaptivePlanContext => {
  const summary = logs.length > 0 ? (outcome as AdaptationOutcome).summary : undefined;

  const performance = {
    recentWorkoutCount: summary?.recentWorkoutCount ?? 0,
    completionRate: summary?.completionRate ?? 0,
    exerciseCompletionRate: summary?.exerciseCompletionRate ?? 0,
    plannedMinutes: summary?.plannedTotalMinutes ?? 0,
    actualMinutes: summary?.actualTotalMinutes ?? 0,
    averagePlannedMinutes: summary?.averagePlannedMinutes ?? profile.sessionDuration ?? 0,
    averageActualMinutes: summary?.averageActualMinutes ?? 0,
    trend: outcome.trend ?? TrendDirection.UNKNOWN,
  };

  return {
    profile: {
      goal: profile.goal,
      experienceLevel: profile.experienceLevel,
      trainingLocation: profile.trainingLocation,
      equipment: [...(profile.equipment ?? [])],
      availableDays: [...(profile.availableDays ?? [])],
      sessionDuration: profile.sessionDuration ?? 0,
      preferredActivities: [...(profile.preferredActivities ?? [])],
      excludedExercises: [...(profile.excludedExercises ?? [])],
      sport: profile.sport,
      sportName: profile.sportName,
      additionalNotes: profile.additionalNotes,
    },
    performance,
    adaptation: {
      decision: outcome.decision,
      adherence: outcome.adherence,
      reasons: [...outcome.reasons],
    },
  };
};

export const getAdaptivePlanSummary = (outcome: AdaptationOutcome) => outcome;
