# Busca SEM Hashtags - Nova Estratégia

**Data:** 2026-03-06
**Status:** ✅ Implementado
**Commit:** TBD

## Problema Anterior

Estávamos derivando hashtags dos keywords, o que ainda era uma abordagem **"forçada"** pelo Instagram.

## Solução: Tópicos do Instagram (sem #)

Agora usamos **tópicos/categorias nativas do Instagram** - a mesma forma que o aplicativo usa para buscar:

### Como Funciona

```
Keyword: "copywriting para iniciantes"
         ↓
URL do tópico: instagram.com/explore/tags/copywritingparainiciantes/
         ↓
instagram-posts-scraper busca direto pela URL
         ↓
Retorna posts populares desse tópico
         ↓
(SEM hashtags explícitos, sem conversão)
```

### Fluxo

```
[extractKeywords]
     ↓
keywords: ["copywriting para iniciantes", "copywriting", "iniciantes"]
     ↓
[fetchTopPosts] - para cada keyword:
     ├─ Monta URL: instagram.com/explore/tags/copywriting/
     ├─ Chama instagram-posts-scraper
     └─ Coleta posts
     ↓
[filterAndSortByVirality]
     ↓
[analyzePatterns]
     ↓
TrendResearch com posts virais
```

## Vantagens

✅ **Sem hashtags explícitos** — usa tópicos/categorias nativas do Instagram
✅ **Mais natural** — mesma forma que o app busca
✅ **Sem conversão forçada** — keywords "copywriting para iniciantes" vira topic "copywritingparainiciantes"
✅ **Múltiplos keywords** — busca cada um e combina resultados
✅ **Tratamento de erros** — se um keyword falha, continua com os outros

## Actor Usado

- **apify/instagram-posts-scraper** com startUrls apontando para tópicos do Instagram
- Não depende de hashtags manualmente inseridos
- Busca automaticamente posts do tópico

## Exemplo

| Keyword | URL Gerada | Resultado |
|---------|-----------|-----------|
| copywriting | instagram.com/explore/tags/copywriting/ | Posts sobre copywriting |
| emagrecimento feminino | instagram.com/explore/tags/emagrecimentofeminino/ | Posts sobre emagrecimento feminino |
| marketing digital | instagram.com/explore/tags/marketingdigital/ | Posts sobre marketing digital |

## Logs

```
[STEP] Keywords extraídos: copywriting para iniciantes, copywriting, iniciantes
[STEP] Buscando posts virais por tópico (sem hashtags)...
[BUSCA] Procurando posts sobre: "copywriting para iniciantes"
[BUSCA] 24 posts encontrados para "copywriting para iniciantes"
[BUSCA] Procurando posts sobre: "copywriting"
[BUSCA] 45 posts encontrados para "copywriting"
[BUSCA] Procurando posts sobre: "iniciantes"
[BUSCA] 32 posts encontrados para "iniciantes"
[STEP] 101 posts encontrados — filtrando flopados e mantendo apenas virais...
[STEP] 12 posts virais selecionados — analisando padroes de hooks e angulos...
```

## Implementação

Arquivo: `squads/maverick/src/trend-researcher/index.ts`

- Removida função `deriveHashtagsFromKeywords()`
- Reescrita função `fetchTopPosts()` para usar tópicos
- Simplificado `research()` pipeline
- Tratamento de erros por keyword (um falha, continua com os outros)

---

**Próxima Atualização:** Monitorar taxa de sucesso e ajustar se necessário
