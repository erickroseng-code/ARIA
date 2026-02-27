/**
 * Search Scorer - TF-IDF + Relevância Semântica
 *
 * Implementa scoring avançado para ranqueamento de relevância
 */

export interface ScoredResult {
  chunkId: string;
  relevanceScore: number; // 0-100
  tfIdfScore: number;
  keywordMatchCount: number;
  hasExactMatch: boolean;
}

export class SearchScorer {
  private documentFrequency: Map<string, number> = new Map();
  private totalDocuments: number = 0;

  /**
   * Calcula IDF (Inverse Document Frequency) para todos os termos
   */
  buildIndex(allChunks: Array<{ id: string; content: string }>) {
    this.totalDocuments = allChunks.length;
    this.documentFrequency.clear();

    for (const chunk of allChunks) {
      const uniqueTerms = new Set<string>();
      const terms = this.tokenize(chunk.content);

      for (const term of terms) {
        uniqueTerms.add(term);
      }

      uniqueTerms.forEach(term => {
        this.documentFrequency.set(
          term,
          (this.documentFrequency.get(term) || 0) + 1
        );
      });
    }
  }

  /**
   * Calcula TF-IDF score para uma query contra um documento
   */
  calculateTfIdfScore(queryTerms: string[], chunkContent: string): number {
    const chunkTerms = this.tokenize(chunkContent);
    let totalScore = 0;

    for (const queryTerm of queryTerms) {
      // Tokenize query term the same way content is tokenized
      const tokenizedQueryTerm = this.tokenize(queryTerm)[0] || queryTerm.toLowerCase();

      // TF (Term Frequency) - quantas vezes aparece no documento
      const termFrequency = chunkTerms.filter(t => t === tokenizedQueryTerm).length;
      const tf = termFrequency > 0 ? 1 + Math.log(termFrequency) : 0;

      // IDF (Inverse Document Frequency)
      const docFrequency = this.documentFrequency.get(tokenizedQueryTerm) || 1;
      const idf = Math.log(this.totalDocuments / docFrequency);

      totalScore += tf * idf;
    }

    // Normalizar para escala 0-100
    return Math.min(100, (totalScore / queryTerms.length) * 10);
  }

  /**
   * Calcula relevância baseado em múltiplos fatores
   */
  calculateRelevanceScore(
    query: string,
    chunkContent: string,
    tfIdfScore: number,
    chunkLength: number
  ): number {
    const queryTerms = this.tokenize(query);
    const chunkTokens = this.tokenize(chunkContent);

    // 1. Keyword Match Count (0-30 pontos)
    let keywordMatches = 0;
    for (const term of queryTerms) {
      if (chunkTokens.includes(term)) {
        keywordMatches++;
      }
    }
    const keywordScore = Math.min(30, (keywordMatches / queryTerms.length) * 30);

    // 2. Exact Phrase Match (0-20 pontos)
    const phraseScore = this.hasPhrase(query, chunkContent) ? 20 : 0;

    // 3. TF-IDF Score (0-30 pontos)
    const tfIdfWeighted = (tfIdfScore / 100) * 30;

    // 4. Chunk Quality (0-20 pontos)
    // Chunks muito curtos têm menos pontos, chunks muito longos também
    const optimalLength = 300;
    let qualityScore = 0;
    if (chunkLength >= 50 && chunkLength <= 1000) {
      const distance = Math.abs(chunkLength - optimalLength);
      qualityScore = Math.max(0, 20 - (distance / optimalLength) * 5);
    }

    return Math.round(keywordScore + phraseScore + tfIdfWeighted + qualityScore);
  }

  /**
   * Tokeniza texto removendo stop words
   */
  private tokenize(text: string): string[] {
    const stopWords = new Set([
      'a', 'o', 'e', 'é', 'de', 'da', 'do', 'em', 'um', 'uma', 'que', 'ou',
      'para', 'com', 'sem', 'por', 'às', 'al', 'os', 'as', 'seu', 'sua'
    ]);

    return text
      .toLowerCase()
      .replace(/[^\wáéíóúàâêôãõç\s]/gu, '') // Keep accented characters
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }

  /**
   * Verifica se a query aparece como frase no texto
   */
  private hasPhrase(query: string, text: string): boolean {
    const normalizedQuery = query.toLowerCase().replace(/[^\wáéíóúàâêôãõç\s]/gu, '');
    const normalizedText = text.toLowerCase().replace(/[^\wáéíóúàâêôãõç\s]/gu, '');
    return normalizedText.includes(normalizedQuery);
  }
}
