import { Router } from 'express';
import { paymentController } from './payment.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

/**
 * POST /api/payments/create-order
 * Body: { provider: "stripe"|"razorpay", planId: string }
 */
router.post('/create-order', paymentController.createOrder);

/**
 * POST /api/payments/verify
 * Body: { provider, orderId, paymentId, planId, signature? }
 */
router.post('/verify', paymentController.verifyPayment);

/**
 * GET /api/payments/history
 */
router.get('/history', paymentController.getHistory);

export default router;
