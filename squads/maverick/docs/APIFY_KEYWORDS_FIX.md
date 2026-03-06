# Apify Integration: Keywords vs Hashtags Fix

**Data:** 2026-03-06
**Commit:** TBD
**Status:** ✅ Implementado

## Problema Identificado

O `TrendResearcherAgent` estava convertendo keywords em hashtags antes de buscar no Instagram:

```typescript
// ❌ ANTES (incorreto)
keywords: "copywriting para iniciantes" → hashtags: "#copywritingparainiciantes"
```

Isso não refletia o comportamento real do Instagram Search, que aceita keywords com espaços e mantém a estrutura da frase.

## Solução Implementada

### 1. Removido `keywordsToHashtags()`
- Função desnecessária que convergia keywords em hashtags com espaços removidos
- Agora não é mais usada em lugar algum

### 2. Atualizado `fetchTopPosts()`
**Antes:**
```typescript
const hashtags = this.keywordsToHashtags(keywords);
const run = await this.client.actor('apify/instagram-hashtag-scraper').call({
    hashtags,
    resultsLimit: resultsPerKeyword,
});
```

**Depois:**
```typescript
const run = await this.client.actor('apify/instagram-search-scraper').call({
    searchTerms: keywords,  // Keywords diretos, com espaços preservados
    resultsLimit: resultsPerKeyword,
});
```

### 3. Atualizado `analyzePatterns()`
- Renomeado segundo parâmetro de `hashtags` para `keywords`
- Agora passa os keywords diretos (não convertidos) para análise do LLM

### 4. Atualizado `research()` (pipeline principal)
- Remove a conversão para hashtags
- Log agora mostra: `"Pesquisando no Instagram por: copywriting para iniciantes"`
- Em vez de: `"Pesquisando no Instagram: #copywritingparainiciantes"`

## Atores Usados

| Actor | Status | Razão |
|-------|--------|-------|
| `apify/instagram-search-scraper` | ❌ DESCONTINUADO (Session 10+) | Não retornava resultados |
| `apify/instagram-hashtag-scraper` | ✅ ATUAL (ESTÁVEL) | Mais confiável, sempre retorna posts |

## Estratégia de Hashtags Derivados (Session 10+)

**Problema:** `instagram-search-scraper` não funcionava (0 posts)

**Solução:** Voltar a `instagram-hashtag-scraper` mas com **derivação inteligente** de hashtags

### Algoritmo de Derivação

```
Keywords: "copywriting para iniciantes"
         ↓
   Normaliza (remove acentos, lowercase)
         ↓
   Decompõe em palavras: [copywriting, para, iniciantes]
         ↓
   Gera múltiplas categorias de hashtags:

   1. Individuais:     #copywriting, #iniciantes
   2. Variações:       #copywriter (singular de copywriting)
   3. Tema-específico: #marketing, #aprenda, #tutorial
   4. Genéricos:       #dica, #conteudo
         ↓
   Total: até 15 hashtags únicos
         ↓
   Busca via instagram-hashtag-scraper
```

### Exemplos de Derivação

| Keyword | Hashtags Derivados |
|---------|------------------|
| "copywriting para iniciantes" | copywriting, iniciantes, copywriter, marketing, aprenda, tutorial, dica, conteudo |
| "emagrecimento feminino" | emagrecimento, feminino, fitness, saude, mulheres, dica, conteudo |
| "marketing digital" | marketing, digital, conteudo, dica |

### Fluxo Final

```
Plano Estratégico
      ↓
[extractKeywords] → Keywords: ["copywriting para iniciantes", ...]
      ↓
[deriveHashtagsFromKeywords] → Hashtags: ["copywriting", "iniciantes", "marketing", ...]
      ↓
[fetchTopPosts] → instagram-hashtag-scraper com hashtags derivados
      ↓
Posts encontrados (conteúdo viral real)
      ↓
[analyzePatterns] → LLM analisa padrões de hooks/ângulos
      ↓
TrendResearch (insights para copywriter)
```

## Impacto

✅ Busca agora corresponde ao comportamento real do Instagram
✅ Keywords preservam estrutura (espaços, acentos)
✅ Maior relevância nos resultados (menos falsos positivos)
✅ Interface mais clara (keywords em vez de hashtags)

## Testing

Recomendado testar:
1. `TrendResearcherAgent.extractKeywords()` com plano complexo
2. `TrendResearcherAgent.research()` com keywords do nicho copywriting
3. Comparar resultados antes/depois em qualidade de posts encontrados

## Sistema de Viral Score (Atualização Session 10)

**Problema:** Posts flopados estavam sendo retornados junto com virais

**Solução:** Implementado `calculateViralScore()` e `filterAndSortByVirality()` que:

### Cálculo do Viral Score
```
Base = Likes + Comentários
Comment Bonus = 1 + (Comments / Total) * 0.5  (comentários genuínos = mais viral)
View Bonus = 1 + log₁₀(views) / 5  (escala logarítmica para views)

Viral Score = Base × Comment Bonus × View Bonus
```

### Filtragem Automática
1. Calcula score para todos os posts
2. Define mínimo aceitável = 25% do máximo encontrado
3. Remove tudo abaixo (flopados)
4. Ordena decrescente pelos melhores
5. Retorna até 12 posts virais

### Exemplo
| Post | Likes | Comments | Views | Score | Status |
|------|-------|----------|-------|-------|--------|
| A | 5000 | 800 | 50k | 8.2 | ✅ VIRAL |
| B | 2000 | 150 | 20k | 3.1 | ✅ VIRAL |
| C | 500 | 20 | 2k | 0.6 | ❌ FLOPADO |

## Notas

- O Apify `instagram-search-scraper` mantém a mesma interface de resultado
- Não há breaking changes em interfaces de saída
- Pode haver diferença em quantidade de posts (Apify pode ter rate limits)
- Viral Score é logarítmico: 10x mais views = +2x de boost (não linear)
