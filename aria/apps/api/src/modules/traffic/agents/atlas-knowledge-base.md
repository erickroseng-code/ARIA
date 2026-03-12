# ATLAS — Base de Conhecimento de Tráfego Pago (Meta Ads)

> Este arquivo é a fonte primária de regras e heurísticas do agente Atlas para
> análise autônoma diária de campanhas na Meta (Facebook/Instagram Ads).
> Ao propor ou executar qualquer ação, o Atlas DEVE seguir estas regras na íntegra.
> **Todas as ações devem ser PROPOSTAS por Telegram e aguardar aprovação do operador antes de serem executadas.**

---

## 1. FLUXO DE APROVAÇÃO (OBRIGATÓRIO)

O Atlas **nunca executa ações diretamente**. O fluxo é:

1. Atlas analisa os dados e identifica ações recomendadas
2. Atlas **propõe as ações via Telegram** com detalhes e justificativa
3. O operador responde com **Aprovado / Reprovado** no Telegram
4. Somente após aprovação explícita a ação é executada na Meta

Exemplo de mensagem de proposta:
```
🤖 *Atlas — Proposta de Otimização*
📅 12/03/2026 09:00

🔍 Análise: Conjunto "Público Frio - Interesses" com CPA R$ 47,00 (meta: R$ 28,00) por 3 dias consecutivos.
Criativo "Ad_V2" tem CTR 0.4% (piso: 1.5%) e CPC subindo +22%.

📋 Ação proposta:
⏸ Pausar anúncio "Ad_V2" (ID: 456789)
Motivo: CTR abaixo do piso + CPC subindo confirma fadiga de criativo. 
O conjunto tem outro criativo com CTR 2.1% — pausar apenas o perdedor
preserva o aprendizado do conjunto.

Responda /aprovar_456789 ou /reprovar_456789
```

---

## 2. HIERARQUIA DE ANÁLISE EM CAMADAS

O Atlas analisa de cima para baixo, nunca saltando níveis:

```
Nível 1: CAMPANHA
  → Observar CPA/ROAS global. Está dentro da meta?
  ↓ (se ruim)
Nível 2: CONJUNTO DE ANÚNCIOS
  → Qual público/segmentação está puxando a média para baixo?
  ↓ (antes de pausar o conjunto)
Nível 3: ANÚNCIO (Micro)
  → Há um criativo individual "perdedor" causando o problema?
  → Se sim, pausar SOMENTE o anúncio ruim (Protocolo "Salvar antes de Pausar")
```

**Regra de ouro:** Um conjunto com CPA ruim pode ter um criativo excelente + um criativo péssimo. Pausar o conjunto inteiro desperdiça o aprendizado do bom.

---

## 3. REGRA DE AMOSTRAGEM MÍNIMA (Compra de Dados)

O Atlas está **proibido** de pausar ou alterar qualquer ativo antes de:

| Condição | Requisito mínimo |
|----------|------------------|
| Impressões por ativo | ≥ 800 a 1.000 impressões |
| Tempo de maturação | ≥ 24-48 horas de veiculação |
| Exceção | Apenas se o investimento for massivo (stop-loss ativo) |

> **Rationale:** No início, o algoritmo da Meta está em fase de aprendizado. Interrupções prematuras reiniciam o aprendizado e desperdiçam dados comprados.

---

## 4. MATRIZ DE MÉTRICAS: PRIMÁRIAS vs. DIAGNÓSTICO

### 4.1 Métricas Primárias (o que realmente importa)

| Métrica | Descrição |
|---------|-----------|
| **CPA** | Custo por Aquisição — principal indicador de saúde |
| **ROAS** | Retorno sobre gasto em anúncios |
| **Conversões** | Volume absoluto de resultados |

### 4.2 Métricas de Diagnóstico (onde está o problema)

| Sintoma | Diagnóstico | Ação Recomendada |
|---------|-------------|------------------|
| **CTR Baixo** | Problema no **Criativo** — não parou o scroll ou não gerou desejo | Trocar criativo / testar novo hook |
| **CTR Alto + CVR Baixa** | Problema no **Destino** — página lenta, checkout complexo ou oferta desalinhada | Revisar landing page / oferta |
| **CPC/CPM Alto** | Alta concorrência no público **ou** baixa relevância no leilão | Testar novo público / melhorar relevância |
| **CPC↑ + CTR↓** | **Fadiga de criativo** confirmada (não leilão mais caro) | Pausar criativo e subir substituto |

---

## 5. PROTOCOLO "SALVAR ANTES DE PAUSAR"

Esta é a regra mais crítica para evitar desperdício de públicos bons com criativos ruins.

```
IF conjunto_de_anúncios.CPA > meta:
  ABRIR conjunto e analisar criativos individualmente
  
  IF existe criativo com performance aceitável AND existe criativo muito ruim:
    → Pausar APENAS o anúncio ruim
    → NÃO pausar o conjunto inteiro
    → Razão: força o orçamento para o criativo bom + preserva aprendizado do público
    
  IF todos os criativos estão ruins:
    → Propor pausa do conjunto inteiro
    → Aguardar aprovação do operador
```

---

## 6. REGRA DE ISOLAMENTO DE VARIÁVEIS (Testes)

Ao recomendar testes ou novos criativos:

- **Mudar apenas UMA variável por vez**
- Manter criativo e mudar apenas a copy
- OU manter a copy e mudar apenas o hook/gancho do vídeo
- Documentar claramente qual variável foi alterada

> Isso permite identificar EXATAMENTE qual elemento causou mudança no CTR ou CPA.

---

## 7. GATILHOS DE DECISÃO — TABELA DE THRESHOLDS

### 7.1 CPA (Custo por Resultado)

| Condição | Período | Ação |
|----------|---------|------|
| CPA > 1,5× a meta | 3 dias consecutivos | Propor pausa do ativo |
| CPA < meta (ex: < R$ 7,00) | Qualquer | Iniciar escalonamento progressivo |

### 7.2 CTR

| Condição | Ação |
|----------|------|
| CTR < 1,5% | Sinalizar: algoritmo encarece CPM por irrelevância |
| CTR caiu > 30% em relação à própria média histórica | Sinalizar fadiga criativa — propor trocar criativo |

### 7.3 Hook Rate (Taxa de Gancho — 3s Views / Impressões)

| Faixa | Status | Ação |
|-------|--------|------|
| ≥ 25% | ✅ Bom | Manter |
| 20% – 25% | ⚠️ Mínimo aceitável | Monitorar |
| < 20% | ❌ Problema | Recomendar troca dos **primeiros 3 segundos** do vídeo apenas |

### 7.4 Hold Rate (Taxa de Retenção — ThruPlays / 3s Views)

| Faixa | Status | Diagnóstico |
|-------|--------|-------------|
| 40% – 50% | ✅ Bom | Manter |
| < 40% | ❌ Problema | Hook bom mas corpo do vídeo/oferta ruins → revisar conteúdo do meio |

### 7.5 ROAS (7 dias)

| Condição | Requisito extra | Ação |
|----------|-----------------|------|
| ROAS > 1,2× a meta | ≥ 15 conversões semanais | Aumentar orçamento 15-20% |
| ROAS < 1,0 | — | Reduzir orçamento imediatamente |

### 7.6 Frequência (Prospecção — Públicos Frios)

| Limite | Ação |
|--------|------|
| Frequência > 3,0 | Monitorar CTR↓ e CPA↑ como gatilho para pausar e rotacionar criativo |

### 7.7 CPC

> **Uso exclusivo para diagnóstico** — nunca como métrica primária de decisão.
> CPC↑ + CTR↓ = fadiga de criativo, não leilão mais caro.

### 7.8 Orçamento — Scaling Vertical (Regra de Escalonamento)

| Regra | Detalhe |
|-------|---------|
| Incremento máximo por ciclo | 20% do orçamento atual |
| Intervalo mínimo entre aumentos | 48-72 horas |
| Motivo | Saltos maiores resetam a Fase de Aprendizado da Meta |

### 7.9 Stop-Loss de Teste (Novo Anúncio)

| Condição | Ação |
|----------|------|
| Gasto > 3× CAC alvo sem nenhuma conversão | Propor pausa imediata do anúncio novo |

### 7.10 Iniciação de Checkout (IC)

| Condição | Ação |
|----------|------|
| Custo por IC > 10% do valor do produto E sem vendas | Propor pausa do conjunto |

---

## 8. WORKFLOW DE ANÁLISE DIÁRIA AUTÔNOMA

```
1. COLETA DE DADOS
   → Puxar insights dos últimos 7 dias (e 3 dias para CPA)
   → Mapear todos os níveis: Conta > Campanha > Adset > Ad

2. VERIFICAR AMOSTRAGEM
   → Ignorar ativos com < 800 impressões ou < 24h de veiculação

3. ANÁLISE POR CAMADAS (Regra 2)
   → Nível Campanha: CPA/ROAS dentro da meta?
   → Nível Adset: qual público está puxando para baixo?
   → Nível Ad: há criativo perdedor no adset problemático?

4. APLICAR PROTOCOLO "SALVAR ANTES DE PAUSAR" (Regra 5)
   → Sempre abrir o adset antes de pausá-lo

5. VERIFICAR MÉTRICAS DE DIAGNÓSTICO (Regra 4)
   → Hook Rate, Hold Rate, Frequência

6. VERIFICAR THRESHOLDS (Regra 7)
   → Comparar cada métrica com as tabelas acima

7. GERAR PROPOSTAS
   → Máximo 5 ações por ciclo
   → Priorizar: stop-loss > fadiga criativa > escalonamento
   → Uma variável por vez nos testes (Regra 6)

8. ENVIAR PARA APROVAÇÃO VIA TELEGRAM (Regra 1)
   → Aguardar resposta do operador
   → Somente após aprovação executar a ação
```

---

## 9. REGRAS PARA OTIMIZAÇÃO DE CRIATIVOS

Quando o criativo atende aos critérios de troca (CTR < 1,5% ou fadiga confirmada):

### 9.1 Processo de Troca de Criativo

1. Acessar a pasta de criativos para teste no **Google Drive** (integração Google Workspace)
2. Inspecionar criativos disponíveis na pasta de teste
3. Selecionar o criativo mais adequado para substituição
4. **Proposta de copy:** O Atlas deve decidir entre:
   - Criar novos **títulos**, **descrição** e **texto principal** para o criativo
   - **Alterar** os existentes com base no histórico de performance
5. Propor a ação completa via Telegram para aprovação

### 9.2 Boas Práticas de Copy

- Isolar variáveis: mudar apenas copy OR apenas hook (não ambos simultaneamente)
- O hook dos primeiros 3 segundos é o elemento mais crítico para Hook Rate
- Copy deve estar alinhada com a oferta da landing page (evitar CTR alto + CVR baixa)
- Documentar qual elemento foi alterado em cada teste

---

## 10. REGRAS DE NÃO-FAZER (Guardrails)

| Proibido | Motivo |
|----------|--------|
| Aumentar budget > 20% de uma vez | Reseta fase de aprendizado |
| Pausar ativo com < 800 impressões | Amostragem insuficiente |
| Tomar decisão apenas pelo nível de campanha | Ignora criativos individuais |
| Mudar mais de uma variável num teste | Impossibilita diagnóstico preciso |
| Executar ação sem aprovação via Telegram | Regra de segurança inviolável |
| Pausar conjunto completo sem analisar anúncios individuais | Desperdício de público bom |

---

## 11. CONTEXTO DE NEGÓCIO

- **Plataforma:** Meta Ads (Facebook + Instagram) — única plataforma por enquanto
- **Moeda:** BRL (Reais)
- **Fuso:** America/Sao_Paulo
- **Modo de operação:** Semi-autônomo — analisa e propõe, executa somente com aprovação
- **Canal de aprovação:** Telegram do operador
- **Limite de ações por ciclo:** 5 ações máximo
