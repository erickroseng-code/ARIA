# ── Aria API — Single-stage Docker Build ──────────────────────────────────────
# Build context: aria/ (monorepo root)
# Build command: docker build -t aria-api -f aria/apps/api/Dockerfile aria/
# Run command:   docker run --env-file aria/.env -p 3001:3001 aria-api

FROM node:20-alpine

# Required for native addons (e.g. better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy workspace manifest files first
COPY package.json package-lock.json turbo.json ./
COPY tsconfig.base.json ./

# Copy all package manifests using wildcards to preserve structure if needed, or just copy the folders.
# Since this is single stage, it's safe to copy the whole source code directly before npm ci to keep it simple,
# but we can preserve layer caching for npm modules:
COPY packages/core/package.json ./packages/core/
COPY packages/integrations/package.json ./packages/integrations/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install all workspace dependencies (respects npm workspaces + symlinks)
RUN npm ci

# Copy full source code
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Generate Prisma client before building
RUN npx prisma generate --schema=./apps/api/prisma/schema.prisma

# Build the API and its dependencies via turbo
# We use --force to ensure it always builds even if previous cache was bad
RUN npx turbo run build --filter=./apps/api... --force

# Directory for SQLite in production
RUN mkdir -p /app/data

WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# Health check built-in (Story 11.2 adds the /health endpoint)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/apps/api/src/server.js"]
