# Epic 8: Atlas — Otimização Autônoma de Anúncios

## Status
Draft

## Epic Goal

Capacitar a Aria a analisar métricas de campanhas publicitárias e aplicar otimizações autonomamente via Meta Ads e Google Ads API — sem necessidade de intervenção humana para ajustes rotineiros de budget, targeting e criativos.

## Priority
Alta — Core business value: esta é a principal justificativa para manter a Aria rodando 24/7.

## Existing System Context

- **Stack atual:** Fastify API + TypeScript, módulo traffic em `aria/apps/api/src/modules/traffic/`
- **O que já existe:** `traffic.routes.ts`, `traffic.service.ts`, pasta `agents/` (conteúdo a verificar)
- **Capacidade atual:** Aria lê métricas de campanhas (somente leitura)
- **O que falta:** Camada de decisão (analisar → decidir) + camada de ação (aplicar mudança via API)

## Enhancement Details

- **O que muda:** Adicionar agente de decisão que analisa métricas → gera recomendações → executa ações com critérios de segurança
- **APIs alvo:** Meta Marketing API + Google Ads API
- **Guardrails:** Limites de gasto, whitelist de operações permitidas, dry-run mode para validação
- **Critério de sucesso:** Aria detecta campanha com CPC elevado → decide reduzir bid → aplica mudança → registra no log → notifica via Telegram

## Stories

### Story 8.1 — Meta Ads Write API Integration
**Executor:** `@dev` | **Quality Gate:** `@architect`
- Implementar Meta Marketing API v18+ com permissões de escrita (ads_management)
- Endpoints: update campaign budget, update ad set targeting, pause/resume ads
- Rate limiting handler e retry com exponential backoff
- Credenciais via `.env`: `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`
- **Quality Gate Tools:** `[api_security_review, rate_limit_validation]`
- **Risk Level:** HIGH — operações financeiras

### Story 8.2 — Google Ads Write API Integration
**Executor:** `@dev` | **Quality Gate:** `@architect`
- Implementar Google Ads API v15+ com OAuth2 service account
- Endpoints: update campaign budget, update keyword bids, pause/resume campaigns
- Credenciais via `.env`: `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_DEVELOPER_TOKEN`
- **Quality Gate Tools:** `[api_security_review, oauth_service_account_validation]`
- **Risk Level:** HIGH — operações financeiras

### Story 8.3 — Autonomous Decision Agent
**Executor:** `@dev` | **Quality Gate:** `@architect`
- Agente LLM que recebe métricas de campanha e gera recomendações estruturadas
- Regras de decisão configuráveis: CPC threshold, ROAS mínimo, budget utilization
- Dry-run mode: simula ações sem aplicar (para validação inicial)
- Guardrails: max 20% de variação de budget por ciclo, whitelist de operações
- **Quality Gate Tools:** `[decision_logic_review, guardrail_validation, financial_safety_check]`
- **Risk Level:** CRITICAL — decisões autônomas com impacto financeiro

### Story 8.4 — Audit Log & Telegram Notifications
**Executor:** `@dev` | **Quality Gate:** `@dev`
- Toda ação autônoma registrada em `atlas_audit_log` (tabela SQLite/DB)
- Notificação Telegram após cada otimização: "✅ Atlas otimizou campanha X: budget -15% (CPC estava R$3.20, meta R$2.50)"
- Endpoint `/atlas/audit` para histórico de ações
- **Quality Gate Tools:** `[audit_completeness_review, notification_format_validation]`
- **Risk Level:** LOW

## Compatibility Requirements
- [ ] Leitura de métricas existente continua funcionando
- [ ] Novas ações só executam se dry-run=false explícito
- [ ] Sem mudanças breaking em `traffic.routes.ts`

## Risk Mitigation
- **Risco principal:** Ação autônoma causar gasto descontrolado em campanhas
- **Mitigação:** Guardrails hard-coded (max 20% variação), modo dry-run obrigatório nas primeiras 48h, alertas de anomalia
- **Rollback:** Feature flag `ATLAS_WRITE_ENABLED=false` para desabilitar ações sem deploy

## Definition of Done
- [ ] Aria aplica otimização de bid em campanha teste sem intervenção humana
- [ ] Toda ação registrada no audit log
- [ ] Notificação Telegram enviada após cada otimização
- [ ] Guardrails impedem variação > 20% de budget
- [ ] Dry-run mode funcional e testado
- [ ] Testes unitários para camada de decisão

## Handoff para Story Manager

"Desenvolver stories para Epic 8 — Atlas Autonomous Ads. Stack: Fastify + TypeScript + Meta Marketing API + Google Ads API. Contexto: módulo traffic já existe em `aria/apps/api/src/modules/traffic/`. CRÍTICO: guardrails financeiros devem ser implementados antes de qualquer ação de escrita. Story 8.3 depende de 8.1 e 8.2. Story 8.4 pode ser paralela a 8.3."

---
*Created by Morgan (PM) — Epic 8 of Aria Autonomous Initiative*
