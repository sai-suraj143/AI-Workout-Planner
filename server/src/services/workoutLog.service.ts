import { Types } from 'mongoose';
import { WorkoutLog, IWorkoutLog } from '../models/WorkoutLog';
import { WorkoutPlan, IWorkoutPlan } from '../models/WorkoutPlan';

export class WorkoutLogServiceError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, message: string, code: string) {
    super(message);
    this.name = 'WorkoutLogServiceError';
    this.status = status;
    this.code = code;
  }
}

export class WorkoutLogService {
  /**
   * Start a workout session from a specific plan/day
   */
  async startWorkout(userId: string, planId: string, dayIndex: number): Promise<IWorkoutLog> {
    // Verify user owns the plan
    const plan = await WorkoutPlan.findOne({ _id: planId, userId: userId });
    if (!plan) {
      throw new WorkoutLogServiceError(
        404,
        'Workout plan not found or you do not have permission to access it',
        'plan_not_found'
      );
    }

    // Verify dayIndex exists and is not a rest day
    if (dayIndex < 0 || dayIndex >= plan.days.length) {
      throw new WorkoutLogServiceError(
        400,
        'Invalid day index',
        'invalid_day_index'
      );
    }

    const day = plan.days[dayIndex];
    if (day.restDay) {
      throw new WorkoutLogServiceError(
        400,
        'Cannot start a workout on a rest day',
        'rest_day'
      );
    }

    // Check if user already has an active workout for this plan/day
    const existingWorkout = await WorkoutLog.findOne({
      userId: userId,
      planId: planId,
      dayIndex: dayIndex,
      status: 'in_progress'
    });

    if (existingWorkout) {
      throw new WorkoutLogServiceError(
        409,
        'You already have an active workout for this plan and day',
        'active_workout_exists'
      );
    }

    // Create the workout log with planned data copied from the plan
    const workoutLog = new WorkoutLog({
      userId: new Types.ObjectId(userId),
      planId: new Types.ObjectId(planId),
      planDayId: `${planId}-day${dayIndex}`, // Simple reference format
      dayIndex: dayIndex,
      workoutDate: new Date(),
      dayName: day.dayName,
      focus: day.focus,
      plannedDuration: day.estimatedDuration,
      actualDuration: 0,
      status: 'in_progress',
      completedAt: null,
      exercises: day.exercises.map(exercise => ({
        exerciseId: exercise.exerciseId || '',
        exerciseName: exercise.name,
        plannedSets: exercise.sets,
        plannedReps: exercise.reps,
        plannedDuration: exercise.durationSeconds,
        actualSets: 0,
        actualReps: 0,
        actualDuration: 0,
        completed: false,
        skipped: false,
        notes: undefined
      })),
      startedAt: new Date()
    });

    try {
      return await workoutLog.save();
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        throw new WorkoutLogServiceError(
          409,
          'You already have an active workout for this plan and day',
          'active_workout_exists'
        );
      }
      throw error;
    }
  }

  async getActiveWorkout(userId: string, planId: string, dayIndex: number): Promise<IWorkoutLog | null> {
    return WorkoutLog.findOne({ userId, planId, dayIndex, status: 'in_progress' });
  }

  /**
   * Get a workout log by ID, ensuring it belongs to the user
   */
  async getWorkoutById(userId: string, workoutId: string): Promise<IWorkoutLog | null> {
    return WorkoutLog.findOne({ _id: workoutId, userId: userId });
  }

  /**
   * Update an in-progress workout
   */
  async updateWorkout(userId: string, workoutId: string, updates: Partial<IWorkoutLog>): Promise<IWorkoutLog | null> {
    // Ensure the workout exists and belongs to the user
    const workout = await WorkoutLog.findOne({ _id: workoutId, userId: userId });
    if (!workout) {
      return null;
    }

    // Only allow updates to in_progress workouts
    if (workout.status !== 'in_progress') {
      throw new WorkoutLogServiceError(
        400,
        'Can only update workouts that are in progress',
        'invalid_workout_status'
      );
    }

    // Apply updates (excluding protected fields).
    // Only fields that were actually provided are assigned: assigning
    // `undefined` would clear required paths (e.g. actualDuration) and make
    // save() fail schema validation with a 500.
    const allowedUpdates: Partial<IWorkoutLog> = {};
    if (updates.actualDuration !== undefined) {
      allowedUpdates.actualDuration = updates.actualDuration;
    }
    if (updates.exercises !== undefined) {
      allowedUpdates.exercises = updates.exercises;
    }
    if (updates.notes !== undefined) {
      allowedUpdates.notes = updates.notes;
    }
    if (updates.completedAt !== undefined) {
      allowedUpdates.completedAt = updates.completedAt;
    }

    Object.assign(workout, allowedUpdates);
    workout.updatedAt = new Date();

    return await workout.save();
  }

  /**
   * Mark workout as completed
   */
  async completeWorkout(userId: string, workoutId: string): Promise<IWorkoutLog | null> {
    const workout = await WorkoutLog.findOne({ _id: workoutId, userId: userId });
    if (!workout) {
      return null;
    }

    const now = new Date();
    const completedWorkout = await WorkoutLog.findOneAndUpdate(
      { _id: workoutId, userId, status: 'in_progress' },
      {
        $set: {
          status: 'completed',
          completedAt: now,
          actualDuration: Math.floor((now.getTime() - workout.startedAt.getTime()) / 60000),
          updatedAt: now
        }
      },
      { new: true, runValidators: true }
    );

    if (!completedWorkout) {
      throw new WorkoutLogServiceError(
        400,
        'Can only complete workouts that are in progress',
        'invalid_workout_status'
      );
    }

    return completedWorkout;
  }

  /**
   * Mark workout as abandoned
   */
  async abandonWorkout(userId: string, workoutId: string): Promise<IWorkoutLog | null> {
    const workout = await WorkoutLog.findOne({ _id: workoutId, userId: userId });
    if (!workout) {
      return null;
    }

    const now = new Date();
    const abandonedWorkout = await WorkoutLog.findOneAndUpdate(
      { _id: workoutId, userId, status: 'in_progress' },
      {
        $set: {
          status: 'abandoned',
          actualDuration: Math.floor((now.getTime() - workout.startedAt.getTime()) / 60000),
          updatedAt: now
        }
      },
      { new: true, runValidators: true }
    );

    if (!abandonedWorkout) {
      throw new WorkoutLogServiceError(
        400,
        'Can only abandon workouts that are in progress',
        'invalid_workout_status'
      );
    }

    return abandonedWorkout;
  }

  /**
   * Get workout history for a user
   */
  async getWorkoutHistory(userId: string, limit: number = 20, offset: number = 0): Promise<IWorkoutLog[]> {
    return WorkoutLog.find({ userId: userId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .exec();
  }
}

// Export singleton instance
export const workoutLogService = new WorkoutLogService();