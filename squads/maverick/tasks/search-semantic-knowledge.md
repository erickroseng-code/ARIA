# Task: Search Semantic Knowledge (Busca Semântica)

## Contexto
O **Strategist** pergunta: "O perfil está falando sobre *Vendas*, mas de um jeito fraco. O que o Expert diz sobre *Vendas* que poderia melhorar isso?". O Scholar precisa buscar a resposta exata na base.

## Objetivo
Realizar uma busca vetorial (por significado, não por palavra-chave exata) para encontrar os conceitos mais relevantes que corrigem ou enriquecem o tópico em questão.

## Passos de Execução

1.  **Refinamento da Query:**
    *   Receber a dúvida do Strategist (ex: "Conceitos de Liderança para Instagram").
    *   Transformar em uma query de busca (ex: "Definição de liderança moderna", "Erros comuns de liderança").

2.  **Busca Vetorial (RAG):**
    *   Buscar os 5 fragmentos mais similares na base de conhecimento.
    *   Filtrar por "Conceito Central" se necessário (dar preferência ao material core do expert).

3.  **Síntese da Resposta:**
    *   Não devolver apenas o texto solto.
    *   Sintetizar: "Segundo o livro X (Cap. 2), a liderança deve ser servidora. O erro comum é focar no cargo."

## Output Esperado (JSON para o Strategist)
```json
{
  "query": "Liderança",
  "key_concepts": [
    {
      "source": "Livro: Liderança Extrema",
      "concept": "Liderança é atitude, não cargo.",
      "quote": "Não espere o título para liderar.",
      "relevance": 0.95
    }
  ],
  "synthesis": "O material do expert defende fortemente que liderança é uma postura diária."
}
```

## Ferramentas
- `rag-engine`.
