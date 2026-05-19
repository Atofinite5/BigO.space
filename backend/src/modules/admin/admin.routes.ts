import { Router } from 'express';
import { adminController } from './admin.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/requireAdmin.middleware';

const router = Router();

// All admin routes require auth + admin role
router.use(requireAuth, requireAdmin);

// ─── Users ────────────────────────────────────────────────────────────────────

/** GET  /api/admin/users              — list users with pagination */
router.get('/users', adminController.listUsers);

/** GET  /api/admin/users/:userId      — user detail + sessions + payments */
router.get('/users/:userId', adminController.getUserDetail);

/** PATCH /api/admin/users/:userId/suspend   — suspend user */
router.patch('/users/:userId/suspend', adminController.suspendUser);

/** PATCH /api/admin/users/:userId/unsuspend */
router.patch('/users/:userId/unsuspend', adminController.unsuspendUser);

/** PATCH /api/admin/users/:userId/adjust-time
 *  Body: { seconds: number }  (positive = grant, negative = deduct) */
router.patch('/users/:userId/adjust-time', adminController.adjustTime);

// ─── Payments ─────────────────────────────────────────────────────────────────

/** GET /api/admin/payments */
router.get('/payments', adminController.listPayments);

// ─── Sessions ─────────────────────────────────────────────────────────────────

/** GET /api/admin/sessions */
router.get('/sessions', adminController.listSessions);

// ─── Audit Logs ───────────────────────────────────────────────────────────────

/** GET /api/admin/audit-logs */
router.get('/audit-logs', adminController.listAuditLogs);

export default router;
