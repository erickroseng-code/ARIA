# Task: Diagnose Profile vs. Knowledge

## Context
Esta tarefa é executada pelo **Maverick Strategist**. É o ponto de integração estratégica onde comparamos a realidade atual do perfil social (vinda do **Maverick Scout**) com o potencial de autoridade técnica (vindo do **Maverick Scholar**). O objetivo é identificar "gaps" de autoridade e oportunidades de diferenciação.

## Input
- `profile_summary`: Dados consolidados do tom de voz e tópicos atuais do cliente.
- `knowledge_brief`: Insights e conceitos técnicos extraídos da base de livros.

## Steps
1. **Análise de Lacunas (Gap Analysis):**
   - Identifique quais conceitos da base de conhecimento o perfil atual *não* está explorando.
   - Analise se o tom de voz atual é compatível com a autoridade que os livros sugerem.
2. **Desenvolvimento de Ângulos Estratégicos:**
   - Crie 3 "Ângulos de Ataque" que unam um problema do seguidor (identificado no perfil) com uma solução técnica (vinda dos livros).
3. **Definição de Pilar Editorial:**
   - Proponha uma nova linha editorial que eleve o nível de consciência da audiência usando o conhecimento do Scholar.
4. **Geração de Sugestões de Conteúdo:**
   - Liste 5 temas de posts/vídeos com títulos magnéticos e o "porquê" estratégico por trás de cada um.
5. **Output de Diagnóstico:**
   - Salve o relatório completo em `squads/maverick/data/snapshots/diagnosis_{timestamp}.md`.

## Output
- `strategic_diagnosis`: Um relatório executivo contendo o gap de autoridade, ângulos sugeridos e sugestões de pauta.
- `diagnosis_path`: Caminho para o arquivo Markdown gerado.

## Validation
- O diagnóstico deve ser embasado em pelo menos dois livros da base Scholar.
- As sugestões devem respeitar o tom de voz base do cliente ou propor uma transição suave.
- O relatório deve ser claro o suficiente para que o **Maverick Copywriter** consiga escrever os roteiros sem pedir mais contexto.
