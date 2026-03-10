# Epic 11: Deploy no Render — Aria em Produção 24/7

## Status
Draft

## Epic Goal

Publicar a Aria no Render (free tier) com disponibilidade contínua, integrada ao GitHub Actions scheduler e acessível via URL pública — tornando a operação autônoma possível sem infraestrutura local.

## Priority
Baixa-Média — Executar após Epics 7-9 estarem estáveis. É o passo final para autonomia.

## Existing System Context

- **Infraestrutura alvo:** Render free tier (750h/mês)
- **Comportamento do Render free tier:** Web Services fazem spin-down após 15min de inatividade → cold start de ~30s
- **Solução para keep-alive:** UptimeRobot (free) pinga `/health` a cada 5 min
- **Alternativa:** Render Background Worker (sem spin-down, sem HTTP endpoint)
- **Stack:** Node.js + Fastify API + Next.js Web (monorepo)
- **CI/CD:** GitHub Actions já usado para scheduling (Epic 9)

## Enhancement Details

- **O que muda:** Dockerfile para API + configuração Render + UptimeRobot + variáveis de ambiente em produção
- **Decisão de arquitetura:** Deploiar apenas a API (`aria/apps/api`) — Web UI é desnecessária para operação autônoma
- **Critério de sucesso:** API Aria online 24/7 no Render, GitHub Actions consegue chamar endpoints, Telegram bot responde

## Stories

### Story 11.1 — Dockerization da API
**Executor:** `@devops` | **Quality Gate:** `@dev`
- Criar `aria/apps/api/Dockerfile` (multi-stage: build + runtime)
- `.dockerignore` adequado (node_modules, .env, etc.)
- Variáveis de ambiente documentadas em `.env.example` com todos os secrets necessários
- Testar build local: `docker build -t aria-api .`
- **Quality Gate Tools:** `[dockerfile_security_review, image_size_validation]`
- **Risk Level:** LOW

### Story 11.2 — Render Service Configuration
**Executor:** `@devops` | **Quality Gate:** `@dev`
- `render.yaml` (Infrastructure as Code) configurando Web Service
- Health check endpoint `/health` retornando `{ status: "ok", timestamp: ... }`
- Environment variables mapeadas para Render Environment Groups
- Auto-deploy configurado para branch `main`
- **Quality Gate Tools:** `[render_config_validation, secret_exposure_check]`
- **Risk Level:** MEDIUM

### Story 11.3 — Keep-Alive & Monitoring
**Executor:** `@devops` | **Quality Gate:** `@dev`
- Configurar UptimeRobot (free): ping `/health` a cada 5 min
- Alertas de downtime para Telegram (quando serviço cair > 5 min)
- Configurar GitHub Actions secret `ARIA_API_URL` com URL pública do Render
- Smoke test: verificar que GitHub Actions scheduler consegue chamar API após deploy
- **Quality Gate Tools:** `[monitoring_coverage_review, alert_configuration_check]`
- **Risk Level:** LOW

## Compatibility Requirements
- [ ] API funciona identicamente em Docker e localmente
- [ ] Todos os secrets do `.env` mapeados no Render sem hardcoding
- [ ] GitHub Actions consegue autenticar nos endpoints de tarefas agendadas

## Risk Mitigation
- **Risco principal:** Cold start do Render (15min inatividade → 30s boot) pode fazer GitHub Actions timeout
- **Mitigação:** UptimeRobot mantém serviço quente; se cold start ocorrer, GitHub Actions retry com timeout de 60s
- **Rollback:** Render tem rollback com 1 clique para versão anterior

## Definition of Done
- [ ] `https://aria-api.onrender.com/health` retorna 200
- [ ] UptimeRobot reportando uptime > 99%
- [ ] GitHub Actions workflow dispara e Aria responde via Telegram
- [ ] Zero secrets expostos em logs ou código
- [ ] Documentação de secrets necessários atualizada no README

## Handoff para Story Manager

"Desenvolver stories para Epic 11 — Deploy Render. CRÍTICO: só executar após Epics 7, 8, e 9 estarem concluídos. Executor é @devops para todas as stories. Verificar que `aria/apps/api/package.json` tem script `start` configurado corretamente antes do Dockerfile."

---
*Created by Morgan (PM) — Epic 11 of Aria Autonomous Initiative*
