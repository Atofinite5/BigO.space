import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { env } from './config/env';
import { logger } from './shared/logger';
import { globalIpRateLimiter } from './middleware/rateLimiter.middleware';
import { errorHandler } from './middleware/errorHandler.middleware';

import authRoutes from './modules/auth/auth.routes';
import subscriptionRoutes from './modules/subscription/subscription.routes';
import sessionRoutes from './modules/ai-session/session.routes';
import paymentRoutes from './modules/payment/payment.routes';
import adminRoutes from './modules/admin/admin.routes';
import webhookRoutes from './modules/webhook/webhook.routes';
import licenseRoutes from './modules/license/license.routes';
import aiProxyRoutes from './modules/ai-proxy/ai-proxy.routes';

const app = express();

// ─────────────────────────────────────────────────────────────────────────────
// Security Headers
// ─────────────────────────────────────────────────────────────────────────────
app.use(helmet());

// ─────────────────────────────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// HTTP Request Logger
// ─────────────────────────────────────────────────────────────────────────────
app.use(pinoHttp({ logger }));

// ─────────────────────────────────────────────────────────────────────────────
// Raw Body for Webhooks (MUST come before express.json)
// Webhook routes need the raw Buffer for signature verification.
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/webhooks', express.raw({ type: '*/*', limit: '1mb' }));

// ─────────────────────────────────────────────────────────────────────────────
// JSON Body Parser (all other routes)
// /api/ai/* needs a higher limit — screenshots are base64-encoded PNGs
// (~300KB each × 4 = ~1.2MB before base64 overhead → 10mb is safe).
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/ai', express.json({ limit: '10mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─────────────────────────────────────────────────────────────────────────────
// Global IP Rate Limiter
// ─────────────────────────────────────────────────────────────────────────────
app.use(globalIpRateLimiter);

// ─────────────────────────────────────────────────────────────────────────────
// Health Check (unauthenticated)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'bigo-backend',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/webhooks', webhookRoutes);     // Raw body — registered first
app.use('/api/auth', authRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/licenses', licenseRoutes);    // Desktop app license validation
app.use('/api/ai', aiProxyRoutes);          // Groq proxy — free tier AI for desktop app

// ─────────────────────────────────────────────────────────────────────────────
// 404 Catch-All
// ─────────────────────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found' },
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Global Error Handler (must be last)
// ─────────────────────────────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
