# Epic 12: Maverick Weekly Batch — Automação de Carrosséis

## Status
Draft

## Epic Goal

Implementar um pipeline automático que toda segunda-feira gera carrosséis completos para N tópicos predefinidos, captura screenshots dos slides via Playwright, empacota em ZIP, e notifica o criador via Telegram com o link de download — eliminando o trabalho manual semanal de criação de conteúdo.

## Priority
Alta — Este é o produto final da jornada Maverick: automação completa de conteúdo semanal.

## Existing System Context

- **API:** Fastify rodando localmente e (após Epic 11) no Render
- **Carousel endpoint:** `POST /api/maverick/carousel` já existe (retorna HTML + JSON)
- **Playwright:** já usado no projeto para scraping de Instagram
- **GitHub Actions:** já configurado para scheduling (Epic 9)
- **Telegram:** bot ativo, notificações funcionando (Epics 8/9)
- **Maverick pipeline:** Scout → Strategist → Copywriter → Carousel (Epics 9/10)

## Enhancement Details

### Pipeline do Weekly Batch
```
POST /api/maverick/weekly-batch
  ├── Para cada tópico:
  │   ├── Gera scripts via Maverick pipeline (ou usa cache)
  │   ├── Gera estrutura de carousel (generateCarouselStructure)
  │   ├── Gera HTML do carousel (generateCarouselHtml)
  │   ├── Screenshot via Playwright (PNG 1080×1080 por slide)
  │   └── Agrupa PNGs do tópico em subpasta
  ├── Comprime tudo em ZIP (topico-1/, topico-2/, ...)
  ├── Salva ZIP em /tmp ou storage temporário
  └── Retorna download URL

GitHub Actions (toda segunda, 8h BRT):
  └── POST /api/maverick/weekly-batch
      └── Telegram: "🎨 Seus carrosséis da semana estão prontos! [Download]"
```

## Stories

### Story 12.1 — Weekly Batch Endpoint
**Executor:** `@dev` | **Quality Gate:** `@qa`
- `POST /api/maverick/weekly-batch` com body `{ topics: string[], theme?: 'dark'|'light' }`
- Cada tópico gera: scripts (via Maverick) → carousel structure → HTML
- Retorna `{ batchId, topics: [{topic, slides: [{html}]}] }`
- Endpoint síncrono para MVP (sem queue)
- **Risk Level:** MEDIUM

### Story 12.2 — Playwright Screenshot Pipeline
**Executor:** `@dev` | **Quality Gate:** `@qa`
- Serviço que recebe HTML de um slide e retorna PNG 1080×1080
- Usa Playwright headless (já no projeto)
- Função `screenshotSlide(html: string): Promise<Buffer>`
- Integrado ao batch: cada slide do carousel é capturado
- Salva PNGs temporariamente em `/tmp/batch-{batchId}/topico-{n}/slide-{n}.png`
- **Risk Level:** MEDIUM

### Story 12.3 — ZIP + Download Endpoint
**Executor:** `@dev` | **Quality Gate:** `@qa`
- Empacota PNGs do batch em ZIP com estrutura: `carrossets-semana-{DATA}/topico-1/slide-N.png`
- `GET /api/maverick/weekly-batch/:batchId/download` → stream do ZIP
- ZIP disponível por 24h (cleanup automático)
- **Risk Level:** LOW

### Story 12.4 — GitHub Actions Cron + Telegram Notification
**Executor:** `@devops` | **Quality Gate:** `@dev`
- Workflow `.github/workflows/maverick-weekly.yml` dispara toda segunda às 8h BRT (`0 11 * * 1`)
- Chama `POST $ARIA_API_URL/api/maverick/weekly-batch`
- Envia mensagem Telegram com link de download
- Template: `🎨 Maverick Weekly: seus carrosséis estão prontos!\n📦 Download: {url}\n📅 {data}`
- **Risk Level:** LOW

## Compatibility Requirements
- [ ] Funciona localmente (para desenvolvimento e testes)
- [ ] Funciona no Render após Epic 11 (Playwright compatível com Docker)
- [ ] ZIP acessível via URL pública (ou Telegram file upload como alternativa)

## Risk Mitigation

- **Playwright no Docker:** Render free tier tem memória limitada (512MB). Playwright pode exceder. Mitigação: usar `--no-sandbox` + `--disable-gpu`, limitar a 1 browser instance por vez.
- **Tempo de execução:** Pipeline completo para 5 tópicos × 6 slides = 30 screenshots. Pode levar 2-5 min. Mitigação: GitHub Actions timeout de 15 min.
- **Download URL pública:** Render free tier não tem storage persistente. Alternativa: fazer upload do ZIP para Telegram diretamente (Telegram bot suporta arquivos até 50MB).

## Definition of Done
- [ ] `POST /api/maverick/weekly-batch` gera ZIP com PNGs 1080×1080
- [ ] GitHub Actions dispara toda segunda às 8h BRT
- [ ] Telegram recebe notificação com link/arquivo de download
- [ ] Pipeline testado end-to-end com 2-3 tópicos de exemplo

## Handoff para Story Manager

"Desenvolver stories para Epic 12 — Maverick Weekly Batch. Pré-requisito: Epic 10 (carousel endpoint) deve estar concluído. Epic 11 (Render deploy) é preferível mas não bloqueante para desenvolvimento local. Executores: @dev para stories 12.1-12.3, @devops para 12.4. Atenção especial ao Playwright no Docker (memória)."

---
*Created by Morgan (PM) — Epic 12 of Aria Autonomous Initiative*
