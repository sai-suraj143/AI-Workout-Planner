/**
 * TEMPORARY helper for the Phase 2 HTTP verification script: connects to the
 * dev database and removes the throwaway users it created (plus everything
 * they own). Deleted together with the other verification files.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from './config/database';
import { User } from './models/User';
import { FitnessProfile } from './models/FitnessProfile';
import { WorkoutPlan } from './models/WorkoutPlan';

dotenv.config();

export const connect = async (): Promise<void> => {
  await connectDB();
};

export const deleteUserAndData = async (emails: string[]): Promise<number> => {
  const users = await User.find({ email: { $in: emails } }).select('_id');
  const ids = users.map((user) => user._id);
  await WorkoutPlan.deleteMany({ userId: { $in: ids } });
  await FitnessProfile.deleteMany({ userId: { $in: ids } });
  const deleted = await User.deleteMany({ _id: { $in: ids } });
  return deleted.deletedCount ?? 0;
};

// The HTTP script imports `connectDB` under that name too.
export { connectDB };
