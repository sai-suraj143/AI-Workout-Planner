import { Router } from 'express';
import { 
  startWorkout, 
  getActiveWorkout,
  getWorkoutById, 
  updateWorkout, 
  completeWorkout, 
  abandonWorkout,
  getWorkoutHistory 
} from '../controllers/workoutLogController';
import { requireAuth } from '../middleware/authMiddleware';
import { validateStartWorkout, validateUpdateWorkout } from '../validators/workoutLogValidators';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Start a workout session from a specific plan/day
router.post('/start', validateStartWorkout, startWorkout);

// Find an active log without creating one, so planned days can be viewed safely.
router.get('/active/:planId/:dayIndex', getActiveWorkout);

// Get a specific workout log by ID
router.get('/:id', getWorkoutById);

// Update an in-progress workout
router.put('/:id', validateUpdateWorkout, updateWorkout);

// Mark workout as completed
router.post('/:id/complete', completeWorkout);

// Mark workout as abandoned
router.post('/:id/abandon', abandonWorkout);

// Get workout history for the current user
router.get('/', getWorkoutHistory);

export default router;