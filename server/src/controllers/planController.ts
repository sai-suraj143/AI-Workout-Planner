import { Request, Response, NextFunction } from 'express';
import { generateAdaptivePlan as createAdaptivePlan } from './adaptationController';
import { PlanServiceError, workoutPlanService } from '../services/workoutPlan.service';
import { exerciseSubstitutionRequestSchema, dayRegenerationRequestSchema } from '../validators/workoutPlanValidators';

/**
 * Thin controller: authenticate → delegate to the service → shape the response.
 *
 * No Gemini calls, no prompt text, no validation details live here — a failure
 * inside the service arrives as a `PlanServiceError` with a safe message and an
 * HTTP status; anything else falls through to the central error handler.
 */

const userIdOf = (req: Request): string | null => req.user?._id.toString() ?? null;

const respondWithServiceError = (res: Response, error: PlanServiceError): Response =>
  res.status(error.status).json({ success: false, message: error.message, code: error.code });

export const generatePlan = async (req: Request, res: Response, next: NextFunction) => {
  const userId = userIdOf(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  try {
    const plan = await workoutPlanService.generateForUser(userId);
    return res.status(201).json({ success: true, plan });
  } catch (error) {
    if (error instanceof PlanServiceError) {
      return respondWithServiceError(res, error);
    }
    return next(error);
  }
};

export const generateAdaptivePlan = async (req: Request, res: Response, next: NextFunction) => {
  return createAdaptivePlan(req, res, next);
};

export const getPlans = async (req: Request, res: Response, next: NextFunction) => {
  const userId = userIdOf(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  try {
    const plans = await workoutPlanService.listForUser(userId);
    return res.json({ success: true, plans });
  } catch (error) {
    return next(error);
  }
};

export const getPlanById = async (req: Request, res: Response, next: NextFunction) => {
  const userId = userIdOf(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  try {
    const planId = typeof req.params.id === 'string' ? req.params.id : null;
    const plan = planId ? await workoutPlanService.getForUser(userId, planId) : null;
    if (!plan) {
      // Same response for "not yours" and "does not exist" — no existence leak.
      return res.status(404).json({ success: false, message: 'Workout plan not found' });
    }
    return res.json({ success: true, plan });
  } catch (error) {
    return next(error);
  }
};

export const deletePlan = async (req: Request, res: Response, next: NextFunction) => {
  const userId = userIdOf(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  try {
    const planId = typeof req.params.id === 'string' ? req.params.id : null;
    const deleted = planId ? await workoutPlanService.deleteForUser(userId, planId) : null;
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Workout plan not found' });
    }
    return res.json({ success: true, message: 'Workout plan deleted successfully' });
  } catch (error) {
    return next(error);
  }
};

export const substituteExercise = async (req: Request, res: Response, next: NextFunction) => {
  const userId = userIdOf(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  try {
    const body = exerciseSubstitutionRequestSchema.parse(req.body);
    const dayIndex = Number(Array.isArray(req.params.dayIndex) ? req.params.dayIndex[0] : req.params.dayIndex);
    const exerciseIndex = Number(Array.isArray(req.params.exerciseIndex) ? req.params.exerciseIndex[0] : req.params.exerciseIndex);
    const planId = Array.isArray(req.params.planId) ? req.params.planId[0] : req.params.planId;

    const result = await workoutPlanService.substituteExerciseForUser(
      userId,
      planId,
      dayIndex,
      exerciseIndex,
      body,
    );

    return res.json({ success: true, day: result.day, exercise: result.exercise, plan: result.plan });
  } catch (error) {
    if (error instanceof PlanServiceError) {
      return respondWithServiceError(res, error);
    }
    if (error instanceof Error && 'issues' in error) {
      return res.status(400).json({ success: false, message: 'Invalid request body.', code: 'invalid_request' });
    }
    return next(error);
  }
};

export const regenerateDay = async (req: Request, res: Response, next: NextFunction) => {
  const userId = userIdOf(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  try {
    const body = dayRegenerationRequestSchema.parse(req.body ?? {});
    const dayIndex = Number(Array.isArray(req.params.dayIndex) ? req.params.dayIndex[0] : req.params.dayIndex);
    const planId = Array.isArray(req.params.planId) ? req.params.planId[0] : req.params.planId;

    const result = await workoutPlanService.regenerateDayForUser(userId, planId, dayIndex, body);
    return res.json({ success: true, day: result.day, plan: result.plan });
  } catch (error) {
    if (error instanceof PlanServiceError) {
      return respondWithServiceError(res, error);
    }
    if (error instanceof Error && 'issues' in error) {
      return res.status(400).json({ success: false, message: 'Invalid request body.', code: 'invalid_request' });
    }
    return next(error);
  }
};
