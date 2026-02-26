# --- Stage 1: Dependencies ---
FROM node:20-alpine AS deps
WORKDIR /app

# Copy workspace package files
COPY aria/package.json aria/package-lock.json ./
COPY aria/apps/api/package.json ./apps/api/
COPY aria/apps/web/package.json ./apps/web/
COPY aria/packages/core/package.json ./packages/core/
COPY aria/packages/shared/package.json ./packages/shared/

# Install all dependencies
RUN npm ci --workspace=apps/api --workspace=apps/web --workspace=packages/core --workspace=packages/shared --include-workspace-root

# --- Stage 2: Build ---
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY aria/ ./

# Build shared → core → api → web
RUN npm run build --workspace=packages/shared 2>/dev/null || true && \
    npm run build --workspace=packages/core && \
    npm run build --workspace=apps/api && \
    npm run build --workspace=apps/web

# --- Stage 3: API Runner ---
FROM node:20-alpine AS api
WORKDIR /app

ENV NODE_ENV=production

# Copy built API
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/server.js"]

# --- Stage 4: Web Runner ---
FROM node:20-alpine AS web
WORKDIR /app

ENV NODE_ENV=production

# Copy Next.js standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./.next/static
COPY --from=builder /app/apps/web/public ./public

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
