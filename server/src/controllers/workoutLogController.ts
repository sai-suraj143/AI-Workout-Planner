import { Request, Response, NextFunction } from 'express';
import { WorkoutLogServiceError, workoutLogService } from '../services/workoutLog.service';
import { validateStartWorkout, validateUpdateWorkout, StartWorkoutValues, UpdateWorkoutValues, workoutActionSchema } from '../validators/workoutLogValidators';
import z from 'zod';

/**
 * Thin controller: authenticate → delegate to the service → shape the response.
 *
 * No Gemini calls, no prompt text, no validation details live here — a failure
 * inside the service arrives as a `WorkoutLogServiceError` with a safe message and an
 * HTTP status; anything else falls through to the central error handler.
 */

const userIdOf = (req: Request): string | null => req.user?._id.toString() ?? null;

const respondWithServiceError = (res: Response, error: WorkoutLogServiceError): Response =>
  res.status(error.status).json({ success: false, message: error.message, code: error.code });

export const startWorkout = async (req: Request, res: Response, next: NextFunction) => {
  const userId = userIdOf(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  try {
    // Validate request body
    validateStartWorkout(req, res, () => {
      const { planId, dayIndex } = req.body as StartWorkoutValues;
      
      workoutLogService.startWorkout(userId, planId, dayIndex)
        .then(workoutLog => {
          return res.status(201).json({ success: true, workoutLog });
        })
        .catch(error => {
          if (error instanceof WorkoutLogServiceError) {
            return respondWithServiceError(res, error);
          }
          return next(error);
        });
    });
  } catch (error) {
    // Validation error will be caught here
    if (error instanceof WorkoutLogServiceError) {
      return respondWithServiceError(res, error);
    }
    return next(error);
  }
};

export const getActiveWorkout = async (req: Request, res: Response, next: NextFunction) => {
  const userId = userIdOf(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  const planId = typeof req.params.planId === 'string' ? req.params.planId : null;
  const dayIndex = Number(req.params.dayIndex);
  if (!planId || !Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) {
    return res.status(400).json({ success: false, message: 'Invalid plan or day' });
  }

  try {
    const workoutLog = await workoutLogService.getActiveWorkout(userId, planId, dayIndex);
    return res.json({ success: true, workoutLog });
  } catch (error) {
    return next(error);
  }
};

export const getWorkoutById = async (req: Request, res: Response, next: NextFunction) => {
  const userId = userIdOf(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  try {
    const workoutId = typeof req.params.id === 'string' ? req.params.id : null;
    if (!workoutId) {
      return res.status(400).json({ success: false, message: 'Invalid workout ID' });
    }

    const workoutLog = await workoutLogService.getWorkoutById(userId, workoutId);
    if (!workoutLog) {
      return res.status(404).json({ success: false, message: 'Workout log not found' });
    }

    return res.json({ success: true, workoutLog });
  } catch (error) {
    return next(error);
  }
};

export const updateWorkout = async (req: Request, res: Response, next: NextFunction) => {
  const userId = userIdOf(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  try {
    // Validate request body
    validateUpdateWorkout(req, res, () => {
      const workoutId = typeof req.params.id === 'string' ? req.params.id : null;
      if (!workoutId) {
        return res.status(400).json({ success: false, message: 'Invalid workout ID' });
      }

      workoutLogService.updateWorkout(userId, workoutId, req.body as UpdateWorkoutValues)
        .then(workoutLog => {
          if (!workoutLog) {
            return res.status(404).json({ success: false, message: 'Workout log not found or cannot be updated' });
          }

          return res.json({ success: true, workoutLog });
        })
        .catch(error => {
          if (error instanceof WorkoutLogServiceError) {
            return respondWithServiceError(res, error);
          }
          return next(error);
        });
    });
  } catch (error) {
    // Validation error will be caught here
    if (error instanceof WorkoutLogServiceError) {
      return respondWithServiceError(res, error);
    }
    return next(error);
  }
};

export const completeWorkout = async (req: Request, res: Response, next: NextFunction) => {
  const userId = userIdOf(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  try {
    // Validate request body (empty schema). The UI posts without a body at all,
    // so treat an absent body the same as `{}` instead of rejecting with 400.
    workoutActionSchema.parse(req.body ?? {});
    
    const workoutId = typeof req.params.id === 'string' ? req.params.id : null;
    if (!workoutId) {
      return res.status(400).json({ success: false, message: 'Invalid workout ID' });
    }

    const workoutLog = await workoutLogService.completeWorkout(userId, workoutId);
    if (!workoutLog) {
      return res.status(404).json({ success: false, message: 'Workout log not found or cannot be completed' });
    }

    return res.json({ success: true, workoutLog });
  } catch (error) {
    if (error instanceof WorkoutLogServiceError) {
      return respondWithServiceError(res, error);
    }
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid input', 
        errors: error.format() 
      });
    }
    return next(error);
  }
};

export const abandonWorkout = async (req: Request, res: Response, next: NextFunction) => {
  const userId = userIdOf(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  try {
    // Validate request body (empty schema). The UI posts without a body at all,
    // so treat an absent body the same as `{}` instead of rejecting with 400.
    workoutActionSchema.parse(req.body ?? {});
    
    const workoutId = typeof req.params.id === 'string' ? req.params.id : null;
    if (!workoutId) {
      return res.status(400).json({ success: false, message: 'Invalid workout ID' });
    }

    const workoutLog = await workoutLogService.abandonWorkout(userId, workoutId);
    if (!workoutLog) {
      return res.status(404).json({ success: false, message: 'Workout log not found or cannot be abandoned' });
    }

    return res.json({ success: true, workoutLog });
  } catch (error) {
    if (error instanceof WorkoutLogServiceError) {
      return respondWithServiceError(res, error);
    }
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid input', 
        errors: error.format() 
      });
    }
    return next(error);
  }
};

export const getWorkoutHistory = async (req: Request, res: Response, next: NextFunction) => {
  const userId = userIdOf(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const workoutLogs = await workoutLogService.getWorkoutHistory(userId, limit, offset);
    return res.json({ success: true, workoutLogs });
  } catch (error) {
    return next(error);
  }
};