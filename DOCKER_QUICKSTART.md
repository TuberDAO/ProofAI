# ProofAI Docker Quick Start

## 🚀 One-Command Deploy

```bash
# 1. Copy env template
cp env.example .env

# 2. Edit .env with your credentials
# Required: SERVER_WALLET_PRIVATE_KEY, PROVIDER_ADDRESS, JOB_REGISTRY_ADDRESS

# 3. Start everything
docker compose up --build -d

# 4. Verify
curl http://localhost:8080/jobs/mode
```

## 📊 Health Checks

```bash
# API
curl http://localhost:8080/health

# Redis
docker compose exec redis redis-cli ping

# Logs
docker compose logs -f api
```

## 🔑 Required Environment Variables

```bash
SERVER_WALLET_PRIVATE_KEY=0x...    # Private key for server signer
PROVIDER_ADDRESS=0x...             # Provider wallet address  
JOB_REGISTRY_ADDRESS=0x...         # JobRegistry contract
REDIS_URL=redis://redis:6379       # Redis connection (auto in docker-compose)
```

## 🌐 Endpoints

| Service | Local | Docker Network |
|---------|-------|----------------|
| API (HTTP) | http://localhost:8080 | http://api:4000 |
| API (HTTPS) | https://localhost:8443 | - |
| Redis | localhost:6379 | redis:6379 |

## 🧪 Testing

```bash
# Smoke test (from host)
pnpm -C apps/server smoke:session

# Smoke test (inside container)
docker compose exec api node dist/scripts/session-smoke.js

# Rate limit test
for i in {1..150}; do curl -s http://localhost:8080/jobs/mode > /dev/null; done
# Should see 429 after ~120 requests
```

## 🔄 Common Operations

### Restart API (Redis persists)
```bash
docker compose restart api
```

### Clear Redis cache
```bash
docker compose exec redis redis-cli FLUSHALL
```

### View Redis keys
```bash
docker compose exec redis redis-cli KEYS "*"
```

### Update and redeploy
```bash
git pull
docker compose up --build -d
```

## 🛠️ Troubleshooting

### API won't start
```bash
# Check logs
docker compose logs api

# Check Redis connection
docker compose exec api ping redis
```

### "Redis connection error"
```bash
# Restart Redis
docker compose restart redis

# Check Redis logs
docker compose logs redis
```

### Reset everything
```bash
docker compose down -v
docker compose up --build
```

## 📁 File Structure

```
ProofAI/
├── docker-compose.yml          ← Service orchestration
├── env.example                 ← Environment template
├── caddy/
│   └── Caddyfile              ← Reverse proxy config
└── apps/server/
    ├── Dockerfile             ← Multi-stage build
    ├── src/
    │   ├── storage/redis.ts   ← Redis client
    │   ├── attestation/       ← TEE stubs
    │   └── receipt/           ← Anchoring stubs
    └── package.json           ← Now includes ioredis
```

## 🔒 Security Notes

- Caddy adds security headers automatically
- HTTPS uses self-signed cert (replace in prod)
- Container runs as non-root (UID 1001)
- Secrets via `.env` (NOT baked into image)

## 📚 Full Documentation

See `DOCKER_DEPLOYMENT.md` for complete guide.



