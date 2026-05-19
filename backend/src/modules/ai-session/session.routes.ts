import { Router } from 'express';
import { sessionController } from './session.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { planAwareRateLimiter } from '../../middleware/rateLimiter.middleware';

const router = Router();

// All session routes require authentication + plan-aware rate limiting
router.use(requireAuth);
router.use(planAwareRateLimiter());

/**
 * POST /api/sessions/start
 * Start a new AI session (call or interview).
 */
router.post('/start', sessionController.startSession);

/**
 * GET /api/sessions
 * List the user's sessions.
 */
router.get('/', sessionController.listSessions);

/**
 * GET /api/sessions/:sessionId
 */
router.get('/:sessionId', sessionController.getSession);

/**
 * POST /api/sessions/:sessionId/heartbeat
 * Sent every 30s while AI is active. Deducts quota.
 */
router.post('/:sessionId/heartbeat', sessionController.heartbeat);

/**
 * POST /api/sessions/:sessionId/end
 * Ends the session and does final billing.
 */
router.post('/:sessionId/end', sessionController.endSession);

/**
 * POST /api/sessions/:sessionId/pause
 */
router.post('/:sessionId/pause', sessionController.pauseSession);

/**
 * POST /api/sessions/:sessionId/resume
 */
router.post('/:sessionId/resume', sessionController.resumeSession);

export default router;
