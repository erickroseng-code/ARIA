# Plano: Sistema Completo de Rastreamento e Qualidade da Base de Conhecimento

## 📋 Escopo

Implementar rastreamento completo, detecção de alucinações e métricas de qualidade para o Maverick Squad.

---

## 🎯 4 Componentes Principais

### 1️⃣ **Scholar Engine Melhorado**
- **Objetivo:** Busca e indexação mais inteligente
- **Melhorias:**
  - Indexação com metadados (fonte, categoria, importância, tamanho)
  - Scoring de relevância baseado em TF-IDF + semântica
  - Cache de buscas para performance
  - Extração automática de IDs únicos de trechos
  - Busca fuzzy para encontrar trechos similares

**Arquivos:**
- `squads/maverick/src/scholar/engine-improved.ts` (NEW)
- `squads/maverick/src/scholar/index-builder.ts` (NEW)
- `squads/maverick/src/scholar/search-scorer.ts` (NEW)

### 2️⃣ **Citation Validator**
- **Objetivo:** Validar se citações existem e rastreá-las
- **Funcionalidades:**
  - Validar citação contra base de conhecimento
  - Encontrar trechos exatos ou fuzzy
  - Gerar ID único para cada trecho citado
  - Score de confiança da citação (0-100)
  - Alertar sobre alucinações (citação inválida)

**Arquivos:**
- `aria/apps/api/src/modules/maverick/citation-validator.ts` (NEW)
- `aria/apps/api/src/modules/maverick/hallucination-detector.ts` (NEW)

### 3️⃣ **Knowledge Traceability**
- **Objetivo:** Rastrear qual conhecimento foi usado
- **Dados rastreados:**
  - IDs dos trechos usados
  - Score de relevância de cada trecho
  - Posição na análise (em qual contexto foi usado)
  - Qualidade da citação (válida/inválida)
  - Timestamp da busca

**Arquivos:**
- `aria/apps/api/prisma/schema.prisma` (ATUALIZAR - novo model TraceableKnowledge)
- `aria/apps/api/src/modules/maverick/traceability.service.ts` (NEW)

### 4️⃣ **Quality Metrics Dashboard**
- **Objetivo:** Medir qualidade do uso da base
- **Métricas:**
  - % de citações válidas
  - Cobertura da base (trechos usados vs total)
  - Trechos mais usados
  - Trechos nunca usados
  - Relevância média das buscas
  - Taxa de alucinações
  - Depth score (superficial vs profundo)

**Arquivos:**
- `aria/apps/api/src/modules/maverick/quality-metrics.service.ts` (NEW)
- `aria/apps/web/src/components/maverick/KnowledgeMetricsDashboard.tsx` (NEW)

---

## 📊 Novo Model Prisma

```prisma
model KnowledgeTrace {
  id                String   @id @default(uuid())
  analysisId        String
  maverickAnalysis  MaverickAnalysis @relation(fields: [analysisId], references: [id], onDelete: Cascade)

  // Trecho da base de conhecimento
  sourceId          String   // ID único do trecho na base
  sourceText        String   @db.Text // Texto do trecho (primeiros 500 chars)
  fullSourceUrl     String   // Path para encontrar na base

  // Como foi usado
  contextUsed       String   @db.Text // Contexto em que foi citado
  citationText      String   @db.Text // Como foi citado na análise
  positionInAnalysis String  // "analysis", "strategy", "positive_point", etc

  // Validação
  isValid           Boolean  @default(false)
  validationScore   Int      // 0-100
  relevanceScore    Int      // 0-100
  confidenceScore   Int      // 0-100
  hallucination     Boolean  @default(false)

  // Feedback
  userFeedback      String?  // "good", "inaccurate", "irrelevant"
  feedbackNote      String?

  createdAt         DateTime @default(now())
}

model SourceMetadata {
  id              String   @id @default(uuid())
  sourceId        String   @unique // ID único da base
  title           String
  category        String
  importance      Int      // 1-10
  usageCount      Int      @default(0)
  lastUsedAt      DateTime?
  avgRelevance    Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

---

## 🔄 Fluxo de Execução

### Durante a Análise (Strategist)

```
1. LLM gera análise com citações
2. Citation Validator executa:
   - Extrai citações do texto
   - Valida cada citação contra base
   - Calcula scores de confiança
   - Detecta alucinações
3. Knowledge Traceability registra:
   - Quais trechos foram usados
   - Scores de cada trecho
   - Contexto de uso
4. Salva MaverickAnalysis + KnowledgeTrace records
```

### Dashboard de Métricas

```
GET /api/maverick/metrics
  - totalAnalyses
  - validCitationRate (%)
  - avgRelevanceScore
  - coverageScore (% da base usada)
  - hallucintationRate (%)
  - topTrechos
  - unusedTrechos
  - trendChart (ao longo do tempo)
```

---

## 📈 Implementação em Fases

### Fase 1: Scholar Melhorado (1-2 horas)
- [ ] Implementar indexação com metadados
- [ ] Adicionar scoring de relevância
- [ ] Criar IDs únicos para trechos
- [ ] Testes

### Fase 2: Citation Validation (2-3 horas)
- [ ] Citation Validator (validar citações)
- [ ] Hallucination Detector (detectar alucinações)
- [ ] Integrar com Strategist
- [ ] Testes

### Fase 3: Knowledge Traceability (1-2 horas)
- [ ] Prisma schema update
- [ ] TraceabilityService (rastrear uso)
- [ ] Integrar com API routes
- [ ] Testes

### Fase 4: Metrics & Dashboard (2-3 horas)
- [ ] QualityMetricsService
- [ ] API endpoints para métricas
- [ ] Dashboard React
- [ ] Testes

---

## 🚀 Total: ~6-10 horas

Pronto para começar? 🎯
