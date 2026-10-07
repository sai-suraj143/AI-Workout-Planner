import { Router } from 'express';
import { generatePlan, getPlans, getPlanById, deletePlan } from '../controllers/planController';
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

// Get all workout plans for the current user
router.get('/', getPlans);

// Get a specific workout plan by ID
router.get('/:id', getPlanById);

// Delete a workout plan by ID
router.delete('/:id', deletePlan);

export default router;