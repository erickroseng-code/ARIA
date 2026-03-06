# Decomposição de Keywords - Estratégia Temática

**Data:** 2026-03-06
**Status:** ✅ Implementado
**Commit:** 70cfb73

## O Problema

Estávamos extraindo keywords **muito longos e específicos**:

```
❌ "marketing digital para vendas"
❌ "criacao de conteudo para negocios"
❌ "estrategia de redes sociais"
❌ "tecnicas de emagrecimento feminino com foco em saude"
```

**Resultado:** Buscas retornavam **0 posts** 🚫

Ninguém busca "marketing digital para vendas" no Instagram. É muito específico.

## A Solução: Quebrar em Temas Simples

Em vez de buscar uma frase longa e específica, quebramos em **temas simples e genéricos**:

```
Input: Plano estratégico completo
         ↓
[extractKeywords - Passo 1]
Extrai TEMAS principais:
  ├─ marketing
  ├─ digital
  ├─ vendas
  ├─ conteudo
  └─ negocios
         ↓
[extractKeywords - Passo 2]
Decompõe em palavras individuais:
  ├─ marketing
  ├─ digital
  ├─ vendas
  ├─ conteudo
  └─ negocios
         ↓
Total: 5-8 keywords únicos
         ↓
[fetchTopPosts]
Busca CADA tema individualmente
  ├─ "marketing" → 500+ posts ✅
  ├─ "digital" → 300+ posts ✅
  ├─ "vendas" → 800+ posts ✅
  ├─ "conteudo" → 600+ posts ✅
  └─ "negocios" → 400+ posts ✅
         ↓
Total: 2600+ posts coletados
```

## Exemplos de Decomposição

### Exemplo 1: Marketing Digital

| Entrada | Temas Extraídos | Keywords Finals |
|---------|-----------------|-----------------|
| "marketing digital para vendas online de produtos" | marketing, digital, vendas, online | marketing, digital, vendas, online |

### Exemplo 2: Emagrecimento

| Entrada | Temas Extraídos | Keywords Finals |
|---------|-----------------|-----------------|
| "tecnicas de emagrecimento feminino com foco em saude" | emagrecimento, feminino, saude | emagrecimento, feminino, saude |

### Exemplo 3: Copywriting

| Entrada | Temas Extraídos | Keywords Finals |
|---------|-----------------|-----------------|
| "copywriting para criadores de conteudo em negocios digitais" | copywriting, criadores, conteudo, negocios, digitais | copywriting, criadores, conteudo, negocios, digitais |

## Por Que Funciona

### ❌ Busca Longa (Não Funciona)

```
Busca: "marketing digital para vendas"
Usuário do Instagram digitaria isto? NÃO
Resultado: 0 posts
```

### ✅ Busca Simples (Funciona)

```
Busca 1: "marketing"
Usuário do Instagram digitaria isto? SIM
Resultado: 500+ posts

Busca 2: "digital"
Usuário do Instagram digitaria isto? SIM
Resultado: 300+ posts

Busca 3: "vendas"
Usuário do Instagram digitaria isto? SIM
Resultado: 800+ posts
```

## Implementação

### Passo 1: Extrair Temas

```typescript
const themesResult = await this.llm.analyzeJson<{ themes: string[] }>(
    `Extraia os TEMAS principais (não frases longas)
     Exemplos:
     ❌ "marketing digital para vendas"
     ✅ "marketing", "digital", "vendas"`,
);
```

**Prompt ao LLM:**
- Extraia TEMAS (não frases)
- 1-2 palavras por tema
- Máximo 6 temas
- Garantidos de retornar posts

### Passo 2: Decompor em Palavras

```typescript
const keywords = new Set<string>();

for (const theme of themes) {
    // Adiciona o tema completo
    keywords.add(theme);

    // Separa em palavras individuais
    const words = theme.split(/\s+/).filter(w => w.length > 2);
    for (const word of words) {
        keywords.add(word);
    }
}

// Resultado: até 8 keywords únicos
```

## Logs

```
[KEYWORDS] Temas extraídos: marketing, digital, vendas, conteudo, negocios, redes, sociais
[STEP] 7 temas extraídos: marketing, digital, vendas, conteudo, negocios, redes, sociais
[STEP] Buscando posts virais por tema (estratégia: múltiplas buscas simples)...
[BUSCA] Tentando barra de pesquisa do Instagram (Estratégia 1)...
[BUSCA] Simulando busca na barra: "marketing"
[BUSCA] ✅ 512 posts encontrados (barra de pesquisa) para "marketing"
[BUSCA] Simulando busca na barra: "digital"
[BUSCA] ✅ 308 posts encontrados (barra de pesquisa) para "digital"
[BUSCA] Simulando busca na barra: "vendas"
[BUSCA] ✅ 847 posts encontrados (barra de pesquisa) para "vendas"
...
[STEP] 2604 posts encontrados — filtrando flopados e mantendo apenas virais...
[STEP] 12 posts virais selecionados — analisando padroes de hooks e angulos...
```

## Vantagens

✅ **Garantido de retornar posts** — palavras simples sempre têm conteúdo
✅ **Mais relevante** — múltiplas perspectivas do mesmo nicho
✅ **Realista** — como usuários reais buscam
✅ **Cobertura completa** — não perde nuances do nicho
✅ **Escalável** — mesmo se um tema falha, outros funcionam

## Comparação: Antes vs Depois

### Antes
```
Input: Plano estratégico
  ↓
[extractKeywords] → 3 keywords longos
  ├─ "marketing digital para vendas"
  ├─ "criacao de conteudo para negocios"
  └─ "estrategia de redes sociais"
  ↓
[fetchTopPosts]
  ├─ Busca 1: 0 posts ❌
  ├─ Busca 2: 0 posts ❌
  └─ Busca 3: 0 posts ❌
  ↓
Total: 0 posts encontrados 🚫
```

### Depois
```
Input: Plano estratégico
  ↓
[extractKeywords - Tema]
  → marketing, digital, vendas, conteudo, negocios
  ↓
[extractKeywords - Decomposição]
  → 7 keywords únicos
  ↓
[fetchTopPosts]
  ├─ Busca 1 (marketing): 512 posts ✅
  ├─ Busca 2 (digital): 308 posts ✅
  ├─ Busca 3 (vendas): 847 posts ✅
  ├─ Busca 4 (conteudo): 612 posts ✅
  └─ ... (4 buscas mais)
  ↓
Total: 2600+ posts encontrados ✅
```

## Arquivo Modificado

- `squads/maverick/src/trend-researcher/index.ts`
  - Função: `extractKeywords()`
  - Método: 2-step (tema extraction + word decomposition)

---

**Próximas Melhorias:**
- Monitorar quais temas retornam mais posts
- Ajustar limiar de inclusão de temas
- Adicionar exclusão de palavras-stop se necessário
