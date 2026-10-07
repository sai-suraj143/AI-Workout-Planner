import { Types } from 'mongoose';
import { FitnessProfile } from '../../models/FitnessProfile';
import { WorkoutLog } from '../../models/WorkoutLog';
import { evaluateAdaptationDecision } from './adaptation.rules';
import type { ProfileConstraints, WorkoutLogLike } from './adaptation.types';

const profileToConstraints = (profile: {
  _id?: Types.ObjectId | string;
  userId?: Types.ObjectId | string;
  goal?: string;
  experienceLevel?: string;
  trainingLocation?: string;
  equipment?: string[];
  availableDays?: string[];
  sessionDuration?: number;
  preferredActivities?: string[];
  excludedExercises?: string[];
  sport?: string;
  sportName?: string;
  additionalNotes?: string;
} | null): ProfileConstraints => ({
  userId: profile?.userId ? String(profile.userId) : profile?._id ? String(profile._id) : undefined,
  goal: profile?.goal,
  experienceLevel: profile?.experienceLevel,
  trainingLocation: profile?.trainingLocation,
  equipment: profile?.equipment ?? [],
  availableDays: profile?.availableDays ?? [],
  sessionDuration: profile?.sessionDuration ?? 0,
  preferredActivities: profile?.preferredActivities ?? [],
  excludedExercises: profile?.excludedExercises ?? [],
  sport: profile?.sport,
  sportName: profile?.sportName,
  additionalNotes: profile?.additionalNotes,
});

export const getAdaptationSummaryForUser = async (userId: string) => {
  const objectId = new Types.ObjectId(userId);
  const profile = await FitnessProfile.findOne({ userId: objectId }).lean().exec();
  const logs = await WorkoutLog.find({ userId: objectId }).sort({ workoutDate: -1 }).lean().exec();

  const normalizedLogs: WorkoutLogLike[] = logs.map((log) => ({
    userId: String(log.userId),
    workoutDate: log.workoutDate,
    status: String(log.status) as 'in_progress' | 'completed' | 'abandoned',
    plannedDuration: Number(log.plannedDuration ?? 0),
    actualDuration: typeof log.actualDuration === 'number' ? log.actualDuration : 0,
    dayName: log.dayName,
    focus: log.focus,
    exercises: (log.exercises ?? []).map((exercise) => ({
      exerciseName: exercise.exerciseName,
      completed: exercise.completed,
      skipped: exercise.skipped,
      actualDuration: exercise.actualDuration,
      plannedDuration: exercise.plannedDuration,
    })),
  }));

  return evaluateAdaptationDecision(normalizedLogs, profileToConstraints(profile));
};
