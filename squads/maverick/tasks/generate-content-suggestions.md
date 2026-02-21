# Task: Generate Content Suggestions

## Context
Executada pelo **Maverick Strategist**. Transforma o diagnóstico inicial em uma lista acionável de ideias de conteúdo.

## Input
- `strategic_diagnosis`: O relatório gerado na fase de diagnóstico.
- `quantity`: Quantidade de sugestões (default: 5).

## Steps
1. **Brainstorming Estratégico:** Com base no "gap" identificado, proponha temas que gerem curiosidade e autoridade.
2. **Definição de Objetivo:** Para cada sugestão, defina um objetivo (Engajamento, Autoridade, Venda, Educação).
3. **Draft de Título:** Crie 3 opções de títulos "magnéticos" para cada tema.
4. **Resumo do Conteúdo:** Descreva em 2 frases o que o post/vídeo deve abordar.
5. **Indicação de Fonte:** Cite qual livro do Scholar deu origem a essa sugestão.

## Output
- `content_suggestions`: Lista de pautas com títulos, objetivos e fontes.
