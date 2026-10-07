/**
 * Analytics service — all queries are scoped to authenticated userId.
 * Error class follows the project convention (status, code, name).
 */

import { Types } from 'mongoose';
import { WorkoutLog, IWorkoutLog } from '../models/WorkoutLog';
import { WorkoutPlan, IWorkoutPlan } from '../models/WorkoutPlan';
import { User } from '../models/User';
import { FitnessProfile } from '../models/FitnessProfile';
import { WorkoutLogStatus } from '../models/WorkoutLog';

export class AnalyticsServiceError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, message: string, code: string) {
    super(message);
    this.name = 'AnalyticsServiceError';
    this.status = status;
    this.code = code;
  }
}

export interface FrequencyEntry {
  date: string;
  count: number;
}

export interface PlannedVsActual {
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
  plannedSets: number;
  plannedReps: number;
  actualSets: number;
  actualReps: number;
}

export interface RecentActivityEntry {
  _id: Types.ObjectId;
  workoutDate: Date;
  dayName: string;
  focus: string;
  plannedDuration: number;
  actualDuration: number | null;
  status: WorkoutLogStatus;
  completedAt: Date | null;
  startedAt: Date;
}

/**
 * Map a range string (7d, 30d, 90m) to a cutoff Date.
 */
export function mapRangeToCutoff(range: string): Date {
  const num = parseInt(range, 10);
  const unit = range.slice(-1).toLowerCase();
  const now = new Date();
  switch (unit) {
    case 'd':
      const days = new Date();
      days.setDate(now.getDate() - num);
      return days;
    case 'w':
      const weeks = new Date();
      weeks.setDate(now.getDate() - num * 7);
      return weeks;
    case 'm':
      const months = new Date();
      months.setMonth(now.getMonth() - num);
      return months;
    default:
      // TypeScript 7: never can't receive a string directly; just throw.
      throw new Error(`Unsupported range unit: ${unit}`);
  }
}

/**
 * Core aggregation that returns summary + frequency + planned-vs-actual + exercise perf + recent activity
 * for a given user and date range.
 * All queries are scoped to the authenticated user — userId comes from req.user only, never from query params.
 */
export async function getSummary(
  userId: string,
  range: string,
  cutoff: Date
): Promise<{
  totalWorkouts: number;
  completedWorkouts: number;
  abandonedWorkouts: number;
  inProgressWorkouts: number;
  completionRate: number;
  totalPlannedMinutes: number;
  totalActualMinutes: number;
  averageActualMinutes: number;
  frequency: FrequencyEntry[];
  plannedVsActual: PlannedVsActual[];
  completion: CompletionBreakdown;
  exercisePerformance: ExercisePerformanceEntry[];
  recentActivity: RecentActivityEntry[];
}> {
  const objectId = Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : new Types.ObjectId();

  // --- Completion breakdown ---
  const completion = await WorkoutLog.aggregate([
    { $match: { userId: objectId, status: 'completed' } },
    {
      $group: {
        _id: null,
        completed: { $sum: 1 },
        totalPlannedMinutes: { $sum: '$plannedDuration' },
        totalActualMinutes: { $sum: '$actualDuration' },
      },
    },
  ]);

  const completedCount = completion?.[0]?.completed ?? 0;
  const totalPlannedMinutes = completion?.[0]?.totalPlannedMinutes ?? 0;
  const totalActualMinutes = completion?.[0]?.totalActualMinutes ?? 0;

  // Also count abandoned
  const abandonedDoc = await WorkoutLog.aggregate([
    { $match: { userId: objectId, status: 'abandoned' } },
    {
      $group: {
        _id: null,
        abandoned: { $sum: 1 },
      },
    },
  ]);
  const abandonedCount = abandonedDoc?.[0]?.abandoned ?? 0;

  const totalWorkouts = await WorkoutLog.countDocuments({ userId: objectId });
  const inProgressCount = await WorkoutLog.countDocuments({ userId: objectId, status: 'in_progress' });
  const completionRate = totalWorkouts > 0 ? (completedCount / totalWorkouts) * 100 : 0;
  const averageActualMinutes =
    completedCount > 0 ? totalActualMinutes / completedCount : 0;

  // --- Frequency (daily workout count since cutoff) ---
  const frequency: FrequencyEntry[] = await WorkoutLog.aggregate([
    { $match: { userId: objectId, workoutDate: { $gte: cutoff } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$workoutDate' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        date: '$_id',
        count: 1,
        _id: 0,
      },
    },
  ]);

  // --- Planned vs actual per day ---
  const plannedVsActual: PlannedVsActual[] = await WorkoutLog.aggregate([
    { $match: { userId: objectId, status: 'completed' } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$workoutDate' } },
        plannedMinutes: { $sum: '$plannedDuration' },
        actualMinutes: { $sum: '$actualDuration' },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        date: '$_id',
        plannedMinutes: 1,
        actualMinutes: 1,
        _id: 0,
      },
    },
  ]);

  // --- Exercise performance (where data exists) ---
  const exercisePerformance: ExercisePerformanceEntry[] = await WorkoutLog.aggregate([
    { $match: { userId: objectId, status: 'completed', 'exercises': { $exists: true, $ne: [] } } },
    { $unwind: '$exercises' },
    {
      $group: {
        _id: {
          exerciseName: '$exercises.exerciseName',
          date: { $dateToString: { format: '%Y-%m-%d', date: '$workoutDate' } },
        },
        plannedSets: { $max: '$exercises.plannedSets' },
        plannedReps: { $max: '$exercises.plannedReps' },
        actualSets: { $max: '$exercises.actualSets' },
        actualReps: { $max: '$exercises.actualReps' },
      },
    },
    { $sort: { '_id.date': 1, '_id.exerciseName': 1 } },
    {
      $project: {
        exerciseName: '$_id.exerciseName',
        date: '$_id.date',
        plannedSets: 1,
        plannedReps: 1,
        actualSets: 1,
        actualReps: 1,
        _id: 0,
      },
    },
  ]);

  // --- Recent activity (last 5 completed workouts) ---
  const recentActivity = await WorkoutLog.find({ userId: objectId, status: 'completed' })
    .sort({ completedAt: -1 })
    .limit(5)
    .select('workoutDate dayName focus plannedDuration actualDuration status completedAt startedAt')
    .lean()
    .exec();

  // Transform completedAt to be nullable Date (handle undefined from lean())
  const transformed = recentActivity.map((w) => ({
    _id: w._id instanceof Types.ObjectId ? w._id : new Types.ObjectId(),
    workoutDate: w.workoutDate instanceof Date ? w.workoutDate : new Date(w.workoutDate),
    dayName: w.dayName,
    focus: w.focus,
    plannedDuration: typeof w.plannedDuration === 'number' ? w.plannedDuration : 0,
    actualDuration: w.actualDuration != null ? w.actualDuration : null,
    status: w.status,
    completedAt: w.completedAt instanceof Date ? w.completedAt : null,
    startedAt: w.startedAt instanceof Date ? w.startedAt : new Date(w.startedAt),
  }));

  return {
    totalWorkouts,
    completedWorkouts: completedCount,
    abandonedWorkouts: abandonedCount,
    inProgressWorkouts: inProgressCount,
    completionRate,
    totalPlannedMinutes,
    totalActualMinutes,
    averageActualMinutes: Math.round(averageActualMinutes),
    frequency,
    plannedVsActual,
    completion: { completed: completedCount, abandoned: abandonedCount },
    exercisePerformance,
    recentActivity: transformed,
  };
}

/**
 * Return a compact, user-friendly analytics payload for the frontend.
 *
 * Definition of streaks:
 *   A day counts toward a streak if the user has at least one COMPLETED workout on that date.
 *   in_progress and abandoned do NOT count.
 *   Multiple completed workouts on the same day count as one day.
 */
export async function getStreak(userId: string): Promise<{ currentStreak: number; longestStreak: number }> {
  const objectId = Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : new Types.ObjectId();

  // Get all completed dates (deduplicated)
  const dates = await WorkoutLog.distinct('workoutDate', {
    userId: objectId,
    status: 'completed',
  });

  if (dates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Convert to ISO date strings and sort ascending
  const dayStrings: string[] = dates
    .map((d) => new Date(d).toISOString().split('T')[0])
    .sort();

  // Compute streaks by collapsing consecutive days
  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 0;
  let prevDay: string | null = null;

  for (const day of dayStrings) {
    streak++;
    if (prevDay !== null) {
      const [y1, m1, d1] = prevDay.split('-').map(Number);
      const [y2, m2, d2] = day.split('-').map(Number);
      const prev = new Date(y1, m1 - 1, d1);
      const cur = new Date(y2, m2 - 1, d2);
      const diffDays = (cur.getTime() - prev.getTime()) / 86400000;
      if (diffDays !== 1) {
        // streak broken
        longestStreak = Math.max(longestStreak, streak);
        streak = 0;
      }
    }
    prevDay = day;
  }
  longestStreak = Math.max(longestStreak, streak);

  // Current streak: count from the most recent day backward while consecutive
  const latest = dayStrings[dayStrings.length - 1];
  const today = new Date().toISOString().split('T')[0];
  if (latest !== today) {
    // The latest completed day is not today → current streak is 0 (last workout was earlier)
    currentStreak = 0;
  } else {
    // Today is a completed day; count backward
    currentStreak = 1;
    for (let i = dayStrings.length - 2; i >= 0; i--) {
      const [y1, m1, d1] = dayStrings[i + 1].split('-').map(Number);
      const [y2, m2, d2] = dayStrings[i].split('-').map(Number);
      const prev = new Date(y1, m1 - 1, d1);
      const cur = new Date(y2, m2 - 1, d2);
      const diffDays = (prev.getTime() - cur.getTime()) / 86400000;
      if (diffDays === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  return { currentStreak, longestStreak };
}