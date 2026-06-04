// license.service.ts
// Validates BigO desktop license keys and tracks usage.

import { prisma } from '../../config/database';
import { PlanTier } from '@prisma/client';
import { logger } from '../../shared/logger';
import { randomBytes } from 'crypto';

// Free-tier daily solve limit for unlicensed devices
export const FREE_DAILY_LIMIT = 5;

// Plan tier → unlimited solves?
const UNLIMITED_PLANS: PlanTier[] = [PlanTier.BASIC, PlanTier.PRO, PlanTier.ENTERPRISE];

function isToday(date: Date | null): boolean {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  return d.getUTCFullYear() === now.getUTCFullYear()
    && d.getUTCMonth() === now.getUTCMonth()
    && d.getUTCDate() === now.getUTCDate();
}

export const licenseService = {
  // ── Key generation ────────────────────────────────────────────────────────

  generateKey(): string {
    const seg = () => randomBytes(2).toString('hex').toUpperCase();
    return `BIGO-${seg()}-${seg()}-${seg()}-${seg()}`;
  },

  // ── Validation ────────────────────────────────────────────────────────────

  async validateLicense(licenseKey: string, deviceId: string): Promise<{
    valid: boolean;
    plan: string;
    solvesUsedToday: number;
    solvesLimit: number | null;
    email?: string;
    expiresAt?: string | null;
    error?: string;
  }> {
    const license = await prisma.license.findUnique({ where: { key: licenseKey } });

    if (!license || !license.isActive) {
      return { valid: false, plan: 'free', solvesUsedToday: 0, solvesLimit: FREE_DAILY_LIMIT, error: 'Invalid or inactive license key.' };
    }

    if (license.expiresAt && license.expiresAt < new Date()) {
      return { valid: false, plan: 'free', solvesUsedToday: 0, solvesLimit: FREE_DAILY_LIMIT, error: 'License key has expired.' };
    }

    // Register device if not already registered
    if (!license.activatedDevices.includes(deviceId)) {
      if (license.activatedDevices.length >= license.maxDevices) {
        return {
          valid: false,
          plan: 'free',
          solvesUsedToday: 0,
          solvesLimit: FREE_DAILY_LIMIT,
          error: `Device limit reached (${license.maxDevices} devices). Deactivate a device in your dashboard.`,
        };
      }
      await prisma.license.update({
        where: { key: licenseKey },
        data: { activatedDevices: { push: deviceId } },
      });
    }

    const unlimited = UNLIMITED_PLANS.includes(license.plan);
    const solvesUsedToday = isToday(license.lastSolveDate) ? license.dailySolveCount : 0;

    return {
      valid: true,
      plan: license.plan.toLowerCase(),
      solvesUsedToday,
      solvesLimit: unlimited ? null : FREE_DAILY_LIMIT,
      email: license.email ?? undefined,
      expiresAt: license.expiresAt?.toISOString() ?? null,
    };
  },

  // ── Track solve ───────────────────────────────────────────────────────────

  async trackSolve(licenseKey: string | null, deviceId: string): Promise<{
    ok: boolean;
    solvesUsedToday: number;
    solvesLimit: number | null;
    blocked: boolean;
    error?: string;
  }> {
    // ── Licensed user ────────────────────────────────────────────────────────
    if (licenseKey) {
      const license = await prisma.license.findUnique({ where: { key: licenseKey } });

      if (!license || !license.isActive) {
        return { ok: false, solvesUsedToday: 0, solvesLimit: FREE_DAILY_LIMIT, blocked: true, error: 'Invalid license.' };
      }

      const unlimited = UNLIMITED_PLANS.includes(license.plan);
      if (unlimited) {
        // Increment counter for analytics but never block
        await prisma.license.update({
          where: { key: licenseKey },
          data: {
            dailySolveCount: isToday(license.lastSolveDate) ? { increment: 1 } : 1,
            lastSolveDate: new Date(),
          },
        });
        const updated = await prisma.license.findUnique({ where: { key: licenseKey } });
        return { ok: true, solvesUsedToday: updated?.dailySolveCount ?? 1, solvesLimit: null, blocked: false };
      }

      // Free/Basic — enforce daily limit
      const usedToday = isToday(license.lastSolveDate) ? license.dailySolveCount : 0;
      if (usedToday >= FREE_DAILY_LIMIT) {
        return { ok: false, solvesUsedToday: usedToday, solvesLimit: FREE_DAILY_LIMIT, blocked: true };
      }

      await prisma.license.update({
        where: { key: licenseKey },
        data: {
          dailySolveCount: isToday(license.lastSolveDate) ? { increment: 1 } : 1,
          lastSolveDate: new Date(),
        },
      });
      return { ok: true, solvesUsedToday: usedToday + 1, solvesLimit: FREE_DAILY_LIMIT, blocked: false };
    }

    // ── Anonymous / free-tier device ─────────────────────────────────────────
    const device = await prisma.deviceUsage.upsert({
      where: { deviceId },
      create: { deviceId, dailySolveCount: 0, lastSolveDate: null },
      update: {},
    });

    const usedToday = isToday(device.lastSolveDate) ? device.dailySolveCount : 0;
    if (usedToday >= FREE_DAILY_LIMIT) {
      return { ok: false, solvesUsedToday: usedToday, solvesLimit: FREE_DAILY_LIMIT, blocked: true };
    }

    await prisma.deviceUsage.update({
      where: { deviceId },
      data: {
        dailySolveCount: isToday(device.lastSolveDate) ? { increment: 1 } : 1,
        lastSolveDate: new Date(),
      },
    });
    return { ok: true, solvesUsedToday: usedToday + 1, solvesLimit: FREE_DAILY_LIMIT, blocked: false };
  },

  // ── Create license on payment ─────────────────────────────────────────────

  async createLicenseForPayment(opts: {
    email: string;
    plan: PlanTier;
    paymentId: string;
    expiresAt?: Date;
  }): Promise<string> {
    const key = licenseService.generateKey();
    await prisma.license.create({
      data: {
        key,
        email: opts.email,
        plan: opts.plan,
        paymentId: opts.paymentId,
        expiresAt: opts.expiresAt ?? null,
        maxDevices: 3,
      },
    });
    logger.info({ key, email: opts.email, plan: opts.plan }, '[License] created');
    return key;
  },
};
