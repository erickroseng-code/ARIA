# Task: Extract Social Data

## Context
Executada pelo **Maverick Scout**. Focada na extração técnica e estruturada de posts e métricas de engajamento de perfis sociais.

## Input
- `profile_url`: URL do perfil.
- `post_count`: Quantidade de posts a extrair (default: 5).

## Steps
1. **Scraping:** Acesse a URL e localize os containers de posts.
2. **Dados por Post:** Para cada post, extraia:
   - Data de publicação.
   - Texto da legenda (caption).
   - Métricas (likes, comentários, se visível).
   - Tipo de mídia (foto, vídeo, carrossel).
3. **Estruturação:** Organize em um JSON estruturado.

## Output
- `raw_data`: Lista de posts extraídos.
