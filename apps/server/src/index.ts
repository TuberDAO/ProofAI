import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { env } from './config/env.js';
import { healthRoutes } from './routes/health.js';
import { jobRoutes } from './routes/jobs';
import { sessionRoutes } from './routes/sessions.js';
import { redis } from './storage/redis.js';

console.log('🚧 SKIP_ONCHAIN at boot:', process.env.SKIP_ONCHAIN);

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

// Register CORS - permissive for local development
// Allows: localhost, 127.0.0.1, and file:// origins (null)
fastify.register(cors, {
  origin: (origin, cb) => {
    // Allow requests with no origin (like file://) or null origin
    if (!origin || origin === 'null') {
      cb(null, true);
      return;
    }
    
    // Allow localhost and 127.0.0.1 on any port
    if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      cb(null, true);
      return;
    }
    
    // Reject all other origins
    cb(null, false);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-idempotency-key', 'x-session-id'],
  credentials: true,
});

// Register static file serving
// Choose a static dir that works both in TS sources and built dist
const candidates = [
  path.resolve(process.cwd(), 'apps/server/public'),  // dev
  path.resolve(process.cwd(), 'public')               // fallback
];
const staticRoot = candidates.find(p => fs.existsSync(p)) ?? candidates[0];

fastify.register(fastifyStatic, {
  root: staticRoot,
  prefix: '/',  // serve at web root
  index: ['index.html', 'demo.html'],
  decorateReply: false  // don't override reply.sendFile
});

// Optional convenience: GET / opens demo if present
fastify.get('/', async (req, reply) => {
  const demo = path.join(staticRoot, 'demo.html');
  if (fs.existsSync(demo)) {
    return reply.type('text/html').send(fs.readFileSync(demo, 'utf8'));
  }
  return { ok: true };
});

// Register routes
fastify.register(healthRoutes);
fastify.register(jobRoutes);
fastify.register(sessionRoutes);

// Log route registration for debugging
console.log('[ROUTE-REG] jobRoutes registered (mode endpoint should return chainId 6343)');

// Start server
const start = async () => {
  try {
    // Check Redis connection
    await redis.ping();
    console.log('✅ Redis OK');

    const port = Number(process.env.PORT ?? '8080');
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`Server listening on http://localhost:${port}`);
    console.log(`\n🚀 Server running on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

