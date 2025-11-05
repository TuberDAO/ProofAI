import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env.js';
import { healthRoutes } from './routes/health.js';
import { jobRoutes } from './routes/jobs.js';
import { sessionRoutes } from './routes/sessions.js';
import { redis } from './storage/redis.js';

// Check if pino-pretty is available (only in dev with devDependencies)
let usePrettyLogs = false;
if (process.env.NODE_ENV === 'development') {
  try {
    require.resolve('pino-pretty');
    usePrettyLogs = true;
  } catch {
    // pino-pretty not available, use standard JSON logs
  }
}

// Create Fastify instance with secure logging
const fastify = Fastify({
  logger: {
    level: 'info',
    // Only use pino-pretty if available
    ...(usePrettyLogs && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    }),
    // Redact sensitive fields from logs
    redact: {
      paths: [
        'req.headers.authorization',
        '*.privateKey',
        '*.prompt',
        'body.prompt',
      ],
      censor: '[REDACTED]',
    },
  },
});

// Register rate limiting (IP-based, env-configurable)
fastify.register(rateLimit, {
  max: env.rateLimitMax,
  timeWindow: env.rateLimitWindowMs,
  cache: 10000, // cache up to 10k IPs
});

// Register CORS with restricted origin
fastify.register(cors, {
  origin: env.allowedOrigin,
  credentials: true,
});

// Register routes
fastify.register(healthRoutes);
fastify.register(jobRoutes);
fastify.register(sessionRoutes);

// Start server
const start = async () => {
  try {
    // Check Redis connection
    await redis.ping();
    console.log('✅ Redis OK');

    await fastify.listen({ port: env.port, host: '0.0.0.0' });
    console.log(`\n🚀 Server running on http://localhost:${env.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

