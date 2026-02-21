# Task: Analyze Profile Structure (Análise da Promessa Visual)

## Contexto
Esta é a primeira etapa da "Navegação Humana" do Maverick Scout. Antes de ler os posts, ele precisa entender "quem essa pessoa diz que é". Isso é feito analisando a "Vitrine" do perfil: Foto, Bio e Destaques.

## Objetivo
Simular um usuário visitando o perfil pela primeira vez e extrair a "Promessa de Valor" baseada na estrutura fixa do perfil.

## Passos de Execução (Simulação de Navegação)

1.  **Acesso Inicial (Browser):**
    *   Navegar para `instagram.com/[username]`.
    *   **Ação Humana:** Aguardar carregamento visual completo.
    *   **Captura:** Tirar um "snapshot" mental (ou screenshot processado) do topo do perfil.

2.  **Análise da Bio (Texto & Links):**
    *   Ler o texto da Bio.
    *   Identificar palavras-chave de autoridade (ex: "Mentor", "CEO", "Ajudo você a...").
    *   Verificar se há link na bio (Linktree, Site próprio). *Nota: Não precisa clicar, apenas notar a existência.*

3.  **Investigação de Destaques (Highlights):**
    *   **Verificação:** "Existem bolinhas de destaque abaixo da bio?"
    *   **Leitura de Capas:** Ler os títulos dos destaques (ex: "Depoimentos", "Quem Sou", "Serviços").
    *   **Ação de Clique (Profundidade):**
        *   Se houver um destaque chamado "Comece Aqui", "Quem Sou" ou "Minha História": **CLICAR e assistir**.
        *   Resumir o que foi visto nesse destaque chave (ex: "Vídeo dele contando que era engenheiro e virou chef").

4.  **Síntese da Promessa:**
    *   Com base SOMENTE nisso (sem ler o feed ainda), responder: "Qual é a promessa desse perfil?"

## Output Esperado
```json
{
  "username": "@perfil",
  "bio_text": "Texto extraído",
  "has_highlights": true,
  "highlights_structure": ["Quem Sou", "Alunos", "Mentoria"],
  "key_highlight_summary": "No destaque 'Quem Sou', ele reforça autoridade de 10 anos de mercado.",
  "inferred_promise": "Promete ensinar engenheiros a cozinhar profissionalmente."
}
```

## Ferramentas
- `browser` (com capacidade de interação/clique).
- `visual-context-analyzer` (para ler textos em imagens/vídeos dos destaques).
