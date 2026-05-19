import { SubscriptionPlan } from '@prisma/client';
import {
  subscriptionRepository,
  SubscriptionWithPlan,
} from '../../repositories/subscription.repository';
import { NotFoundError, SubscriptionRequiredError } from '../../shared/errors';

export const subscriptionService = {
  /**
   * List all publicly available plans.
   */
  listPlans(): Promise<SubscriptionPlan[]> {
    return subscriptionRepository.findAllActivePlans();
  },

  /**
   * Get a specific plan by ID.
   */
  async getPlan(planId: string): Promise<SubscriptionPlan> {
    const plan = await subscriptionRepository.findPlanById(planId);
    if (!plan) throw new NotFoundError('Plan');
    return plan;
  },

  /**
   * Get the user's current active subscription.
   */
  async getActiveSubscription(userId: string): Promise<SubscriptionWithPlan> {
    const sub = await subscriptionRepository.findActiveByUserId(userId);
    if (!sub) throw new SubscriptionRequiredError('No active subscription found.');
    return sub;
  },

  /**
   * Get all subscriptions for a user (history).
   */
  getUserSubscriptions(userId: string): Promise<SubscriptionWithPlan[]> {
    return subscriptionRepository.findManyByUserId(userId);
  },

  /**
   * Check if a user has access and return remaining quota.
   * Throws SubscriptionRequiredError or QuotaExhaustedError as appropriate.
   */
  async checkAccess(userId: string): Promise<{
    subscriptionId: string;
    remainingSeconds: number;
    remainingCalls: number;
    planName: string;
    expiresAt: Date;
  }> {
    const sub = await subscriptionRepository.findActiveByUserId(userId);
    if (!sub) throw new SubscriptionRequiredError();

    return {
      subscriptionId: sub.id,
      remainingSeconds: sub.remainingSeconds,
      remainingCalls: sub.remainingCalls,
      planName: sub.plan.name,
      expiresAt: sub.expiresAt,
    };
  },
};
