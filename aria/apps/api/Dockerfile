# ── Aria API — Single-stage Docker Build ─────────────────────────────────────
# Build context: aria/ (monorepo root)
# Build command: docker build -t aria-api -f aria/apps/api/Dockerfile aria/
# Run command:   docker run --env-file aria/.env -p 3001:3001 aria-api

FROM node:22-alpine

# Required for native addons (e.g. better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy workspace manifest files for layer-cached npm install
COPY package.json package-lock.json turbo.json ./
COPY tsconfig.base.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/integrations/package.json ./packages/integrations/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install all workspace dependencies (creates workspace symlinks)
RUN npm ci

# Copy full source code (after npm ci for better layer caching)
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Generate Prisma client before building
RUN npx prisma generate --schema=./apps/api/prisma/schema.prisma

# Build each package manually forcing tsc (in case npm scripts/turbo are hiding errors or caching)
RUN cd /app/packages/shared && npx tsc -p tsconfig.json || true
RUN cd /app/packages/integrations && npx tsc -p tsconfig.json || true
RUN cd /app/packages/core && npx tsc -p tsconfig.json || true

# Diagnostic: verify what was actually built
RUN echo "--- INTEGRATIONS DIST ---" && ls -la /app/packages/integrations/dist || echo "MISSING"
RUN echo "--- CORE DIST ---" && ls -la /app/packages/core/dist || echo "MISSING"

RUN cd /app/apps/api && npm run build

# Replace workspace symlinks with real physical copies so Node.js can find
# the compiled modules reliably. npm workspaces creates symlinks
# (e.g. node_modules/@aria/core -> ../../packages/core) which can fail to
# resolve in some container environments.
RUN rm -rf /app/node_modules/@aria/core \
    && cp -rL /app/packages/core /app/node_modules/@aria/core
RUN rm -rf /app/node_modules/@aria/integrations \
    && cp -rL /app/packages/integrations /app/node_modules/@aria/integrations

# Directory for SQLite in production
RUN mkdir -p /app/data

WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/apps/api/src/server.js"]
