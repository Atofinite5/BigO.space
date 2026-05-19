import { Payment } from '@prisma/client';
import { prisma } from '../../config/database';
import { subscriptionRepository } from '../../repositories/subscription.repository';
import { paymentRepository } from '../../repositories/payment.repository';
import { userRepository } from '../../repositories/user.repository';
import { StripeProvider } from './providers/stripe.provider';
import { RazorpayProvider } from './providers/razorpay.provider';
import {
  CreateOrderInput,
  CreateOrderResult,
  PaymentProvider,
} from './providers/payment.provider.interface';
import {
  NotFoundError,
  PaymentError,
} from '../../shared/errors';
import { logger } from '../../shared/logger';
import { invalidatePlanLimitCache } from '../../middleware/rateLimiter.middleware';

// ─── Provider Registry ────────────────────────────────────────────────────────

const providers: Record<string, PaymentProvider> = {
  stripe: new StripeProvider(),
  razorpay: new RazorpayProvider(),
};

function getProvider(name: string): PaymentProvider {
  const provider = providers[name];
  if (!provider) {
    throw new PaymentError(`Unsupported payment provider: ${name}`);
  }
  return provider;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const paymentService = {
  /**
   * Create a payment order with the specified provider.
   * Returns provider-specific data for the frontend checkout flow.
   */
  async createOrder(
    provider: string,
    planId: string,
    userId: string,
  ): Promise<CreateOrderResult> {
    const plan = await subscriptionRepository.findPlanById(planId);
    if (!plan || !plan.isActive) throw new NotFoundError('Plan');

    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('User');

    const p = getProvider(provider);
    const input: CreateOrderInput = {
      amount: Math.round(Number(plan.priceMonthly) * 100), // Convert to cents/paise
      currency: provider === 'razorpay' ? 'INR' : 'USD',
      planId,
      userId,
      userEmail: user.email,
    };

    return p.createOrder(input);
  },

  /**
   * Verify a client-side payment (called after user completes checkout).
   * Creates a pending Payment record and activates the plan.
   */
  async verifyAndActivate(
    provider: string,
    orderId: string,
    paymentId: string,
    signature: string | undefined,
    userId: string,
    planId: string,
  ): Promise<Payment> {
    const p = getProvider(provider);

    const verification = await p.verifyPayment({ orderId, paymentId, signature });
    if (!verification.verified) {
      throw new PaymentError('Payment verification failed. Please contact support.');
    }

    // Check idempotency — prevent double activation
    const existing = await paymentRepository.findByProviderPaymentId(paymentId);
    if (existing) {
      return existing; // Already processed
    }

    return paymentService.activatePlan({
      userId,
      planId,
      provider,
      providerPaymentId: verification.providerPaymentId,
      providerOrderId: orderId,
      amount: verification.amount,
      currency: verification.currency,
      idempotencyKey: paymentId,
      metadata: verification.metadata,
    });
  },

  /**
   * Activate a plan for a user. Called by verifyAndActivate or webhook handler.
   * Wrapped in a Prisma transaction for atomicity.
   */
  async activatePlan(params: {
    userId: string;
    planId: string;
    provider: string;
    providerPaymentId: string;
    providerOrderId?: string;
    amount: number;
    currency: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
  }): Promise<Payment> {
    const plan = await subscriptionRepository.findPlanById(params.planId);
    if (!plan) throw new NotFoundError('Plan');

    // Guard against double-activation
    const existingByKey = await paymentRepository.findByIdempotencyKey(
      params.idempotencyKey,
    );
    if (existingByKey) {
      logger.warn({ idempotencyKey: params.idempotencyKey }, 'Duplicate activation attempt blocked');
      return existingByKey;
    }

    return prisma.$transaction(async (tx) => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + plan.validityDays * 86400 * 1000);

      // Cancel any existing active subscription
      await tx.userSubscription.updateMany({
        where: { userId: params.userId, status: 'ACTIVE' },
        data: { status: 'CANCELLED', cancelledAt: now },
      });

      // Create payment record
      const payment = await tx.payment.create({
        data: {
          userId: params.userId,
          planId: params.planId,
          status: 'COMPLETED',
          amount: params.amount / 100, // Store in major currency unit
          currency: params.currency,
          provider: params.provider,
          providerPaymentId: params.providerPaymentId,
          providerOrderId: params.providerOrderId,
          idempotencyKey: params.idempotencyKey,
          metadata: params.metadata as object,
          paidAt: now,
        },
      });

      // Create new subscription
      await tx.userSubscription.create({
        data: {
          userId: params.userId,
          planId: params.planId,
          status: 'ACTIVE',
          remainingSeconds: plan.totalSecondsAllowed,
          remainingCalls: plan.aiCallsAllowed,
          startedAt: now,
          expiresAt,
          paymentId: payment.id,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          actorId: params.userId,
          targetId: params.userId,
          targetType: 'UserSubscription',
          action: 'ACTIVATE_PLAN',
          metadata: {
            planId: params.planId,
            provider: params.provider,
            paymentId: payment.id,
          },
        },
      });

      logger.info(
        { userId: params.userId, planId: params.planId, paymentId: payment.id },
        'Plan activated successfully',
      );

      // Invalidate rate limit cache so new plan limits apply immediately
      await invalidatePlanLimitCache(params.userId);

      return payment;
    });
  },

  /**
   * Get payment history for a user.
   */
  getUserPayments(userId: string, skip = 0, take = 20): Promise<Payment[]> {
    return paymentRepository.findManyByUserId(userId, { skip, take });
  },
};
