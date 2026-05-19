import Redis from 'ioredis';
import { env } from './env';

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | undefined;
}

const createRedisClient = (): Redis => {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableReadyCheck: true,
  });

  client.on('connect', () => console.info('✅  Redis connected'));
  client.on('error', (err) => console.error('❌  Redis error:', err));
  client.on('close', () => console.warn('⚠️   Redis connection closed'));

  return client;
};

export const redisClient: Redis = global.__redis ?? createRedisClient();

if (process.env.NODE_ENV !== 'production') {
  global.__redis = redisClient;
}

export async function disconnectRedis(): Promise<void> {
  await redisClient.quit();
}
