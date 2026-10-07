import { Router } from 'express';
import {
  generateAdaptivePlan,
  generatePlan,
  getPlans,
  getPlanById,
  deletePlan,
  substituteExercise,
  regenerateDay,
} from '../controllers/planController';
import { requireAuth } from '../middleware/authMiddleware';
import rateLimit from 'express-rate-limit';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Rate limiting for plan generation (expensive AI operation). High enough that
// normal development and manual testing are not throttled, low enough that the
// endpoint cannot be used as an unbounded Gemini proxy.
const generatePlanLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 generations per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many workout plan generations. Please wait before trying again.'
    });
  }
});

// Generate a new workout plan
router.post('/generate', generatePlanLimiter, generatePlan);

// Generate an adaptive workout plan for the current user
router.post('/generate-adaptive', generatePlanLimiter, generateAdaptivePlan);

// Replace a single exercise in a single day, keeping the rest of the plan intact.
router.post('/:planId/days/:dayIndex/exercises/:exerciseIndex/substitute', substituteExercise);

// Regenerate a single target day while preserving all other days.
router.post('/:planId/days/:dayIndex/regenerate', regenerateDay);

// Get all workout plans for the current user
router.get('/', getPlans);

// Get a specific workout plan by ID
router.get('/:id', getPlanById);

// Delete a workout plan by ID
router.delete('/:id', deletePlan);

export default router;