# Task: Analyze Social Profile

## Context
Esta tarefa é executada pelo **Maverick Scout**. O objetivo é navegar em um perfil de rede social (URL fornecida pelo usuário) e extrair informações críticas para a estratégia de conteúdo.

## Input
- `profile_url`: A URL do perfil (Instagram, LinkedIn, etc.)
- `depth`: Nível de profundidade (bio-only, last-5-posts, full-analysis)

## Steps
1. **Navegação:** Use a ferramenta `browser` para acessar a URL fornecida.
2. **Extração de Bio:** Capture o nome, biografia, link na bio e contagem de seguidores.
3. **Análise de Conteúdo:**
   - Leia os últimos posts (conforme `depth`).
   - Identifique os tópicos recorrentes.
   - Extraia as hashtags mais usadas.
4. **Detecção de Tom de Voz:**
   - Analise o estilo de escrita (formal, casual, agressivo, acolhedor).
   - Identifique bordões ou padrões de linguagem.
5. **Output de Snapshot:**
   - Salve os dados brutos em `squads/maverick/data/snapshots/raw_profile_{timestamp}.json`.
   - Gere um resumo em Markdown para o **Maverick Strategist**.

## Output
- `profile_summary`: Objeto contendo bio, tom de voz e principais tópicos.
- `snapshot_path`: Caminho do arquivo de dados salvo.

## Validation
- Verifique se a URL foi acessível.
- Confirme se o tom de voz foi identificado com pelo menos 3 adjetivos justificáveis.
