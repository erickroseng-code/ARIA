# Task: Semantic Post Analysis (Análise Semântica)

## Contexto
O **Maverick Scout** deve analisar o perfil não como um robô que conta likes, mas como um analista humano que lê e interpreta. O objetivo é entender a **mensagem** que está sendo passada, para compará-la depois com a promessa da Bio.

## Objetivo
Analisar os últimos 9 a 12 posts do perfil para extrair padrões de tópico, tom de voz e qualidade visual, ignorando métricas de engajamento.

## Passos de Execução

1.  **Coleta Visual & Textual:**
    *   Acessar os últimos 9 posts (Grid principal).
    *   Extrair o texto da legenda.
    *   Se for imagem: descrever o que há na imagem (ex: "Foto de rosto sorrindo", "Print de tweet", "Gráfico técnico").
    *   Se for vídeo (Reels): extrair os primeiros 5 segundos de legenda/áudio se possível, ou a capa.

2.  **Classificação de Tópicos:**
    *   Para cada post, atribuir uma *Tag de Assunto* (ex: #Vendas, #Motivacional, #VidaPessoal).
    *   Identificar se o post é **Técnico** (ensina algo), **Inspiracional** (frase/reflexão) ou **Lifestyle** (dia a dia).

3.  **Análise de Coerência (O "Teste da Promessa"):**
    *   *Pergunta Chave:* "Se eu não lesse a Bio e visse apenas esses 9 posts, o que eu acharia que essa pessoa faz?"
    *   Sintetizar essa resposta em uma frase. (ex: "Parece um influenciador de viagens, não um consultor financeiro").

## Formato de Output (JSON Intermediário)

O Scout deve entregar este objeto para o Strategist:

```json
{
  "profile_summary": {
    "username": "@usuario",
    "perceived_niche": "O nicho que PARECE ser pelos posts"
  },
  "posts_analysis": [
    {
      "id": 1,
      "type": "Reels",
      "visual_desc": "Pessoa falando para a câmera em ambiente de escritório",
      "topic_tag": "#DicaRapida",
      "is_technical": true
    },
    {
      "id": 2,
      "type": "Carrossel",
      "visual_desc": "Fundo preto com letras brancas grandes",
      "topic_tag": "#Motivacional",
      "is_technical": false
    }
    // ... até 9 posts
  ],
  "content_mix": {
    "technical_percent": "30%",
    "lifestyle_percent": "70%"
  },
  "visual_consistency_score": 4.5 // De 0 a 10 (baseado em paleta de cores/fontes repetidas)
}
```

## Ferramentas Recomendadas
- `browser` (para navegação).
- `visual-context-analyzer` (Vision API) para descrever as imagens/capas.
