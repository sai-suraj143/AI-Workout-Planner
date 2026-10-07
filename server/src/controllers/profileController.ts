import { Request, Response, NextFunction } from 'express';
import { fitnessProfileSchema } from '../validators/profileValidators';
import { ProfileService } from '../services/profileService';
import { z, ZodError } from 'zod';
import { IFitnessProfile } from '../models/FitnessProfile';

export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?._id.toString();
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const profile = await ProfileService.getProfileByUserId(userId);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Fitness profile not found. Please complete onboarding.' });
    }

    res.json({ success: true, profile });
  } catch (error: unknown) {
    next(error);
  }
};

export const createOrUpdateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate input
    const parsed = fitnessProfileSchema.parse(req.body);
    const userId = req.user?._id.toString();
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    // Create or update profile
    const profile = await ProfileService.createOrUpdateProfile(userId, parsed as Partial<IFitnessProfile>);

    res.json({ success: true, profile });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      // Messages come from our own validators, so they are safe to show to the user.
      const firstIssue = error.issues[0];
      const detail = firstIssue?.message ?? 'Please review your answers and try again.';
      return res.status(400).json({
        success: false,
        message: detail,
        errors: error.issues,
      });
    }
    next(error);
  }
};