# Task: Compile Strategic Markdown (Plano de Ação Maverick)

## Contexto
O **Maverick Strategist** já recebeu os dados do **Scout** (Diagnóstico do Perfil Atual) e cruzou com os conceitos do **Scholar** (Base de Conhecimento). Agora, ele precisa materializar isso em um documento final legível e acionável para o usuário.

## Objetivo
Gerar um documento Markdown bem estruturado que sirva como um "Plano de Guerra" para o perfil. O documento deve evidenciar o gap entre a promessa (Bio) e a entrega (Posts), e propor a solução baseada no conhecimento do expert.

## Estrutura do Documento (Template)

O output deve seguir rigorosamente esta estrutura Markdown:

```markdown
# 🦅 Plano de Ação Maverick: [Nome do Perfil]
**Data:** {{date}}
**Status:** 🟡 Aguardando Aprovação

---

## 1. O Diagnóstico (A Realidade Atual)

### 📸 A Promessa (Bio & Destaques)
*Análise do que o perfil *diz* que é.*
- **Bio:** "{{bio_text}}"
- **Promessa Identificada:** [Interpretação da promessa]
- **Destaques:** [Lista dos destaques e o que eles comunicam. Se não houver, apontar como falha grave]

### 📢 A Entrega (Análise dos Posts)
*Análise do que o perfil *realmente* entrega.*
- **Tópicos Recentes:** [Lista dos assuntos abordados nos últimos 9 posts]
- **Coerência:** [Nota de 0 a 10 sobre o quanto os posts entregam a promessa da Bio]
- **O Gap:** [Explicação clara da desconexão encontrada]

---

## 2. A Estratégia (O Caminho do Expert)

Baseado no conceito **"{{core_concept_from_scholar}}"** da sua Base de Conhecimento:

### 🎯 O Novo Posicionamento
- **Ajuste de Bio Sugerido:** [Sugestão de nova bio]
- **Destaques Obrigatórios:** [Lista de 3 destaques que precisam ser criados urgente]

### 🗓️ Pilares de Conteúdo
1. **[Pilar 1 - Atração]:** [Explicação do pilar]
2. **[Pilar 2 - Conexão]:** [Explicação do pilar]
3. **[Pilar 3 - Autoridade]:** [Explicação do pilar]

---

## 3. Próximos Passos (Para Aprovação)

O **Maverick Copywriter** está pronto para escrever os seguintes roteiros baseados neste plano:

1. **Roteiro 1 (Reels):** [Título do Tópico]
2. **Roteiro 2 (Carrossel):** [Título do Tópico]
3. **Roteiro 3 (Stories):** [Título do Tópico]

> **Comando:** Digite "Aprovado" para gerar os roteiros acima ou solicite alterações neste plano.
```

## Inputs Necessários
- `profile_data`: JSON do Scout com bio, destaques e análise semântica dos posts.
- `knowledge_concepts`: JSON do Scholar com os conceitos chave que devem ser ensinados.

## Output Esperado
- Um único bloco de texto em formato Markdown renderizável no chat.
- (Opcional) Link para download se convertido para PDF.
