import { TrendDirection, type AdaptationSummary, type ProfileConstraints, type WorkoutLogLike } from './adaptation.types';

const RECENT_HISTORY_DAYS = 42;

const safeNumber = (value: number | null | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const toDate = (value: Date | string): Date => new Date(value);

const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
};

export const normalizeWorkoutLogs = (logs: WorkoutLogLike[]): WorkoutLogLike[] =>
  logs
    .filter((log) => log && typeof log === 'object')
    .map((log) => ({
      ...log,
      plannedDuration: safeNumber(log.plannedDuration),
      actualDuration: log.actualDuration == null ? 0 : safeNumber(log.actualDuration),
      exercises: Array.isArray(log.exercises) ? log.exercises : [],
    }))
    .filter((log) => log.userId != null);

export const analyzeRecentPerformance = (
  logs: WorkoutLogLike[],
  profile: ProfileConstraints,
): AdaptationSummary => {
  const userScopedLogs = profile.userId
    ? normalizeWorkoutLogs(logs).filter((log) => String(log.userId) === String(profile.userId))
    : normalizeWorkoutLogs(logs);
  const normalized = userScopedLogs.sort(
    (left, right) => toDate(right.workoutDate).getTime() - toDate(left.workoutDate).getTime(),
  );

  const now = Date.now();
  const cutoff = now - RECENT_HISTORY_DAYS * 24 * 60 * 60 * 1000;
  const recentLogs = normalized.filter((log) => toDate(log.workoutDate).getTime() >= cutoff);

  const totalRecentWorkouts = recentLogs.length;
  const completedWorkouts = recentLogs.filter((log) => log.status === 'completed').length;
  const abandonedWorkouts = recentLogs.filter((log) => log.status === 'abandoned').length;
  const inProgressWorkouts = recentLogs.filter((log) => log.status === 'in_progress').length;
  const completionRate = totalRecentWorkouts > 0
    ? clampPercent((completedWorkouts / totalRecentWorkouts) * 100)
    : 0;

  const exerciseEntries = recentLogs.flatMap((log) => log.exercises ?? []);
  const totalExerciseCount = exerciseEntries.length;
  const completedExerciseCount = exerciseEntries.filter((exercise) => exercise.completed === true).length;
  const exerciseCompletionRate = totalExerciseCount > 0
    ? clampPercent((completedExerciseCount / totalExerciseCount) * 100)
    : 0;

  const plannedTotalMinutes = recentLogs.reduce((sum, log) => sum + safeNumber(log.plannedDuration), 0);
  const actualTotalMinutes = recentLogs.reduce((sum, log) => sum + safeNumber(log.actualDuration), 0);
  const averagePlannedMinutes = totalRecentWorkouts > 0 ? plannedTotalMinutes / totalRecentWorkouts : 0;
  const averageActualMinutes = totalRecentWorkouts > 0 ? actualTotalMinutes / totalRecentWorkouts : 0;

  const ratioScores = recentLogs
    .map((log) => {
      const planned = safeNumber(log.plannedDuration);
      const actual = safeNumber(log.actualDuration);
      if (planned <= 0) return 0;
      return clampPercent((actual / planned) * 100);
    });

  const recentAdherence = ratioScores.length > 0
    ? ratioScores.reduce((sum, value) => sum + value, 0) / ratioScores.length
    : 0;

  const recentConsistency = ratioScores.length > 0
    ? ratioScores.reduce((sum, value) => sum + Math.max(0, 100 - Math.abs(100 - value)), 0) / ratioScores.length
    : 0;

  let consecutiveSuccessfulSessions = 0;
  for (const log of [...recentLogs].sort((a, b) => toDate(a.workoutDate).getTime() - toDate(b.workoutDate).getTime())) {
    const planned = safeNumber(log.plannedDuration);
    const actual = safeNumber(log.actualDuration);
    const successful = log.status === 'completed' && planned > 0 && actual >= planned * 0.75;
    if (successful) {
      consecutiveSuccessfulSessions += 1;
    } else {
      break;
    }
  }

  const safeRecentTrend = (): TrendDirection => {
    if (recentLogs.length < 3) return TrendDirection.UNKNOWN;
    const ordered = [...recentLogs].sort(
      (a, b) => toDate(a.workoutDate).getTime() - toDate(b.workoutDate).getTime(),
    );
    const chunkSize = Math.max(2, Math.min(3, Math.floor(ordered.length / 2)));
    const earlier = ordered.slice(0, chunkSize);
    const later = ordered.slice(-chunkSize);
    const earlierRate = earlier.length > 0
      ? ((earlier.filter((log) => log.status === 'completed').length / earlier.length) * 100)
      : 0;
    const laterRate = later.length > 0
      ? ((later.filter((log) => log.status === 'completed').length / later.length) * 100)
      : 0;
    const delta = laterRate - earlierRate;
    if (delta >= 12) return TrendDirection.IMPROVING;
    if (delta <= -12) return TrendDirection.DECLINING;
    return TrendDirection.STABLE;
  };

  const historyAvailable = totalRecentWorkouts >= 3;

  return {
    totalRecentWorkouts,
    completedWorkouts,
    abandonedWorkouts,
    inProgressWorkouts,
    completionRate,
    exerciseCompletionRate,
    plannedTotalMinutes,
    actualTotalMinutes,
    averagePlannedMinutes,
    averageActualMinutes,
    recentAdherence: clampPercent(recentAdherence),
    recentConsistency: clampPercent(recentConsistency),
    recentWorkoutCount: totalRecentWorkouts,
    consecutiveSuccessfulSessions,
    recentTrend: safeRecentTrend(),
    historyAvailable,
    sessionDurationMinutes: profile.sessionDuration ?? 0,
  };
};
