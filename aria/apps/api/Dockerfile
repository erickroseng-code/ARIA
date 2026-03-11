# ── Aria API — Multi-stage Docker Build ──────────────────────────────────────
# Build context: aria/ (monorepo root)
# Build command: docker build -t aria-api -f aria/apps/api/Dockerfile aria/
# Run command:   docker run --env-file aria/.env -p 3001:3001 aria-api

# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS build

# Required for native addons (e.g. better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /monorepo

# Copy workspace manifest files first (better layer caching)
COPY package.json package-lock.json turbo.json ./
COPY tsconfig.base.json ./

# Copy packages source
COPY packages/core/package.json ./packages/core/
COPY packages/integrations/package.json ./packages/integrations/
COPY packages/shared/package.json ./packages/shared/

# Copy API source
COPY apps/api/package.json ./apps/api/

# Install all workspace dependencies (respects npm workspaces + symlinks)
RUN npm ci --include=dev

# Copy source code after deps (cache hit if only source changed)
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Build packages first (turbo respects dependency order: ^build)
RUN npx turbo run build --filter=./packages/core
RUN npx turbo run build --filter=./packages/integrations
RUN npx turbo run build --filter=./apps/api

# Prune devDependencies for runtime image
RUN npm prune --production

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

RUN apk add --no-cache python3 make g++

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# --- Core package ---
COPY --from=build /monorepo/packages/core/dist ./packages/core/dist
COPY --from=build /monorepo/packages/core/package.json ./packages/core/package.json

# --- Integrations package ---
COPY --from=build /monorepo/packages/integrations/dist ./packages/integrations/dist
COPY --from=build /monorepo/packages/integrations/package.json ./packages/integrations/package.json

# --- API dist and config ---
COPY --from=build /monorepo/apps/api/dist ./apps/api/dist
COPY --from=build /monorepo/apps/api/package.json ./apps/api/package.json
COPY --from=build /monorepo/apps/api/prisma ./apps/api/prisma

# --- Production node_modules (from root, without devDeps) ---
COPY --from=build /monorepo/node_modules ./node_modules

# Set up @aria/* symlinks so Node can resolve workspace packages
RUN mkdir -p node_modules/@aria && \
    ln -sf /app/packages/core node_modules/@aria/core && \
    ln -sf /app/packages/integrations node_modules/@aria/integrations

# Directory for SQLite in production
RUN mkdir -p /app/data

WORKDIR /app/apps/api

EXPOSE 3001

# Health check built-in (Story 11.2 adds the /health endpoint)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/apps/api/src/server.js"]
