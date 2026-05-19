import { Request, Response, NextFunction } from 'express';
import { subscriptionService } from './subscription.service';
import { sendSuccess } from '../../shared/response';

export const subscriptionController = {
  /**
   * GET /api/subscriptions/plans
   * Public — list all available plans.
   */
  async listPlans(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plans = await subscriptionService.listPlans();
      sendSuccess(res, plans);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/subscriptions/plans/:planId
   * Public — get a single plan.
   */
  async getPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await subscriptionService.getPlan(req.params.planId);
      sendSuccess(res, plan);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/subscriptions/me
   * Authenticated — current user's active subscription.
   */
  async getMySubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sub = await subscriptionService.getActiveSubscription(req.user.id);
      sendSuccess(res, sub);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/subscriptions/me/history
   * Authenticated — all past and current subscriptions.
   */
  async getMyHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const subs = await subscriptionService.getUserSubscriptions(req.user.id);
      sendSuccess(res, subs);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/subscriptions/me/access
   * Quick quota check — used by the frontend to show remaining time.
   */
  async checkAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const access = await subscriptionService.checkAccess(req.user.id);
      sendSuccess(res, access);
    } catch (err) {
      next(err);
    }
  },
};
