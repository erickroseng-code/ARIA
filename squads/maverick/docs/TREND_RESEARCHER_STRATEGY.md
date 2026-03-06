# Trend Researcher - Estratégia de Busca de Reels Virais

## Problema Original
- ❌ `instagram-hashtag-scraper` não retorna Reels (apenas Image/Sidecar)
- ❌ `instagram-reel-scraper` requer username (não funciona com palavras-chave)
- ❌ Gastar muitos CUs do Apify buscando no escuro

## Solução: Google Search + Apify (Arquitetura em 2 passos)

### Passo 1: Google Search (Serper.dev API)
**Custo:** ~$1 por 1000 buscas
**Vantagem:** Google já indexa Reels e os ordena por popularidade

```bash
site:instagram.com/reels "palavra-chave"
```

O Google retorna URLs de Reels que:
- ✅ Estão ranqueados (têm engajamento)
- ✅ Correspondem à palavra-chave exata
- ✅ São Reels confirmados (não posts estáticos)

### Passo 2: Apify (Só dos posts encontrados)
**Custo:** Drasticamente reduzido (scrapa só URLs específicas)

Usa `instagram-posts-scraper` com as URLs encontradas no Google:
- Extrai dados: likes, comments, caption, type, views
- Filtra por `type === 'Video'` (confirma que é Reel)
- Retorna estrutura consistente

## Implementação

```typescript
// 1. Busca no Google
const urls = await this.searchReelsOnGoogle(keyword);

// 2. Scrapa dados dos posts encontrados
for (const url of urls) {
  const run = await this.client.actor('apify/instagram-posts-scraper').call({
    urls: [url],
  });
  // ... processa dados
}
```

## Configuração Necessária

Adicionar ao `.env`:
```bash
SERPER_API_KEY=sua_chave_aqui
```

Obter em: https://serper.dev (conta gratuita com créditos)

## Fallback

Se Google Search falhar (sem API key ou erro), volta ao `fetchTopPostsLegacy()` que usa `instagram-hashtag-scraper`.

## Economia de CUs

| Abordagem | CUs por busca | Custo/mês | Resultado |
|-----------|---------------|-----------|-----------|
| Apify hashtag-scraper (antigo) | ~50 | $100+ | 0 Reels, muitos Image/Sidecar |
| **Google + Apify (novo)** | **~10** | **$20-30** | ✅ Reels verificados |
| Apify reel-scraper | Não funciona | - | - |

## Data de Implementação
- **Commit:** TBD
- **Status:** Pronto para uso (aguarda SERPER_API_KEY)
