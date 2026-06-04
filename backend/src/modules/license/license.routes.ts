// license.routes.ts

import { Router, Request, Response, NextFunction } from 'express';
import { licenseController } from './license.controller';
import { env } from '../../config/env';

const router = Router();

// ── Public (called by Electron app) ──────────────────────────────────────────
// POST /api/licenses/validate  — validate a license key + register device
router.post('/validate', licenseController.validate);

// POST /api/licenses/track-solve  — record a solve attempt, enforce quota
router.post('/track-solve', licenseController.trackSolve);

// ── Internal (called by web app webhook) ─────────────────────────────────────
// Protect with a shared secret so only the web app can call this.
function requireInternalSecret(req: Request, res: Response, next: NextFunction) {
  const secret = req.headers['x-internal-secret'];
  if (!secret || secret !== (process.env.INTERNAL_API_SECRET || '')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

// POST /api/licenses/create  — called by Stripe webhook after payment
router.post('/create', requireInternalSecret, licenseController.create);

// GET /api/licenses/by-email  — called by web dashboard to show user's license
router.get('/by-email', requireInternalSecret, licenseController.getByEmail);

// POST /api/licenses/revoke  — admin: deactivate a license
router.post('/revoke', requireInternalSecret, licenseController.revoke);

// POST /api/licenses/deactivate-by-subscription — called when Stripe sub cancelled
router.post('/deactivate-by-subscription', requireInternalSecret, licenseController.deactivateBySubscription);

// GET /api/licenses/admin/list  — admin: list all licenses with stats
router.get('/admin/list', requireInternalSecret, licenseController.adminList);

export default router;
