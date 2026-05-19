import Stripe from 'stripe';
import { env } from '../../../config/env';
import {
  CreateOrderInput,
  CreateOrderResult,
  PaymentProvider,
  VerifyPaymentInput,
  VerifyPaymentResult,
  WebhookEvent,
} from './payment.provider.interface';

export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe' as const;
  private readonly stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-04-10',
      typescript: true,
    });
  }

  /**
   * Creates a Stripe Checkout Session.
   * The frontend redirects the user to the returned URL.
   */
  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: input.amount, // Already in cents
            product_data: {
              name: `Call Assistant — Plan Subscription`,
              metadata: { planId: input.planId },
            },
          },
          quantity: 1,
        },
      ],
      customer_email: input.userEmail,
      metadata: {
        userId: input.userId,
        planId: input.planId,
        ...input.metadata,
      },
      // Set your frontend success/cancel URLs via env if needed
      success_url: `${env.CORS_ORIGIN}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.CORS_ORIGIN}/payment/cancel`,
    });

    return {
      orderId: session.id,
      amount: input.amount,
      currency: input.currency,
      providerData: {
        checkoutUrl: session.url,
        sessionId: session.id,
      },
    };
  }

  /**
   * Retrieves and verifies a completed Checkout Session.
   */
  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const session = await this.stripe.checkout.sessions.retrieve(input.orderId, {
      expand: ['payment_intent'],
    });

    const pi = session.payment_intent as Stripe.PaymentIntent | null;
    const verified = session.payment_status === 'paid';

    return {
      verified,
      providerPaymentId: pi?.id ?? input.paymentId,
      amount: session.amount_total ?? 0,
      currency: session.currency?.toUpperCase() ?? 'USD',
      metadata: session.metadata as Record<string, unknown>,
    };
  }

  /**
   * Validates Stripe webhook signature and extracts payment data.
   */
  async parseWebhookEvent(
    rawBody: Buffer,
    signature: string,
  ): Promise<WebhookEvent | null> {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        env.STRIPE_WEBHOOK_SECRET,
      );
    } catch {
      throw new Error('Stripe webhook signature verification failed');
    }

    if (event.type !== 'checkout.session.completed') return null;

    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== 'paid') return null;

    const pi = session.payment_intent as string | null;

    return {
      type: 'payment.completed',
      providerPaymentId: pi ?? session.id,
      providerOrderId: session.id,
      userId: session.metadata?.userId,
      planId: session.metadata?.planId,
      amount: session.amount_total ?? 0,
      currency: (session.currency ?? 'usd').toUpperCase(),
      idempotencyKey: session.id,
      rawPayload: event as unknown as Record<string, unknown>,
    };
  }
}
