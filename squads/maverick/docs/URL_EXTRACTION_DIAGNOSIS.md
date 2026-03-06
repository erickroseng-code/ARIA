# Diagnóstico: Extração de URLs do Apify

**Status:** Implementado sistema de debug para identificar por que URLs não estão sendo retornadas

## Como Diagnosticar

### 1. Execute a pesquisa de tendências com debug ativo

```bash
cd squads/maverick
npm run ts-node src/run-scout.ts  # ou seu comando de teste
```

### 2. Procure pelos logs de debug

Os logs aparecerão em `stderr` com este padrão:

```
[DEBUG] Estrutura do post retornado pelo Apify:
  Campos principais: [lista de campos]
  Tem 'url'? true|false | Tem 'shortCode'? true|false | Tem 'postUrl'? true|false | Tem 'id'? true|false | Tem 'code'? true|false
```

```
[DEBUG] Post sem URL encontrado: [primeiro 50 chars do caption]... | Campos: [lista completa]
```

```
[STEP] X/Y posts com URLs válidas extraídas
```

### 3. Analise os resultados

| Cenário | Significado | Ação |
|---------|-------------|------|
| `[STEP] 12/12 posts com URLs válidas` | ✅ Perfeito | Nenhuma |
| `[STEP] 8/12 posts com URLs válidas` | ⚠️ Alguns posts sem URL | Ver logs debug |
| `[STEP] 0/12 posts com URLs válidas` | ❌ Nenhuma URL | Problema com Apify |

## Estratégias de Fallback Implementadas

O código tenta extrair URLs na seguinte ordem:

```typescript
1. p.url                    ← Campo URL direto (melhor caso)
2. p.shortCode              ← Constrói a partir do short code
3. p.postUrl                ← Campo alternativo de URL
4. p.id                     ← Constrói a partir do ID
5. p.code                   ← Constrói a partir do code

Se nenhum funcionar → URL fica vazia → Post é filtrado
```

## Possíveis Causas

### 1. Apify retorna campos diferentes
**Sintoma:** Debug mostra `Tem 'url'? false` para todos

**Solução:** Adicionar novo fallback baseado no campo que Apify retorna
```bash
# Procure o campo no debug output
# Ex: se for 'href' em vez de 'url':
  else if (p.href) {
    url = p.href;
  }
```

### 2. Posts viralidade filtrados antes de URL ser extraída
**Sintoma:** Poucos posts no `[STEP] X/Y posts com URLs`

**Solução:** Verificar se `filterAndSortByVirality()` está removendo posts válidos
- Check: score mínimo = 25% do máximo
- Se todos os posts tiverem score baixo, aumentar limiar

### 3. Caption vazio ou muito curto
**Sintoma:** Posts não passam no `.filter(p => p.caption && p.caption.length > 20)`

**Solução:** Reduzir requisito de caption (linha 152)
```typescript
// Antes:
.filter(p => p.caption && p.caption.length > 20)

// Depois (mais tolerante):
.filter(p => p.caption && p.caption.length > 5)
```

## Próximos Passos

1. **Execute e capture os logs de debug**
2. **Compartilhe o output de debug** (especialmente a linha `Tem 'url'? ...`)
3. **Baseado no output, adicionaremos o fallback correto**

## Exemplo de Debug Output Esperado

```
[DEBUG] Estrutura do post retornado pelo Apify:
  Campos principais: likesCount, commentsCount, caption, shortCode, type, url, displayUrl, timestamp, id, ...
  Tem 'url'? true | Tem 'shortCode'? true | Tem 'postUrl'? false | Tem 'id'? true | Tem 'code'? false

[STEP] 8/12 posts com URLs válidas extraídas
```

---

**Última atualização:** 2026-03-06
**Commit:** ca900ee
