import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { adminService } from './admin.service';
import { sendSuccess } from '../../shared/response';
import { ValidationError } from '../../shared/errors';

const adjustTimeSchema = z.object({
  seconds: z
    .number()
    .int()
    .refine((v) => v !== 0, 'Seconds must be non-zero'),
});

export const adminController = {
  // ─── Users ──────────────────────────────────────────────────────────────────

  async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const skip = parseInt((req.query.skip as string) ?? '0', 10);
      const take = parseInt((req.query.take as string) ?? '20', 10);
      const result = await adminService.listUsers(skip, take);
      sendSuccess(res, result.users, 200, { total: result.total, skip, take });
    } catch (err) {
      next(err);
    }
  },

  async getUserDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const detail = await adminService.getUserDetail(req.params.userId);
      sendSuccess(res, detail);
    } catch (err) {
      next(err);
    }
  },

  async suspendUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await adminService.suspendUser(req.params.userId, req.user.id);
      sendSuccess(res, { message: 'User suspended.' });
    } catch (err) {
      next(err);
    }
  },

  async unsuspendUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await adminService.unsuspendUser(req.params.userId, req.user.id);
      sendSuccess(res, { message: 'User unsuspended.' });
    } catch (err) {
      next(err);
    }
  },

  // ─── Time Management ────────────────────────────────────────────────────────

  async adjustTime(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = adjustTimeSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Invalid request', parsed.error.errors);
      }
      const sub = await adminService.adjustTime(
        req.params.userId,
        parsed.data.seconds,
        req.user.id,
      );
      sendSuccess(res, sub);
    } catch (err) {
      next(err);
    }
  },

  // ─── Payments ───────────────────────────────────────────────────────────────

  async listPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const skip = parseInt((req.query.skip as string) ?? '0', 10);
      const take = parseInt((req.query.take as string) ?? '50', 10);
      const payments = await adminService.listPayments(skip, take);
      sendSuccess(res, payments);
    } catch (err) {
      next(err);
    }
  },

  // ─── Sessions ───────────────────────────────────────────────────────────────

  async listSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const skip = parseInt((req.query.skip as string) ?? '0', 10);
      const take = parseInt((req.query.take as string) ?? '50', 10);
      const sessions = await adminService.listSessions(skip, take);
      sendSuccess(res, sessions);
    } catch (err) {
      next(err);
    }
  },

  // ─── Audit Logs ─────────────────────────────────────────────────────────────

  async listAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const skip = parseInt((req.query.skip as string) ?? '0', 10);
      const take = parseInt((req.query.take as string) ?? '50', 10);
      const logs = await adminService.listAuditLogs(skip, take);
      sendSuccess(res, logs);
    } catch (err) {
      next(err);
    }
  },
};
