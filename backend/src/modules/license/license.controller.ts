// license.controller.ts

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PlanTier } from '@prisma/client';
import { licenseService } from './license.service';
import { sendSuccess } from '../../shared/response';

const validateSchema = z.object({
  licenseKey: z.string().min(10),
  deviceId: z.string().min(8),
});

const trackSchema = z.object({
  licenseKey: z.string().nullable().optional(),
  deviceId: z.string().min(8),
});

export const licenseController = {
  async validate(req: Request, res: Response, next: NextFunction) {
    try {
      const { licenseKey, deviceId } = validateSchema.parse(req.body);
      const result = await licenseService.validateLicense(licenseKey, deviceId);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },

  async trackSolve(req: Request, res: Response, next: NextFunction) {
    try {
      const { licenseKey, deviceId } = trackSchema.parse(req.body);
      const result = await licenseService.trackSolve(licenseKey ?? null, deviceId);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getByEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const email = z.string().email().parse(req.query.email);
      const license = await licenseService.getLicenseByEmail(email);
      sendSuccess(res, license);
    } catch (err) {
      next(err);
    }
  },

  async revoke(req: Request, res: Response, next: NextFunction) {
    try {
      const { key } = z.object({ key: z.string() }).parse(req.body);
      const ok = await licenseService.revoke(key);
      sendSuccess(res, { ok });
    } catch (err) {
      next(err);
    }
  },

  async deactivateBySubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const { stripeSubscriptionId } = z.object({ stripeSubscriptionId: z.string() }).parse(req.body);
      await licenseService.deactivateBySubscription(stripeSubscriptionId);
      sendSuccess(res, { ok: true });
    } catch (err) {
      next(err);
    }
  },

  async adminList(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await licenseService.adminList();
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, plan, paymentId, stripeSubscriptionId } = z.object({
        email: z.string().email(),
        plan: z.string().default('PRO'),
        paymentId: z.string(),
        stripeSubscriptionId: z.string().optional(),
      }).parse(req.body);

      const planTier = Object.values(PlanTier).includes(plan.toUpperCase() as PlanTier)
        ? (plan.toUpperCase() as PlanTier)
        : PlanTier.PRO;

      const licenseKey = await licenseService.createLicenseForPayment({
        email,
        plan: planTier,
        paymentId,
        stripeSubscriptionId,
      });

      sendSuccess(res, { licenseKey });
    } catch (err) {
      next(err);
    }
  },
};
