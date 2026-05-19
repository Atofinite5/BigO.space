import { Router } from 'express';
import { authController } from './auth.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();

// All auth routes require a valid Clerk token
router.use(requireAuth);

/**
 * GET /api/auth/me
 * Returns the current user's profile.
 */
router.get('/me', authController.getMe);

/**
 * PATCH /api/auth/me
 * Update name / avatarUrl from Clerk.
 */
router.patch('/me', authController.updateMe);

export default router;
