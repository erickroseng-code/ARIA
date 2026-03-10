# Epic 10: Maverick + Figma — Geração Autônoma de Carrosseis

## Status
Draft

## Epic Goal

Estender o squad Maverick para transformar roteiros de scripts (gerados a partir de pesquisa de trends no Instagram) em designs de carrossel prontos para publicação no Figma — fechando o loop criativo de pesquisa → estratégia → copywriting → design.

## Priority
Média — Feature nova e de alto valor criativo, sem dependências bloqueadoras.

## Existing System Context

- **Maverick existente:** `squads/maverick/src/` — trend-researcher, strategist, copywriter já funcionando
- **Figma MCP:** Disponível neste ambiente (`mcp__claude_ai_Figma__*`)
- **Fluxo atual:** Instagram trends → Strategist (ICP + funnel) → Copywriter (scripts com hooks)
- **O que falta:** Transformar script estruturado → layout de carrossel → design no Figma

## Enhancement Details

- **O que muda:** Nova etapa no pipeline Maverick — CarouselDesigner — que recebe script e gera carrossel no Figma
- **Como integra:** Usa Figma MCP (`get_design_context`, `generate_diagram`) + Figma API para criar frames
- **Critério de sucesso:** Maverick pesquisa trend → gera script → cria carrossel com 5-8 slides no Figma → exporta URL compartilhável

## Stories

### Story 10.1 — Carousel Structure Generator
**Executor:** `@dev` | **Quality Gate:** `@architect`
- Módulo `squads/maverick/src/carousel-designer/index.ts`
- Input: script estruturado (hook, corpo, CTA) do Copywriter
- Output: estrutura JSON de slides (título, texto, visual_hint, position)
- Lógica: hook → slide 1 (capa), desenvolvimento → slides 2-6, CTA → slide final
- **Quality Gate Tools:** `[content_structure_review, type_safety_validation]`
- **Risk Level:** LOW

### Story 10.2 — Figma Frame Creation via API
**Executor:** `@dev` | **Quality Gate:** `@architect`
- Usar Figma API REST para criar frames no arquivo de trabalho configurado
- `FIGMA_API_TOKEN` e `FIGMA_FILE_KEY` via `.env`
- Criar frames com texto, posicionamento e estilos baseados em template base do Figma
- Exportar URL de cada frame gerado
- **Quality Gate Tools:** `[figma_api_usage_review, credential_security_check]`
- **Risk Level:** MEDIUM

### Story 10.3 — Maverick Pipeline Integration
**Executor:** `@dev` | **Quality Gate:** `@architect`
- Adicionar etapa CarouselDesigner ao pipeline Maverick após Copywriter
- MaverickSession.tsx: nova fase "🎨 Gerando carrossel..." com preview dos slides
- Resultado: link Figma + preview de texto dos slides na UI
- Salvar carrossel gerado no histórico junto com o script
- **Quality Gate Tools:** `[pipeline_integration_review, ui_flow_validation]`
- **Risk Level:** MEDIUM

## Compatibility Requirements
- [ ] Pipeline Maverick existente (pesquisa → estratégia → copywriting) não quebra
- [ ] Scripts existentes no histórico não são afetados
- [ ] CarouselDesigner é etapa opcional (pode ser pulada se `FIGMA_API_TOKEN` não configurado)

## Risk Mitigation
- **Risco principal:** Figma API tem rate limits e estrutura de arquivo pode variar
- **Mitigação:** Template base fixo no Figma, fallback para exportar JSON de estrutura sem criar no Figma
- **Rollback:** Feature flag `MAVERICK_CAROUSEL_ENABLED=false`

## Definition of Done
- [ ] Maverick gera estrutura de carrossel a partir de script
- [ ] Frames criados no Figma com texto correto em cada slide
- [ ] URL do arquivo Figma disponível na interface
- [ ] Pipeline completo funciona sem erros quando `FIGMA_API_TOKEN` configurado
- [ ] Modo fallback funciona quando token não configurado

## Handoff para Story Manager

"Desenvolver stories para Epic 10 — Maverick + Figma Carousels. Verificar implementação atual do Maverick em `squads/maverick/src/` antes de adicionar. Story 10.1 é pré-requisito para 10.2 e 10.3. Figma MCP está disponível no ambiente de dev — verificar capacidades via `mcp__claude_ai_Figma__get_design_context`."

---
*Created by Morgan (PM) — Epic 10 of Aria Autonomous Initiative*
