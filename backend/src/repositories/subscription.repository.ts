import {
  Prisma,
  SubscriptionPlan,
  SubscriptionStatus,
  UserSubscription,
} from '@prisma/client';
import { prisma } from '../config/database';

export type SubscriptionWithPlan = UserSubscription & {
  plan: SubscriptionPlan;
};

export const subscriptionRepository = {
  findPlanById(id: string): Promise<SubscriptionPlan | null> {
    return prisma.subscriptionPlan.findUnique({ where: { id } });
  },

  findAllActivePlans(): Promise<SubscriptionPlan[]> {
    return prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { priceMonthly: 'asc' },
    });
  },

  /**
   * Get the user's current ACTIVE subscription (with plan details).
   * Returns null if they have no active plan.
   */
  findActiveByUserId(userId: string): Promise<SubscriptionWithPlan | null> {
    return prisma.userSubscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  findById(id: string): Promise<SubscriptionWithPlan | null> {
    return prisma.userSubscription.findUnique({
      where: { id },
      include: { plan: true },
    });
  },

  /**
   * Create a new subscription — called during payment activation.
   */
  create(
    data: Prisma.UserSubscriptionCreateInput,
  ): Promise<UserSubscription> {
    return prisma.userSubscription.create({ data });
  },

  update(
    id: string,
    data: Prisma.UserSubscriptionUpdateInput,
  ): Promise<UserSubscription> {
    return prisma.userSubscription.update({ where: { id }, data });
  },

  /**
   * Atomically decrement remainingSeconds.
   * Uses a raw UPDATE WHERE remainingSeconds >= amount to prevent over-deduction.
   * Returns number of rows updated (0 = quota exhausted).
   */
  async atomicDeductSeconds(
    subscriptionId: string,
    seconds: number,
  ): Promise<{ updated: boolean; remaining: number }> {
    const result = await prisma.$executeRaw`
      UPDATE "UserSubscription"
      SET "remainingSeconds" = "remainingSeconds" - ${seconds},
          "updatedAt"        = NOW()
      WHERE id = ${subscriptionId}
        AND "remainingSeconds" >= ${seconds}
        AND status = 'ACTIVE'
    `;

    if (result === 0) {
      // Quota exhausted — set remaining to 0 and fetch
      await prisma.$executeRaw`
        UPDATE "UserSubscription"
        SET "remainingSeconds" = 0,
            "updatedAt"        = NOW()
        WHERE id = ${subscriptionId}
          AND "remainingSeconds" < ${seconds}
      `;
      return { updated: false, remaining: 0 };
    }

    const sub = await prisma.userSubscription.findUnique({
      where: { id: subscriptionId },
      select: { remainingSeconds: true },
    });

    return { updated: true, remaining: sub?.remainingSeconds ?? 0 };
  },

  /**
   * Atomically add seconds (admin grant or refund).
   */
  atomicGrantSeconds(subscriptionId: string, seconds: number): Promise<number> {
    return prisma.$executeRaw`
      UPDATE "UserSubscription"
      SET "remainingSeconds" = "remainingSeconds" + ${seconds},
          "updatedAt"        = NOW()
      WHERE id = ${subscriptionId}
    `;
  },

  findManyByUserId(
    userId: string,
    status?: SubscriptionStatus,
  ): Promise<SubscriptionWithPlan[]> {
    return prisma.userSubscription.findMany({
      where: { userId, ...(status ? { status } : {}) },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  },
};
