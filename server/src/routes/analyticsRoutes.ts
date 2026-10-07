import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/authMiddleware';
import { getSummary, mapRangeToCutoff } from '../services/analyticsService';
import { AnalyticsServiceError } from '../services/analyticsService';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/analytics?range=7d|30d|90d
 *
 * Requires authentication. The authenticated userId is scoped;
 * no query param userId is accepted (derived from session only).
 * Range must be a positive number followed by d/w/m (e.g. 7d, 30d, 90m).
 * Invalid ranges receive 400 with Zod error details.
 */
const rangeQuerySchema = z.object({
  range: z.string().regex(/^\d+[dDwWmM]$/, 'Range must be a positive number followed by d/w/m (e.g. 7d, 30d, 90m).'),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate range query param with Zod
    const parsed = rangeQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: parsed.error.format(),
      });
    }

    const range = parsed.data.range;

    // All queries are scoped to the authenticated user — req.user is set by requireAuth
    const userId = (req.user as any)._id.toString();

    const cutoff = mapRangeToCutoff(range);

    const summary = await getSummary(userId, range, cutoff);

    return res.json({
      success: true,
      analytics: summary,
    });
  } catch (error) {
    if (error instanceof AnalyticsServiceError) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    }
    console.error('Analytics endpoint error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
    });
  }
});

export default router;