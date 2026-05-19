import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z
    .string()
    .default('3000')
    .transform((v) => parseInt(v, 10)),
  LOG_LEVEL: z.string().default('info'),
  CORS_ORIGIN: z.string().default('http://localhost:3001'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Clerk
  CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required'),
  CLERK_PUBLISHABLE_KEY: z.string().min(1, 'CLERK_PUBLISHABLE_KEY is required'),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1, 'STRIPE_SECRET_KEY is required'),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, 'STRIPE_WEBHOOK_SECRET is required'),

  // Razorpay
  RAZORPAY_KEY_ID: z.string().min(1, 'RAZORPAY_KEY_ID is required'),
  RAZORPAY_KEY_SECRET: z.string().min(1, 'RAZORPAY_KEY_SECRET is required'),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1, 'RAZORPAY_WEBHOOK_SECRET is required'),

  // AI Providers (optional — stubs used if absent)
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),

  // Session behaviour
  SESSION_HEARTBEAT_INTERVAL_SECONDS: z
    .string()
    .default('30')
    .transform((v) => parseInt(v, 10)),
  SESSION_STALE_THRESHOLD_SECONDS: z
    .string()
    .default('300')
    .transform((v) => parseInt(v, 10)),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Invalid environment variables:\n');
  const errors = parsed.error.flatten().fieldErrors;
  Object.entries(errors).forEach(([field, messages]) => {
    console.error(`  ${field}: ${messages?.join(', ')}`);
  });
  console.error('\nFix the errors above and restart.');
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
