import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { paymentService } from './payment.service';
import { sendSuccess } from '../../shared/response';
import { ValidationError } from '../../shared/errors';

const createOrderSchema = z.object({
  provider: z.enum(['stripe', 'razorpay']),
  planId: z.string().min(1),
});

const verifySchema = z.object({
  provider: z.enum(['stripe', 'razorpay']),
  orderId: z.string().min(1),
  paymentId: z.string().min(1),
  planId: z.string().min(1),
  signature: z.string().optional(),
});

export const paymentController = {
  /**
   * POST /api/payments/create-order
   * Creates a provider-specific payment order/session.
   */
  async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Invalid request', parsed.error.errors);
      }
      const result = await paymentService.createOrder(
        parsed.data.provider,
        parsed.data.planId,
        req.user.id,
      );
      sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/payments/verify
   * Verifies client-side payment and activates the plan.
   */
  async verifyPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = verifySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Invalid request', parsed.error.errors);
      }
      const payment = await paymentService.verifyAndActivate(
        parsed.data.provider,
        parsed.data.orderId,
        parsed.data.paymentId,
        parsed.data.signature,
        req.user.id,
        parsed.data.planId,
      );
      sendSuccess(res, payment);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/payments/history
   */
  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const skip = parseInt((req.query.skip as string) ?? '0', 10);
      const take = parseInt((req.query.take as string) ?? '20', 10);
      const payments = await paymentService.getUserPayments(req.user.id, skip, take);
      sendSuccess(res, payments);
    } catch (err) {
      next(err);
    }
  },
};
