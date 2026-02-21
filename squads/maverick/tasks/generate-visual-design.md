# Task: Generate Visual Design (Design Automatizado)

## Contexto
Temos o texto do carrossel ou a ideia da thumbnail pronta (vinda do Copywriter). Agora, o **Designer** precisa materializar isso visualmente.

## Objetivo
Gerar arquivos de imagem prontos para postar (PNG/JPG) ou links editáveis (Canva/Figma), respeitando a identidade visual do cliente.

## Passos de Execução

1.  **Ingestão de Identidade Visual:**
    *   Carregar a paleta de cores (Hex codes) do perfil.
    *   Carregar as fontes tipográficas (ou as mais próximas disponíveis).
    *   Carregar o logo e fotos do expert.

2.  **Mapeamento de Layout:**
    *   Para Carrossel: Escolher um layout "Slide mestre" para texto e um "Slide Capa" para impacto.
    *   Para Thumbnail: Escolher layout de alto contraste (Rosto + Texto Grande).

3.  **Geração (Renderização):**
    *   Inserir o texto do Copywriter nos slots do template.
    *   Ajustar tamanho da fonte para não quebrar o layout.
    *   Aplicar imagens de fundo ou elementos gráficos.

## Output Esperado
*   **Links:** "🔗 [Abrir no Canva]" ou "🔗 [Abrir no Figma]".
*   **Arquivos:** Lista de imagens geradas (slide1.png, slide2.png...).

## Ferramentas
- `figma-mcp-connector` (API do Figma).
- `canva-mcp-connector` (Integração Canva).
- `asset-exporter` (Renderizador de imagem).
