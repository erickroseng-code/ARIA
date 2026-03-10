# Epic 9: Telegram Bot + GitHub Actions — Orquestração Autônoma

## Status
Draft

## Epic Goal

Integrar o bot Telegram existente com a Aria para receber comandos e enviar relatórios autônomos, e configurar GitHub Actions como scheduler de tarefas semanais — permitindo que a Aria execute ciclos completos (pesquisar → otimizar → reportar) sem intervenção humana.

## Priority
Alta — É a interface de controle e o mecanismo de disparo para toda a autonomia da Aria.

## Existing System Context

- **Bot Telegram:** Já criado (token disponível, caminho implementado em codebase)
- **Scheduler:** GitHub Actions (cron jobs) — escolha do usuário para tarefas agendadas
- **Arquitetura alvo:**
  ```
  GitHub Actions (cron schedule)
      → POST /api/scheduled-tasks/{task-name}
      → Aria executa (otimiza anúncios, pesquisa trends, gera relatório)
      → Envia resultado via Telegram Bot
  ```
- **Stack:** Fastify API + TypeScript, Telegram Bot API, GitHub Actions YAML

## Enhancement Details

- **O que muda:** Adicionar endpoints de tarefas agendadas + handlers Telegram para comandos + GitHub Actions workflows
- **Como integra:** Telegram bot como canal de output; GitHub Actions como trigger externo via HTTP
- **Critério de sucesso:** Toda segunda-feira às 9h, Aria envia relatório semanal de campanhas no Telegram sem nenhuma ação manual

## Stories

### Story 9.1 — Telegram Command Handlers
**Executor:** `@dev` | **Quality Gate:** `@dev`
- Comandos: `/status` (status geral da Aria), `/report` (relatório on-demand), `/atlas` (status campanhas), `/maverick` (últimas pesquisas de trends)
- Webhook Telegram configurado para o endpoint da Aria no Render
- Auth: validação de `chat_id` para restringir a usuários autorizados
- **Quality Gate Tools:** `[auth_validation, command_handler_review]`
- **Risk Level:** LOW

### Story 9.2 — Scheduled Task Endpoints
**Executor:** `@dev` | **Quality Gate:** `@architect`
- Endpoints: `POST /api/scheduled-tasks/weekly-report`, `POST /api/scheduled-tasks/atlas-optimize`, `POST /api/scheduled-tasks/maverick-research`
- Auth: `SCHEDULER_SECRET` no header para validar chamadas do GitHub Actions
- Cada endpoint executa a tarefa e retorna resultado + envia Telegram notification
- **Quality Gate Tools:** `[endpoint_auth_review, task_isolation_validation]`
- **Risk Level:** MEDIUM

### Story 9.3 — GitHub Actions Scheduler Workflows
**Executor:** `@devops` | **Quality Gate:** `@dev`
- Criar `.github/workflows/aria-weekly-report.yml` (cron: toda segunda 9h)
- Criar `.github/workflows/aria-atlas-optimize.yml` (cron: diário às 22h)
- Criar `.github/workflows/aria-maverick-research.yml` (cron: toda quarta 10h)
- Secrets no GitHub: `ARIA_API_URL`, `SCHEDULER_SECRET`
- **Quality Gate Tools:** `[workflow_syntax_validation, secret_management_review]`
- **Risk Level:** LOW

## Compatibility Requirements
- [ ] Bot Telegram existente não perde funcionalidades atuais
- [ ] Webhook Telegram não conflita com polling existente (se houver)
- [ ] GitHub Actions secrets não expostos em logs

## Risk Mitigation
- **Risco principal:** Endpoint de tarefas agendadas sem autenticação adequada
- **Mitigação:** `SCHEDULER_SECRET` obrigatório + validação de IP do GitHub Actions (opcional)
- **Rollback:** Desabilitar workflows no GitHub Actions sem afetar a API

## Definition of Done
- [ ] `/status` no Telegram retorna estado atual da Aria
- [ ] GitHub Actions dispara tarefa semanal e Telegram recebe relatório
- [ ] Endpoint de tarefas rejeita requests sem `SCHEDULER_SECRET`
- [ ] Logs de execução de tarefas agendadas disponíveis

## Handoff para Story Manager

"Desenvolver stories para Epic 9 — Telegram + GitHub Actions. Bot Telegram já existe — verificar implementação atual antes de adicionar. Story 9.3 executada por @devops. Stories 9.1 e 9.2 são pré-requisitos para 9.3. Garantir que webhook Telegram funciona no Render (precisa de HTTPS público)."

---
*Created by Morgan (PM) — Epic 9 of Aria Autonomous Initiative*
