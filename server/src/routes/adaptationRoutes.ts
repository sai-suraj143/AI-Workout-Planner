import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import { getAdaptationSummary } from '../controllers/adaptationController';

const router = Router();
router.use(requireAuth);

router.get('/summary', getAdaptationSummary);

export default router;
