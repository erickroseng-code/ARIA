# Estratégias de Busca - Barra de Pesquisa vs Tópicos

**Data:** 2026-03-06
**Status:** ✅ Implementado
**Commit:** TBD

## Problema

Como buscar posts virais da forma mais **realista e natural**?

## Solução: 2 Estratégias em Cascata

### 🟦 Estratégia 1 - PREFERIDA: Barra de Pesquisa do Instagram

Simula um **usuário digitando na barra de pesquisa** do Instagram:

```
Usuário abre Instagram → Clica na lupa (Explorar)
                      ↓
              Vê a barra de pesquisa
                      ↓
          Digita: "copywriting para iniciantes"
                      ↓
        Instagram retorna posts relevantes
                      ↓
          (Isso é o que simulamos!)
```

**Como funciona no código:**
```typescript
const run = await this.client.actor('apify/instagram-search-scraper').call({
    searchQuery: "copywriting para iniciantes",  // ← Termo exato
    searchType: 'posts',                         // ← Quer posts (não perfis)
    resultsLimit: 8,
});
```

**Vantagens:**
✅ Mais realista (real user behavior)
✅ Sem hashtags forçados
✅ Sem tópicos (palavra-chave pura)
✅ Mesma busca que um usuário faria

### 🟩 Estratégia 2 - FALLBACK: Tópicos

Se a barra de pesquisa retorna 0 posts, **cai para tópicos**:

```
Barra de pesquisa
      ↓
   (0 posts)
      ↓
  Cai para tópicos
      ↓
instagram.com/explore/tags/copywritingparainiciantes/
      ↓
  Posts do tópico
```

## Fluxo em Cascata

```
[fetchTopPosts]
        ↓
[fetchPostsFromSearchBar]
  Para cada keyword:
  ├─ Tenta: instagram-search-scraper
  ├─ searchQuery = keyword (exato)
  ├─ searchType = 'posts'
  └─ Coleta resultados
        ↓
Se retornar > 0 posts → USAR ESSES ✅
        ↓
Se retornar 0 posts → FALLBACK
        ↓
[fetchPostsFromTopics]
  Para cada keyword:
  ├─ URL: instagram.com/explore/tags/{keyword}/
  ├─ Actor: instagram-posts-scraper
  └─ Coleta resultados
        ↓
[filterAndSortByVirality]
[analyzePatterns]
```

## Comparação das 3 Abordagens

| Critério | Barra de Pesquisa | Tópicos | Hashtags |
|----------|-----------------|--------|----------|
| **Realismo** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Qualidade** | Alta | Alta | Média |
| **Natureza** | 100% natural | Curado pelo IG | Caótico |
| **Hashtags?** | Não | Não | Sim |
| **Confiável** | Sim (com fallback) | Sim | Não |
| **Usuário faria?** | SIM | Talvez | Raramente |

## Exemplos de Busca

### Exemplo 1: "copywriting para iniciantes"

```
[BUSCA] Tentando barra de pesquisa do Instagram (Estratégia 1)...
[BUSCA] Simulando busca na barra: "copywriting para iniciantes"
[BUSCA] ✅ 42 posts encontrados (barra de pesquisa) para "copywriting para iniciantes"
[BUSCA] Simulando busca na barra: "copywriting"
[BUSCA] ✅ 58 posts encontrados (barra de pesquisa) para "copywriting"
[BUSCA] Simulando busca na barra: "iniciantes"
[BUSCA] ✅ 35 posts encontrados (barra de pesquisa) para "iniciantes"
[STEP] 135 posts encontrados — filtrando flopados...
```

### Exemplo 2: Se barra falhar (fallback)

```
[BUSCA] Tentando barra de pesquisa do Instagram (Estratégia 1)...
[BUSCA] Simulando busca na barra: "topico super novo"
[AVISO] Barra de pesquisa falhou para "topico super novo": No results
[BUSCA] Fallback - Procurando no tópico: "topico super novo"
[BUSCA] ✅ 24 posts encontrados (tópico) para "topico super novo"
```

## Implementação

Arquivo: `squads/maverick/src/trend-researcher/index.ts`

Métodos:
- `fetchTopPosts()` - Orquestrador (tenta 1, depois 2)
- `fetchPostsFromSearchBar()` - Estratégia 1 (barra de pesquisa)
- `fetchPostsFromTopics()` - Estratégia 2 (fallback)

## Por que 2 estratégias?

O `instagram-search-scraper` às vezes pode:
- Falhar em keywords muito novos
- Ter limite de resultados
- Estar temporariamente indisponível

Ter um fallback garante que **sempre conseguimos posts**.

---

**Próximas Iterações:**
- Monitorar qual estratégia tem mais sucesso
- Ajustar parâmetros se necessário
- Adicionar estratégia 3 se ambas falharem
