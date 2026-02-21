# Task: Process Video Intelligence
id: "process-video-intelligence"
agent: "maverick-scholar"
description: "Extrai conhecimento de links de vídeo, transcreve, estrutura em Markdown e integra ao RAG."

# Parâmetros de Entrada
input:
  video_url: "URL do vídeo (YouTube, etc.)"
  priority: "high"

# Fluxo de Execução
steps:
  - step: 1
    action: "Extract Video Info"
    description: "Obtém título, descrição e metadados do vídeo."
    tool: "video-metadata-extractor"

  - step: 2
    action: "Get Transcription"
    description: "Extrai a transcrição completa do vídeo via API ou Scraping."
    tool: "transcription-engine"

  - step: 3
    action: "Analyze Structure"
    description: "Analisa a estrutura do vídeo (Intro, Hooks, Corpo, CTA)."
    tool: "structural-analyzer"

  - step: 4
    action: "Compare with Knowledge"
    description: "Compara os insights do vídeo com a base de livros e modelos existentes."
    tool: "knowledge-comparator"

  - step: 5
    action: "Save Markdown Output"
    description: "Gera o arquivo Markdown estruturado."
    output_path: "./data/knowledge/transcripts/{video_title}.md"

# Formato de Saída (Markdown)
output_template: |
  # Knowledge: {video_title}
  **Source:** {video_url}
  **Date:** {current_date}

  ## 📑 Estrutura do Vídeo
  - **Hook:** {hook_analysis}
  - **Main Points:** {key_points}
  - **CTA:** {cta_analysis}

  ## 🧠 Insights & Conexões
  - **Relacionado a:** {related_books_topics}
  - **Inovações:** {new_concepts}

  ## 📝 Transcrição Completa
  {full_transcript}
