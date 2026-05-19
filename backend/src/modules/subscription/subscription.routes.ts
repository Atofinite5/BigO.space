import { Router } from 'express';
import { subscriptionController } from './subscription.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();

// ─── Public Routes ───────────────────────────────────────────────────────────

/**
 * GET /api/subscriptions/plans
 * List all active plans (public — shown on pricing page).
 */
router.get('/plans', subscriptionController.listPlans);

/**
 * GET /api/subscriptions/plans/:planId
 */
router.get('/plans/:planId', subscriptionController.getPlan);

// ─── Authenticated Routes ─────────────────────────────────────────────────────

router.use(requireAuth);

/**
 * GET /api/subscriptions/me
 * Current user's active subscription.
 */
router.get('/me', subscriptionController.getMySubscription);

/**
 * GET /api/subscriptions/me/history
 */
router.get('/me/history', subscriptionController.getMyHistory);

/**
 * GET /api/subscriptions/me/access
 * Quick check: remaining seconds, calls, expiry.
 */
router.get('/me/access', subscriptionController.checkAccess);

export default router;
