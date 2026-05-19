import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '../../../config/env';
import {
  CreateOrderInput,
  CreateOrderResult,
  PaymentProvider,
  VerifyPaymentInput,
  VerifyPaymentResult,
  WebhookEvent,
} from './payment.provider.interface';

export class RazorpayProvider implements PaymentProvider {
  readonly name = 'razorpay' as const;
  private readonly client: Razorpay;

  constructor() {
    this.client = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
  }

  /**
   * Creates a Razorpay order.
   * The frontend uses the returned orderId with the Razorpay JS SDK.
   */
  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const order = await this.client.orders.create({
      amount: input.amount, // In paise (INR) or cents — smallest unit
      currency: input.currency,
      receipt: `receipt_${Date.now()}`,
      notes: {
        userId: input.userId,
        planId: input.planId,
        ...input.metadata,
      },
    });

    return {
      orderId: order.id,
      amount: input.amount,
      currency: input.currency,
      providerData: {
        orderId: order.id,
        keyId: env.RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
      },
    };
  }

  /**
   * Verifies Razorpay payment using HMAC signature.
   * signature = HMAC_SHA256(orderId + "|" + paymentId, keySecret)
   */
  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const { orderId, paymentId, signature } = input;

    if (!signature) {
      return { verified: false, providerPaymentId: paymentId, amount: 0, currency: 'INR', metadata: {} };
    }

    const expectedSig = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const verified = expectedSig === signature;

    if (!verified) {
      return { verified: false, providerPaymentId: paymentId, amount: 0, currency: 'INR', metadata: {} };
    }

    // Fetch payment details from Razorpay
    const payment = await this.client.payments.fetch(paymentId);

    return {
      verified: true,
      providerPaymentId: payment.id,
      amount: Number(payment.amount),
      currency: payment.currency,
      metadata: payment.notes as Record<string, unknown>,
    };
  }

  /**
   * Parses and verifies a Razorpay webhook event.
   * Signature = HMAC_SHA256(rawBody, webhookSecret)
   */
  async parseWebhookEvent(
    rawBody: Buffer,
    signature: string,
  ): Promise<WebhookEvent | null> {
    const expectedSig = crypto
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    if (expectedSig !== signature) {
      throw new Error('Razorpay webhook signature verification failed');
    }

    const payload = JSON.parse(rawBody.toString()) as {
      event: string;
      payload: {
        payment?: {
          entity: {
            id: string;
            order_id: string;
            amount: number;
            currency: string;
            notes?: Record<string, string>;
          };
        };
      };
    };

    const COMPLETED_EVENTS = ['payment.captured', 'order.paid'];
    if (!COMPLETED_EVENTS.includes(payload.event)) return null;

    const payment = payload.payload.payment?.entity;
    if (!payment) return null;

    return {
      type: 'payment.completed',
      providerPaymentId: payment.id,
      providerOrderId: payment.order_id,
      userId: payment.notes?.userId,
      planId: payment.notes?.planId,
      amount: payment.amount,
      currency: payment.currency,
      idempotencyKey: payment.id,
      rawPayload: payload as unknown as Record<string, unknown>,
    };
  }
}
