import { Request, Response, NextFunction } from 'express';
import { StripeProvider } from '../payment/providers/stripe.provider';
import { RazorpayProvider } from '../payment/providers/razorpay.provider';
import { webhookService } from './webhook.service';
import { logger } from '../../shared/logger';

const stripeProvider = new StripeProvider();
const razorpayProvider = new RazorpayProvider();

export const webhookController = {
  /**
   * POST /api/webhooks/stripe
   * Requires raw body — do NOT use express.json() for this route.
   */
  async handleStripe(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const signature = req.headers['stripe-signature'] as string;
      if (!signature) {
        res.status(400).json({ error: 'Missing stripe-signature header' });
        return;
      }

      const rawBody = req.body as Buffer;
      const event = await stripeProvider.parseWebhookEvent(rawBody, signature);

      if (event) {
        await webhookService.handleEvent(event, 'stripe');
      }

      // Always return 200 quickly — Stripe will retry on failure
      res.status(200).json({ received: true });
    } catch (err) {
      logger.error({ err }, 'Stripe webhook error');
      // Return 400 to signal Stripe not to retry a signature error
      res.status(400).json({ error: 'Webhook error' });
    }
  },

  /**
   * POST /api/webhooks/razorpay
   * Requires raw body.
   */
  async handleRazorpay(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const signature = req.headers['x-razorpay-signature'] as string;
      if (!signature) {
        res.status(400).json({ error: 'Missing x-razorpay-signature header' });
        return;
      }

      const rawBody = req.body as Buffer;
      const event = await razorpayProvider.parseWebhookEvent(rawBody, signature);

      if (event) {
        await webhookService.handleEvent(event, 'razorpay');
      }

      res.status(200).json({ received: true });
    } catch (err) {
      logger.error({ err }, 'Razorpay webhook error');
      res.status(400).json({ error: 'Webhook error' });
    }
  },
};
