# Task: Load Knowledge Source (Ingestão de Conhecimento)

## Contexto
Para que o Maverick seja um especialista, ele precisa "ler" os materiais de referência (livros do expert, transcrições de aulas, PDFs técnicos). Esta task define como o Scholar absorve esse conteúdo.

## Objetivo
Processar arquivos brutos (PDF, TXT, MD, Áudio transcrito), fragmentá-los (chunking) e armazená-los na base vetorial (RAG) com metadados ricos.

## Passos de Execução

1.  **Identificação da Fonte:**
    *   Tipo: Livro, Transcrição de Aula, Artigo, Manual.
    *   Autoridade: Definir se é "Conceito Central" (imutável) ou "Referência Secundária".

2.  **Processamento de Texto (Parsing):**
    *   Limpar cabeçalhos/rodapés repetitivos de PDFs.
    *   Normalizar quebras de linha.
    *   Identificar capítulos ou seções lógicas.

3.  **Fragmentação (Chunking Inteligente):**
    *   Não cortar frases no meio.
    *   Tamanho ideal: parágrafos completos ou conceitos inteiros (aprox. 500-1000 tokens).
    *   **Metadado Vital:** Cada chunk deve ter uma tag de "Tópico" (ex: #Vendas, #Filosofia, #TécnicaX).

4.  **Indexação Vetorial:**
    *   Gerar embeddings do texto.
    *   Salvar no banco de dados vetorial.

## Output Esperado
*   Confirmação: "📚 Livro 'A Arte da Guerra' processado. 142 fragmentos indexados sobre #Estratégia e #Liderança."

## Ferramentas
- `document-parser` (ex: LlamaParse, PyPDF).
- `rag-engine` (ex: Pinecone, ChromaDB).
