import { Router } from 'express';
import { webhookController } from './webhook.controller';

const router = Router();

/**
 * IMPORTANT: These routes use express.raw() to preserve the raw body
 * required for webhook signature verification.
 * They MUST NOT use express.json() middleware.
 */

/**
 * POST /api/webhooks/stripe
 */
router.post(
  '/stripe',
  // Raw body needed for Stripe signature verification
  (req, _res, next) => {
    if (Buffer.isBuffer(req.body)) {
      next();
    } else {
      next(); // Body already raw from app-level rawBody middleware on this path
    }
  },
  webhookController.handleStripe,
);

/**
 * POST /api/webhooks/razorpay
 */
router.post('/razorpay', webhookController.handleRazorpay);

export default router;
