# Graham Redesign — Checkpoint #1

**Data:** 2026-03-31
**Status:** Em progresso — Visual base completo, estrutura de abas pendente
**Commit:** `feat(graham): redesign visual completo com color-coding semântico`

---

## ✅ O QUE FOI FEITO (Sessão 1)

### 1. **Redesign Visual Completo**
- **KPI Cards coloridos:**
  - Receitas → verde (emerald) com TrendingUp
  - Despesas → vermelho (rose) com TrendingDown
  - Dívidas → âmbar (amber) com CreditCard
  - **Saldo líquido** (novo) → verde/vermelho semântico

- **Badges semânticos:**
  - `TypeBadge`: Receita (↓ verde) / Despesa (↑ vermelho)
  - `OverdueBadge`: ⚠️ Xd em vermelho para itens vencidos

- **Botões de ação coloridos:**
  - `+ Receita` (verde), `+ Despesa` (vermelho), `+ Dívida` (âmbar), `+ Atrasada` (vermelho forte)

- **Tabelas melhoradas:**
  - Ações visíveis apenas no hover (menos poluição)
  - Valores de receita em verde, despesa em vermelho
  - Status de despesas fixas → toggle colorido (verde=ativa)
  - Empty states com texto sutil

- **Modais:**
  - Header colorido por tipo (verde/vermelho/âmbar/vermelho)
  - Labels estruturados em uppercase
  - Inputs com foco visual melhorado
  - Backdrop blur + cantos arredondados

### 2. **Month Selector Minimalista**
- ✅ Reduzido de 5 para 3 meses (anterior, atual, próximo)
- ✅ Removido label "Competência"
- ✅ Mostra só a abreviação do mês (ex: "Mar", "Abr", "Mai")
- ✅ Bem mais compacto

### 3. **Código limpo**
- Adicionado `DollarSign` ao import (corrigido erro)
- Mantida toda a lógica funcional intacta
- Commit + push realizado

---

## 🚧 O QUE FALTA (Próxima Sessão)

### 1. **Sistema de Abas** (3 seções)
Implementar componente `Tab` que alterne entre:

```
Dashboard (HOME)      | Dívidas & Contas  | Decisões (Chat)
```

**Dashboard (ABA 1)** — Já pronto, so precisa ser isolado:
- Month selector minimalista ✅
- KPI cards (receitas, despesas, saldo) ✅
- Botões: `+ Receita`, `+ Despesa` (remover `+ Dívida`, `+ Atrasada`)
- Tabela de Fluxo de Caixa ✅

**Dívidas & Contas (ABA 2)** — Mover 2 seções:
- Tabela de Dívidas (com botões "Parcela", "Quitar")
- Tabela de Contas Atrasadas (com botões "Pagar", "Quitar")
- Botões: `+ Dívida`, `+ Atrasada`
- Card de resumo total (Dívidas: R$X | Atrasadas: R$X)

**Decisões (ABA 3)** — NOVA seção (Chat)
- Interface de chat simples
- Usuário digita perguntas (ex: "Vou conseguir quitar até fim do mês?", "Relatório mensal")
- Conecta com API `/api/finance/decisions` ou similar (não existe ainda, será criado depois)
- Botões rápidos: "Relatório PDF", "Análise de gastos", "Sugestões"
- Histórico de conversa

**Despesas fixas** — Manter onde está, mas pode ser movido pra aba "Dívidas & Contas" se quiser

---

## 📋 TAREFAS PRÓXIMAS (Ordem)

### Tarefa 1: Estrutura de Abas
**Arquivo:** `FinanceSession.tsx`
**O quê:**
- Criar estado `currentTab: 'dashboard' | 'debts' | 'decisions'`
- Criar componente `TabBar` com 3 botões
- Renderizar componentes baseado em `currentTab`
- Remover `+ Dívida` e `+ Atrasada` da aba Dashboard

**Complexidade:** Baixa (refactor simples)

### Tarefa 2: Aba "Dívidas & Contas"
**Arquivo:** Criar `DebtsSection.tsx` ou deixar inline
**O quê:**
- Mover tabelas de dívidas e atrasadas
- Adicionar botões `+ Dívida` e `+ Atrasada`
- Adicionar card de resumo total colorido
- Manter toda lógica de delete/pay

**Complexidade:** Baixa (é só extraction de código existente)

### Tarefa 3: Aba "Decisões (Chat)"
**Arquivo:** Criar `DecisionsTab.tsx` ou deixar inline
**O quê:**
- Interface de chat simples (input + histórico)
- Botões rápidos de ação (Relatório, Análise, Sugestões)
- Estilo minimalista (match com Graham)
- Conectar com endpoint (mock primeiro, depois real)

**Complexidade:** Média (novo componente)

### Tarefa 4: API de Decisões (Backend)
**Arquivo:** `aria/apps/api/src/modules/finance/finance.routes.ts`
**O quê:**
- Endpoint `POST /api/finance/decisions` que aceita `{ message: string }`
- LLM recebe contexto financeiro do mês (saldo, receitas, despesas, dívidas)
- Retorna resposta estruturada
- Salva no DB para histórico

**Complexidade:** Média

---

## 🎨 Design Decisions Finalizadas

✅ Color-coding semântico (receita=verde, despesa=vermelho, dívida=âmbar)
✅ Hover-based actions (menos poluição)
✅ Minimalista no month selector
✅ KPI cards equilibrados (sem dívida no dashboard)
✅ 3 abas bem definidas

---

## 📸 Visual Checklist

- [x] KPI cards coloridos
- [x] Badges semânticos
- [x] Hover actions
- [x] Modais bonitos
- [x] Month selector minimalista
- [ ] Aba bar (visual)
- [ ] Chat interface (design)

---

## 🔗 Referências

**Commit anterior:**
```
feat(graham): redesign visual completo com color-coding semântico
```

**Arquivo principal:**
```
aria/apps/web/src/components/chat/FinanceSession.tsx
```

**Próxima: Implementar 3 abas + chat**
