import { paymentService } from '../payment/payment.service';
import { WebhookEvent } from '../payment/providers/payment.provider.interface';
import { logger } from '../../shared/logger';

export const webhookService = {
  /**
   * Process a parsed webhook event.
   * Only handles payment.completed events — others are acknowledged and discarded.
   */
  async handleEvent(event: WebhookEvent, provider: string): Promise<void> {
    logger.info({ eventType: event.type, provider, idempotencyKey: event.idempotencyKey }, 'Webhook received');

    if (event.type !== 'payment.completed') {
      logger.info({ eventType: event.type }, 'Webhook event ignored — not a payment completion');
      return;
    }

    if (!event.userId || !event.planId) {
      logger.warn({ event }, 'Webhook missing userId or planId in metadata — cannot activate');
      return;
    }

    await paymentService.activatePlan({
      userId: event.userId,
      planId: event.planId,
      provider,
      providerPaymentId: event.providerPaymentId,
      providerOrderId: event.providerOrderId,
      amount: event.amount,
      currency: event.currency,
      idempotencyKey: event.idempotencyKey,
      metadata: event.rawPayload,
    });
  },
};
