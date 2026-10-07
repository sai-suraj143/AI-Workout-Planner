import { Router } from 'express';
import { getProfile, createOrUpdateProfile } from '../controllers/profileController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.get('/', requireAuth, getProfile);
router.put('/', requireAuth, createOrUpdateProfile);

export default router;