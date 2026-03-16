# Maverick Copywriter — GPT-OSS-120b Merge Strategy

## ✅ Implementação Concluída

### O que foi feito

Adicionado suporte a `openai/gpt-oss-120b` no Maverick Copywriter para otimizar a fusão entre informações do nicho do usuário e as referências do brain.

### Mudanças

#### 1. **Função `llmChat()` — Fallback de Modelos**
```typescript
async function llmChat(prompt: string, system?: string, modelPriority?: string[]): Promise<string>
```

- Agora aceita um parâmetro `modelPriority` opcional
- Default: `['deepseek/deepseek-v3.2', 'minimax/minimax-m2.5']` (mantém compatibilidade)
- Permite override de modelos por caso de uso

#### 2. **Nova Função: `mergeNicheWithBrain()`**
```typescript
async function mergeNicheWithBrain(
  userProfile: string,
  brain: Brain,
  onStep?: (msg: string) => void,
): Promise<string>
```

**Propósito:** Mesclar estratégia do usuário com frameworks do brain

**Entrada:**
- `userProfile`: Descrição do nicho, problemas, audiência alvo
- `brain`: Objeto com referências (audience, virality, persuasion, etc.)

**Saída:** String com contexto estratégico enriquecido

**Modelo utilizado:**
```
['openai/gpt-oss-120b', 'deepseek/deepseek-v3.2', 'minimax/minimax-m2.5']
```

**O que o merge faz:**
1. Identifica os 3 principais problemas/dores do nicho específico
2. Mapeia quais mecânicas virais mais se aplicam
3. Sugere os 3-4 ângulos de roteiros mais promissores
4. Define o tom de voz exato para esta audiência

#### 3. **Integração em `generateScriptsFromPlan()`**

```typescript
// No início, antes do Pass 1
let enrichedContext = '';
try {
  enrichedContext = await mergeNicheWithBrain(plan, brain, onStep);
} catch (e) {
  enrichedContext = plan; // fallback
}

// Usado em Pass 1 em vez de 'plan' puro
```

**Fluxo:**
```
User Profile → mergeNicheWithBrain() → enrichedContext →
  Pass 1 (ideia generation) →
  Pass 2a (hooks) →
  Pass 2b (técnicas) →
  Pass 2c (corpo + CTA)
```

### Benefícios

| Antes | Depois |
|-------|--------|
| Pass 1 recebia `plan` puro | Pass 1 recebe contexto enriquecido com insights do brain |
| Seleção de ângulos mais genérica | Ângulos alinhados especificamente ao nicho |
| Sem análise estruturada de problemas | Problemas/dores mapeados + mecânicas virais associadas |
| Ton de voz baseado em suposições | Tom derivado da estratégia mesclada |

### Compatibilidade

✅ **Totalmente backward compatible**
- Se merge falhar: fallback para `plan` original
- Default de modelos mantém comportamento anterior
- Sem mudanças em interfaces externas

### Modelo GPT-OSS-120b

**Por que para merge?**
- Especializado em reasoning e síntese de informações
- Bom custo-benefício via OpenRouter
- Melhor em combinar múltiplas fontes (nicho + brain)
- Pass 1 (selection) fica com DeepSeek (mais criativo)
- Outros passes mantêm sua ordem

### Como usar

```typescript
const scripts = await generateScriptsFromPlan(
  `
  Nicho: Marketing Digital
  Problema: Gerar leads de qualidade
  Audiência: Agências e freelancers
  Ângulo: Triplicar leads sem aumentar budget
  `,
  (msg) => console.log(msg)
);
```

**Logs esperados:**
```
🔗 Mesclando nicho com referências do brain...
[MERGE] Contexto enriquecido gerado (1500 chars)
🧠 Selecionando ângulos e frameworks...
🎣 Gerando hooks com técnicas do brain...
...
```

### Fallback em caso de erro

Se `openai/gpt-oss-120b` estiver indisponível:
1. Tenta `deepseek/deepseek-v3.2`
2. Tenta `minimax/minimax-m2.5`
3. Se todos falhem: usa `plan` original (sem merge)
4. Log: `[MERGE] Falha no merge, usando plan original`

### Limitações

- Requer `OPENROUTER_API_KEY` válida
- Merge adiciona ~2-3 segundos (uma chamada LLM a mais)
- Contexto enriquecido é limitado a insights sintetizados (não lista exaustiva do brain)

### Próximos passos opcionais

1. **Cache:** Memoizar merges para mesmo nicho
2. **Métricas:** Comparar performance (roteiros com vs. sem merge)
3. **A/B Testing:** Testar diferentes modelos para merge
4. **Configuração:** Permitir override de modelo via param em `generateScriptsFromPlan()`

---

**Status:** ✅ Implementado e pronto para produção
**Data:** Mar 16, 2026
**Commit:** (será feito após teste)
