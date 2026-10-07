import { z } from 'zod';

/**
 * Validation schemas for workout log endpoints
 */

// Schema for starting a workout
export const startWorkoutSchema = z.object({
  planId: z.string().nonempty('Plan ID is required'),
  dayIndex: z.number().int().min(0).max(6),
});

// Schema for updating a workout
export const updateWorkoutSchema = z.object({
  actualDuration: z.number().int().min(0).optional(),
  exercises: z.array(
    z.object({
      _id: z.string().nonempty(),
      // Allowed to be empty: AI-generated plans often have no exerciseId (see
      // WorkoutExerciseLogSchema). Analytics groups by exerciseName instead.
      exerciseId: z.string(),
      exerciseName: z.string().nonempty(),
      plannedSets: z.number().int().min(0).optional(),
      plannedReps: z.number().int().min(0).optional(),
      plannedDuration: z.number().int().min(0).optional(),
      actualSets: z.number().int().min(0).optional(),
      actualReps: z.number().int().min(0).optional(),
      actualDuration: z.number().int().min(0).optional(),
      completed: z.boolean(),
      skipped: z.boolean(),
      notes: z.string().optional().nullable(),
    })
  ).optional(),
  notes: z.string().optional().nullable(),
});

// Empty schema for completion/abandonment (no body needed)
export const workoutActionSchema = z.object({});

/**
 * Type inference helpers
 */
export type StartWorkoutValues = z.infer<typeof startWorkoutSchema>;
export type UpdateWorkoutValues = z.infer<typeof updateWorkoutSchema>;

// Middleware to validate request bodies
export const validateStartWorkout = (req: any, res: any, next: any) => {
  try {
    startWorkoutSchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid input', 
        errors: error.format() 
      });
    }
    throw error;
  }
};

export const validateUpdateWorkout = (req: any, res: any, next: any) => {
  try {
    updateWorkoutSchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid input', 
        errors: error.format() 
      });
    }
    throw error;
  }
};