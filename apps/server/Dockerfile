# Stage 1: Build
FROM node:20-alpine AS builder

# Enable Corepack and prepare pnpm version from package.json
RUN corepack enable

WORKDIR /app

# Copy package manager metadata first
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY tsconfig.base.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/contracts/package.json ./packages/contracts/

# Read pnpm version from "packageManager" in package.json; default to 8.15.4 if absent
RUN node -e "const p=require('./package.json'); const v=(p.packageManager||'pnpm@8.15.4').split('@')[1]; console.log(v)" > /tmp/pnpm-version \
 && corepack prepare pnpm@$(cat /tmp/pnpm-version) --activate \
 && pnpm --version

# Install all dependencies (prod + dev) for build stage
# Note: .npmrc contains shamefully-hoist=true for proper module resolution
RUN pnpm install

# Copy source code
COPY apps/server ./apps/server
COPY packages/contracts ./packages/contracts

# Build TypeScript from workspace root
RUN cd apps/server && ../../node_modules/.bin/tsc

# Verify build succeeded
RUN ls -la /app/apps/server/dist

# Stage 2: Runtime
FROM node:20-alpine

# Enable Corepack and prepare pnpm version from package.json
RUN corepack enable

# Create non-root user
RUN addgroup -g 1001 nodejs && \
    adduser -S -u 1001 -G nodejs nodejs

WORKDIR /app

# Copy workspace files
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/.npmrc ./
COPY --from=builder /app/tsconfig.base.json ./
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/packages/contracts/package.json ./packages/contracts/

# Read pnpm version from "packageManager" in package.json; default to 8.15.4 if absent
RUN node -e "const p=require('./package.json'); const v=(p.packageManager||'pnpm@8.15.4').split('@')[1]; console.log(v)" > /tmp/pnpm-version \
 && corepack prepare pnpm@$(cat /tmp/pnpm-version) --activate \
 && pnpm --version \
 && pnpm install --prod

# Copy built application
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/packages/contracts/typechain-types ./packages/contracts/typechain-types
COPY --from=builder /app/packages/contracts/artifacts ./packages/contracts/artifacts

# Copy static files (public directory)
COPY apps/server/public ./apps/server/public

# Change ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

WORKDIR /app/apps/server

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

CMD ["node", "dist/index.js"]

