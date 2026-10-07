import { Request, Response, NextFunction } from 'express';
import { getAdaptationSummaryForUser } from '../services/adaptation/adaptation.service';
import { PlanServiceError, workoutPlanService } from '../services/workoutPlan.service';

const userIdOf = (req: Request): string | null => req.user?._id.toString() ?? null;

const respondWithServiceError = (res: Response, error: PlanServiceError): Response =>
  res.status(error.status).json({ success: false, message: error.message, code: error.code });

export const getAdaptationSummary = async (req: Request, res: Response, next: NextFunction) => {
  const userId = userIdOf(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  try {
    const outcome = await getAdaptationSummaryForUser(userId);
    return res.json({
      success: true,
      summary: outcome.summary,
      adherence: outcome.adherence,
      trend: outcome.trend,
      decision: outcome.decision,
      reasons: outcome.reasons,
      historyAvailable: outcome.historyAvailable,
    });
  } catch (error) {
    return next(error);
  }
};

export const generateAdaptivePlan = async (req: Request, res: Response, next: NextFunction) => {
  const userId = userIdOf(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  try {
    const { plan, adaptation } = await workoutPlanService.generateAdaptiveForUser(userId);
    return res.status(201).json({
      success: true,
      plan,
      adaptation: {
        summary: adaptation.summary,
        adherence: adaptation.adherence,
        trend: adaptation.trend,
        decision: adaptation.decision,
        reasons: adaptation.reasons,
        historyAvailable: adaptation.historyAvailable,
      },
    });
  } catch (error) {
    if (error instanceof PlanServiceError) {
      return respondWithServiceError(res, error);
    }
    return next(error);
  }
};
