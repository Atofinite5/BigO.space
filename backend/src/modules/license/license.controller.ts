// license.controller.ts

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PlanTier } from '@prisma/client';
import { licenseService } from './license.service';
import { successResponse } from '../../shared/response';

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
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  },

  async trackSolve(req: Request, res: Response, next: NextFunction) {
    try {
      const { licenseKey, deviceId } = trackSchema.parse(req.body);
      const result = await licenseService.trackSolve(licenseKey ?? null, deviceId);
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, plan, paymentId } = z.object({
        email: z.string().email(),
        plan: z.string().default('PRO'),
        paymentId: z.string(),
      }).parse(req.body);

      const planTier = (plan.toUpperCase() as PlanTier) in PlanTier
        ? (plan.toUpperCase() as PlanTier)
        : PlanTier.PRO;

      const licenseKey = await licenseService.createLicenseForPayment({
        email,
        plan: planTier,
        paymentId,
      });

      res.json(successResponse({ licenseKey }));
    } catch (err) {
      next(err);
    }
  },
};
