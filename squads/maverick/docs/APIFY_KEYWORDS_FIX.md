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

## Actors Usados

| Actor | Uso | Comportamento |
|-------|-----|---------------|
| `apify/instagram-search-scraper` | ✅ NOVO (busca por keywords) | Pesquisa diretamente na barra de pesquisa do Instagram com frase exata |
| `apify/instagram-hashtag-scraper` | ❌ ANTIGO (removido) | Buscava por hashtags sem espaços |

## Fluxo Final

```
Plano Estratégico
      ↓
[extractKeywords] → Keywords: ["copywriting para iniciantes", ...]
      ↓
[fetchTopPosts] → instagram-search-scraper com keywords diretos
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

## Notas

- O Apify `instagram-search-scraper` mantém a mesma interface de resultado
- Não há breaking changes em interfaces de saída
- Pode haver diferença em quantidade de posts (Apify pode ter rate limits)
