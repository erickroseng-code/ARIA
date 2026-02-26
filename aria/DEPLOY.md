# ARIA — Production Deployment Guide

## Prerequisites

- Node.js 20+
- Docker (for local prod testing)
- Railway account (API + Bot)
- Vercel account (Web UI)
- GitHub repository connected to both

---

## Architecture

| Service | Host | Port |
|---------|------|------|
| API Server | Railway | 3001 |
| Web UI | Vercel | 443 (HTTPS auto) |
| Telegram Bot | Railway | — (polling) |

---

## 1. Environment Setup

Copy `.env.production.example` and fill all values:

```bash
cp aria/.env.production.example aria/.env.production
```

Set all secrets in your Railway and Vercel dashboards — **never commit `.env.production`**.

---

## 2. Deploy API to Railway

1. Connect your GitHub repo to Railway
2. Create a new service pointing to the `aria/apps/api` directory
3. Set all variables from `.env.production.example` as Railway environment secrets
4. Railway auto-deploys on push to `main`

Health check: `GET /health` must return HTTP 200.

---

## 3. Deploy Web UI to Vercel

1. Import the repo in [vercel.com/new](https://vercel.com/new)
2. Set **Root Directory**: `aria/apps/web`
3. Set **Build Command**: `npm run build`
4. Set environment variables (NEXTAUTH_URL, NEXTAUTH_SECRET, JWT_SECRET, API URL)
5. Deploy — Vercel handles HTTPS, CDN, and preview deployments automatically

---

## 4. CI/CD Pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs on every push to `main`:

```
lint + typecheck → tests → build → deploy to Railway
```

Secrets required in GitHub:
- `RAILWAY_TOKEN` — from Railway dashboard → Account Settings
- `PRODUCTION_URL` — your Railway API URL (for post-deploy health check)

---

## 5. Docker (Local Production Testing)

```bash
cd aria

# Build multi-stage image
docker compose build

# Start API + Web
docker compose up

# API: http://localhost:3001
# Web: http://localhost:3000
```

---

## 6. Health Monitoring

The `/health` endpoint returns:

```json
{
  "status": "ok",
  "uptime": 12345,
  "services": {
    "clickup": "configured",
    "chat": "ready",
    "fastify": "ready"
  },
  "memory": { "heapUsed": 45, "heapTotal": 64 }
}
```

Railway and Vercel both monitor this endpoint automatically. A crash triggers auto-restart.

---

## 7. Rollback

Railway keeps the last 5 deploys. To rollback:

1. Railway Dashboard → Deployments → Select previous deploy → **Redeploy**

Or via CLI:
```bash
railway redeploy
```

---

## 8. Security Checklist

- [ ] All secrets in environment variables (not in code)
- [ ] `NEXTAUTH_SECRET` is at least 32 random chars
- [ ] `JWT_SECRET` is at least 32 random chars  
- [ ] `TELEGRAM_ALLOWED_USER_ID` whitelist configured
- [ ] Helmet.js security headers active (`registerHelmetPlugin`)
- [ ] Rate limiting active (`registerRateLimitPlugin`) — 30 req/min
- [ ] CORS configured with production domain only
- [ ] `npm audit` run before each deploy

---

*Last updated: 2026-02-24 by Dex (Dev Agent)*
