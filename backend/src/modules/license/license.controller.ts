// license.controller.ts

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
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
};
