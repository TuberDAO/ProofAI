import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env.js';
import { healthRoutes } from './routes/health.js';
import { jobRoutes } from './routes/jobs.js';

// Create Fastify instance with secure logging
const fastify = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
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

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: env.port, host: '0.0.0.0' });
    console.log(`\n🚀 Server running on http://localhost:${env.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

