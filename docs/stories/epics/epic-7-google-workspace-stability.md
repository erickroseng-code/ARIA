# Epic 7: Google Workspace — Estabilidade e Reconexão Automática

## Status
Draft

## Epic Goal

Tornar a integração com Google Workspace (Calendar, Drive, Gmail) completamente estável em produção, eliminando a necessidade de reconexão manual após restarts da API. O sistema deve reconectar automaticamente usando tokens persistidos de forma confiável.

## Priority
Alta — Bloqueador transversal: instabilidade do Google impacta todas as automações que dependem de Calendar, Drive e Gmail.

## Existing System Context

- **Stack atual:** Fastify API + TypeScript, SQLite para persistência de tokens, OAuth2 com Google
- **Integração existente:** `aria/apps/api/src/routes/google-auth.routes.ts`, `aria/apps/api/src/server.ts`
- **Frontend:** `aria/apps/web/src/components/layout/IntegrationHub.tsx`
- **Problema documentado:** Sessões 7 e 8 tentaram fix — problema persiste. Token resolver só consulta SQLite, ignorando `.env`. Popup OAuth navega para URL do backend. Cache de sessão no frontend impede re-autenticação.

## Enhancement Details

- **O que muda:** Token refresh automático com fallback para `.env`, middleware de reconexão no boot da API, UX de reconexão no IntegrationHub sem necessidade de reload
- **Como integra:** Modifica camada de autenticação existente sem quebrar endpoints já funcionais
- **Critério de sucesso:** Aria reinicia e Google Workspace conecta automaticamente. Zero intervenção manual necessária.

## Stories

### Story 7.1 — Token Persistence & Auto-Refresh
**Executor:** `@dev` | **Quality Gate:** `@architect`
- Resolver de token consulta SQLite → fallback para `GOOGLE_REFRESH_TOKEN` no `.env` → fallback para re-auth flow
- Refresh automático de access token antes de expirar (token expiry - 5min buffer)
- Persist refresh token no SQLite após cada renovação
- **Quality Gate Tools:** `[token_security_review, oauth_flow_validation]`
- **Risk Level:** HIGH — envolve autenticação

### Story 7.2 — Boot-Time Reconnection Middleware
**Executor:** `@dev` | **Quality Gate:** `@architect`
- Middleware no `server.ts` que tenta restaurar sessão Google no startup
- Health check endpoint `/health/google` retorna status da integração
- Logs estruturados de conexão/falha para debug em produção
- **Quality Gate Tools:** `[boot_sequence_validation, integration_health_check]`
- **Risk Level:** MEDIUM

### Story 7.3 — Frontend Reconnection UX
**Executor:** `@dev` | **Quality Gate:** `@architect`
- Corrigir bug de cache no IntegrationHub que impede re-autenticação
- Popup OAuth: busca URL via fetch → navega popup para URL Google diretamente
- Status badge em tempo real: Conectado / Reconectando / Desconectado
- **Quality Gate Tools:** `[ux_review, oauth_popup_flow_test]`
- **Risk Level:** LOW

## Compatibility Requirements
- [ ] Endpoints Google Calendar/Drive/Gmail existentes permanecem inalterados
- [ ] Tokens existentes no SQLite são migrados sem perda
- [ ] Funciona sem `GOOGLE_REFRESH_TOKEN` no `.env` (degrada graciosamente para manual auth)

## Risk Mitigation
- **Risco principal:** Invalidar tokens existentes durante refactor
- **Mitigação:** Leitura-first de tokens existentes antes de qualquer escrita; testes de regressão OAuth
- **Rollback:** Revert do token resolver mantém comportamento anterior

## Definition of Done
- [ ] Google Calendar cria eventos sem intervenção manual após restart
- [ ] `/health/google` retorna `connected: true` em produção
- [ ] IntegrationHub mostra status correto sem reload de página
- [ ] Testes de integração OAuth passando
- [ ] Sem erros de token nos logs após 24h rodando

## Handoff para Story Manager

"Desenvolver stories detalhadas para Epic 7 — Google Workspace Stability. Stack: Fastify + TypeScript + SQLite + Google OAuth2. Padrões existentes: `google-auth.routes.ts` como referência. Cada story deve verificar que tokens OAuth não são corrompidos durante implementação. Prioridade máxima — é bloqueador para produção 24/7."

---
*Created by Morgan (PM) — Epic 7 of Aria Autonomous Initiative*
