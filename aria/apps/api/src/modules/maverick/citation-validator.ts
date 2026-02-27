/**
 * Citation Validator - Valida citações contra a base de conhecimento
 *
 * Extrai citações do texto, encontra trechos correspondentes,
 * e calcula score de confiança para cada citação
 */

export interface CitationValidationResult {
  citation: string; // Texto citado
  found: boolean; // Se foi encontrado na base
  chunkId?: string; // ID do trecho encontrado
  source?: string; // Fonte do trecho
  confidenceScore: number; // 0-100
  matchType: 'exact' | 'fuzzy' | 'not_found'; // Tipo de correspondência
  excerpt?: string; // Trecho correspondente (primeiros 200 chars)
}

export interface ValidatorStats {
  totalCitations: number;
  validCitations: number;
  invalidCitations: number;
  validationRate: number; // %
  averageConfidence: number; // 0-100
  matchTypeDistribution: {
    exact: number;
    fuzzy: number;
    notFound: number;
  };
}

export class CitationValidator {
  /**
   * Extrai citações de um texto
   * Procura por padrões: "[citação]", "citação:" ou "de acordo com X"
   */
  extractCitations(text: string): string[] {
    const citations: string[] = [];

    // Padrão 1: [citação]
    const bracketPattern = /\[([^\]]+)\]/g;
    let match;
    while ((match = bracketPattern.exec(text)) !== null) {
      citations.push(match[1].trim());
    }

    // Padrão 2: "citação:"
    const colonPattern = /["""]([^""]+)["""]\s*:/g;
    while ((match = colonPattern.exec(text)) !== null) {
      citations.push(match[1].trim());
    }

    // Padrão 3: "de acordo com" ou "segundo"
    const attributionPattern = /(?:de acordo com|segundo|conforme)\s+["""]([^""]+)["""]/gi;
    while ((match = attributionPattern.exec(text)) !== null) {
      citations.push(match[1].trim());
    }

    // Remove duplicatas
    return [...new Set(citations)];
  }

  /**
   * Valida uma citação contra base de conhecimento
   */
  validateCitation(
    citation: string,
    indexedChunks: Array<{ id: string; source: string; content: string; metadata: any }>
  ): CitationValidationResult {
    const citationLower = citation.toLowerCase().trim();

    // Buscar match exato
    for (const chunk of indexedChunks) {
      const contentLower = chunk.content.toLowerCase();

      if (contentLower.includes(citationLower)) {
        return {
          citation,
          found: true,
          chunkId: chunk.id,
          source: chunk.source,
          confidenceScore: 100,
          matchType: 'exact',
          excerpt: chunk.content.substring(0, 200),
        };
      }
    }

    // Buscar match fuzzy (palavras-chave)
    const citationWords = this.extractKeywords(citationLower);
    const bestMatch = this.findFuzzyMatch(citationWords, indexedChunks);

    if (bestMatch.score > 0) {
      return {
        citation,
        found: true,
        chunkId: bestMatch.chunkId,
        source: bestMatch.source,
        confidenceScore: bestMatch.score,
        matchType: 'fuzzy',
        excerpt: bestMatch.excerpt,
      };
    }

    // Não encontrado
    return {
      citation,
      found: false,
      confidenceScore: 0,
      matchType: 'not_found',
    };
  }

  /**
   * Valida múltiplas citações
   */
  validateCitations(
    text: string,
    indexedChunks: Array<{ id: string; source: string; content: string; metadata: any }>
  ): CitationValidationResult[] {
    const citations = this.extractCitations(text);
    return citations.map(citation => this.validateCitation(citation, indexedChunks));
  }

  /**
   * Calcula estatísticas de validação
   */
  getValidationStats(results: CitationValidationResult[]): ValidatorStats {
    if (results.length === 0) {
      return {
        totalCitations: 0,
        validCitations: 0,
        invalidCitations: 0,
        validationRate: 0,
        averageConfidence: 0,
        matchTypeDistribution: {
          exact: 0,
          fuzzy: 0,
          notFound: 0,
        },
      };
    }

    const validCitations = results.filter(r => r.found).length;
    const invalidCitations = results.length - validCitations;

    const matchDistribution = {
      exact: results.filter(r => r.matchType === 'exact').length,
      fuzzy: results.filter(r => r.matchType === 'fuzzy').length,
      notFound: results.filter(r => r.matchType === 'not_found').length,
    };

    const averageConfidence =
      results.reduce((sum, r) => sum + r.confidenceScore, 0) / results.length;

    return {
      totalCitations: results.length,
      validCitations,
      invalidCitations,
      validationRate: (validCitations / results.length) * 100,
      averageConfidence: Math.round(averageConfidence),
      matchTypeDistribution: matchDistribution,
    };
  }

  /**
   * Extrai palavras-chave de um texto (para match fuzzy)
   */
  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'a', 'o', 'e', 'é', 'de', 'da', 'do', 'em', 'um', 'uma', 'que', 'ou',
      'para', 'com', 'sem', 'por', 'às', 'al', 'os', 'as', 'seu', 'sua',
      'mais', 'muito', 'pouco', 'qual', 'quando', 'onde', 'como', 'se',
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    ]);

    return text
      .toLowerCase()
      .replace(/[^\wáéíóúàâêôãõç\s]/gu, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));
  }

  /**
   * Encontra o melhor match fuzzy
   */
  private findFuzzyMatch(
    citationWords: string[],
    indexedChunks: Array<{ id: string; source: string; content: string; metadata: any }>
  ): {
    score: number;
    chunkId?: string;
    source?: string;
    excerpt?: string;
  } {
    let bestScore = 0;
    let bestMatch: any = { score: 0 };

    for (const chunk of indexedChunks) {
      const chunkWords = this.extractKeywords(chunk.content);
      const matchCount = citationWords.filter(word =>
        chunkWords.some(cw => cw.includes(word) || word.includes(cw))
      ).length;

      if (matchCount === 0) continue;

      // Score: % de palavras encontradas
      const score = (matchCount / citationWords.length) * 100;

      // Require at least 50% match
      if (score >= 50 && score > bestScore) {
        bestScore = score;
        bestMatch = {
          score: Math.round(score * 0.8), // Reduz 20% pois é fuzzy
          chunkId: chunk.id,
          source: chunk.source,
          excerpt: chunk.content.substring(0, 200),
        };
      }
    }

    return bestMatch;
  }
}
