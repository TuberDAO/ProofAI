# Docker Deployment Guide

## Quick Start

1. **Copy environment template:**
```bash
cp env.example .env
```

2. **Edit `.env` with your credentials:**
```bash
# Required fields:
SERVER_WALLET_PRIVATE_KEY=0x...
PROVIDER_ADDRESS=0x...
JOB_REGISTRY_ADDRESS=0x...
```

3. **Start all services:**
```bash
docker compose up --build
```

4. **Verify deployment:**
```bash
# Check API health
curl http://localhost:8080/health

# Check signing mode
curl http://localhost:8080/jobs/mode

# Verify Redis persistence
docker compose restart api
curl http://localhost:8080/jobs/mode  # Should still work
```

## Architecture

```
                                ┌─────────┐
                                │ Caddy   │
                                │ :8080   │ HTTP
                                │ :8443   │ HTTPS (self-signed)
                                └────┬────┘
                                     │
                                     ▼
                          ┌──────────────────┐
                          │   Fastify API    │
                          │     :4000        │
                          └────┬─────────────┘
                               │
                               ▼
                          ┌─────────┐
                          │  Redis  │
                          │  :6379  │
                          └─────────┘
```

## Services

### Redis
- **Image:** `redis:7-alpine`
- **Port:** 6379
- **Persistence:** Enabled with AOF (appendonly yes)
- **Volume:** `redis-data`
- **Purpose:** 
  - Session storage
  - Idempotency cache
  - Replay protection
  - Rate limiting

### API
- **Build:** Multi-stage Dockerfile (node:20-alpine)
- **Port:** 4000
- **Environment:** Production
- **User:** Non-root (nodejs:nodejs)
- **Purpose:** Fastify backend with all business logic

### Caddy
- **Image:** `caddy:2-alpine`
- **Ports:** 
  - 8080 (HTTP)
  - 8443 (HTTPS with self-signed cert)
- **Purpose:** Reverse proxy with security headers

## Redis Key Patterns

All keys have automatic expiration (TTL):

| Pattern | Purpose | TTL |
|---------|---------|-----|
| `session:{id}` | User sessions | 15-30 min |
| `idempotency:{key}` | Request deduplication | 10 min |
| `replay:{hash}` | Nonce replay protection | 15 min |
| `ratelimit:ip:{ip}` | Per-IP rate limits | 5 min |
| `ratelimit:session:{id}` | Per-session rate limits | 5 min |

## Security Features

### Headers (via Caddy)
- `Strict-Transport-Security`: HSTS with preload
- `X-Content-Type-Options`: nosniff
- `X-Frame-Options`: DENY
- `Referrer-Policy`: no-referrer
- Server header removed

### Rate Limiting (Redis Token Bucket)
- IP-based: 120 req/min (configurable)
- Session-based: 30 jobs/min (configurable)
- Atomic operations via Lua script

### Attestation & Receipts
- TEE quote verification (stubbed for Intel/AMD/NVIDIA)
- Receipt anchoring to blockchain (stubbed for batching)
- Enclave digest in all job responses

## Environment Variables

### Required
```bash
SERVER_WALLET_PRIVATE_KEY   # Server signer private key
PROVIDER_ADDRESS            # Provider wallet address
JOB_REGISTRY_ADDRESS        # Smart contract V1
REDIS_URL                   # Redis connection string
```

### Optional
```bash
JOB_REGISTRY_V2_ADDRESS     # Smart contract V2
SIGNING_MODE                # "server" or "client" (default: server)
ALLOWED_CHAIN_IDS           # CSV list (default: 6342)
ALLOWED_CONTRACTS           # CSV list
ALLOWED_MODELS              # CSV list (default: llama-3-8b-instruct)
RATE_LIMIT_BURST            # Burst capacity (default: 10)
SESSION_MAX_MINUTES         # Max session lifetime (default: 30)
```

## Development vs Production

### Local Development
```bash
# Run Redis only
docker compose up redis -d

# Run API locally
cd apps/server
pnpm install
pnpm dev
```

### Production
```bash
# Use production compose with secrets management
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Smoke Testing

### From Host
```bash
# Test with local Redis
pnpm -C apps/server smoke:session
```

### Against Docker
```bash
# Exec into container
docker compose exec api sh
node dist/scripts/session-smoke.js
```

## Monitoring

### Logs
```bash
# All services
docker compose logs -f

# API only
docker compose logs -f api

# Caddy access logs
docker compose logs -f caddy | jq '.request'
```

### Health Checks
```bash
# API
curl http://localhost:8080/health

# Redis
docker compose exec redis redis-cli ping
```

### Metrics
```bash
# Redis stats
docker compose exec redis redis-cli INFO stats

# Session count
docker compose exec redis redis-cli KEYS "session:*" | wc -l

# Rate limit state for IP
docker compose exec redis redis-cli HGETALL "ratelimit:ip:127.0.0.1"
```

## Troubleshooting

### Redis Connection Failed
```bash
# Check Redis is running
docker compose ps redis

# Check network
docker compose exec api ping redis
```

### API Won't Start
```bash
# Check env vars
docker compose config

# Check build logs
docker compose build api --progress=plain

# Check runtime logs
docker compose logs api
```

### Rate Limit Issues
```bash
# Clear all rate limits
docker compose exec redis redis-cli KEYS "ratelimit:*" | xargs redis-cli DEL

# Check specific bucket
docker compose exec redis redis-cli HGETALL "ratelimit:session:abc123"
```

## Upgrading

### Zero-Downtime Upgrade
```bash
# Pull new images
docker compose pull

# Rebuild API
docker compose build api

# Rolling restart
docker compose up -d --no-deps --build api

# Caddy can be restarted separately if needed
docker compose restart caddy
```

### Data Migration
Redis data persists in the `redis-data` volume:
```bash
# Backup
docker compose exec redis redis-cli SAVE
docker cp proofai-redis:/data/dump.rdb ./redis-backup.rdb

# Restore
docker cp ./redis-backup.rdb proofai-redis:/data/dump.rdb
docker compose restart redis
```

## Next Steps (TEE Integration)

The following are stubbed and ready for real implementation:

1. **`apps/server/src/attestation/verify.ts`**
   - Replace `verifyQuote()` with Intel SGX DCAP, AMD SEV-SNP, or NVIDIA attestation verification
   - Parse quote structure to detect vendor
   - Validate enclave measurements (MRENCLAVE, MRSIGNER)
   - Check TCB status

2. **`apps/server/src/receipt/anchor.ts`**
   - Implement batch accumulator (collect 100 receipts)
   - Build Merkle tree from batch
   - Submit root to on-chain registry with retry + idempotency
   - Store Merkle proofs for verification

3. **Environment Variables**
   - Add `TEE_VENDOR=intel|amd|nvidia`
   - Add `ANCHOR_BATCH_SIZE=100`
   - Add `ANCHOR_INTERVAL_SEC=300`

## License

MIT




