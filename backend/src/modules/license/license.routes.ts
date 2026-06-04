// license.routes.ts
// Public routes — no Clerk auth required.
// The Electron app calls these before the user has an account.

import { Router } from 'express';
import { licenseController } from './license.controller';

const router = Router();

// POST /api/licenses/validate  — validate a license key + register device
router.post('/validate', licenseController.validate);

// POST /api/licenses/track-solve  — record a solve attempt, enforce quota
router.post('/track-solve', licenseController.trackSolve);

export default router;
