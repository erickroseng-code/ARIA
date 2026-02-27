/**
 * Index Builder - Constrói índice com metadados
 *
 * Gera IDs únicos, extrai metadados e indexa trechos
 */

import * as crypto from 'crypto';

export interface IndexedChunk {
  id: string; // UUID único do trecho
  source: string;
  content: string;
  tags: string[];
  metadata: {
    length: number;
    wordCount: number;
    category: string;
    importance: number; // 1-10
    keywords: string[];
    hash: string; // Para detectar duplicatas
  };
  createdAt: Date;
}

export class IndexBuilder {
  /**
   * Constrói índice a partir de chunks brutos
   */
  buildIndex(
    rawChunks: Array<{ source: string; content: string; tags: string[] }>
  ): IndexedChunk[] {
    return rawChunks.map((chunk, index) => {
      const hash = this.generateHash(chunk.content);
      const wordCount = this.countWords(chunk.content);
      const category = this.inferCategory(chunk.content);
      const importance = this.calculateImportance(chunk.content, wordCount);

      return {
        id: this.generateId(chunk.source, index, hash),
        source: chunk.source,
        content: chunk.content,
        tags: chunk.tags,
        metadata: {
          length: chunk.content.length,
          wordCount,
          category,
          importance,
          keywords: this.extractKeywords(chunk.content),
          hash,
        },
        createdAt: new Date(),
      };
    });
  }

  /**
   * Gera ID único determinístico baseado no conteúdo
   */
  private generateId(source: string, index: number, hash: string): string {
    // Formato: SOURCE_INDEX_HASH
    // Remove file extension first, then clean
    const sourceNoExt = source.replace(/\.[^/.]+$/, '');
    const cleanSource = sourceNoExt.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const shortHash = hash.substring(0, 8);
    return `${cleanSource}_${index}_${shortHash}`;
  }

  /**
   * Gera hash SHA256 do conteúdo
   */
  private generateHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Conta número de palavras
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).length;
  }

  /**
   * Infere categoria baseado em palavras-chave
   */
  private inferCategory(content: string): string {
    const text = content.toLowerCase();

    if (text.includes('estratégia') || text.includes('posicionamento')) {
      return 'strategy';
    }
    if (text.includes('conteúdo') || text.includes('post')) {
      return 'content';
    }
    if (text.includes('engajamento') || text.includes('audiência')) {
      return 'engagement';
    }
    if (text.includes('venda') || text.includes('conversão')) {
      return 'sales';
    }
    if (text.includes('marca') || text.includes('identidade')) {
      return 'branding';
    }
    if (text.includes('autoridade') || text.includes('expertise')) {
      return 'authority';
    }

    return 'general';
  }

  /**
   * Calcula importância (1-10) baseado em tamanho e densidade de keywords
   */
  private calculateImportance(content: string, wordCount: number): number {
    let score = 5; // Base score

    // Chunks pequenos (< 50 words) - menos importância
    if (wordCount < 50) {
      score -= 2;
    }

    // Chunks grandes (> 500 words) - mais importância
    if (wordCount > 500) {
      score += 2;
    }

    // Chunks com muito texto (> 1000 words) - máxima importância
    if (wordCount > 1000) {
      score = 10;
    }

    // Bonus se tem números/dados
    if (/\d+%|R\$\s*\d+|\d+\.\d+/.test(content)) {
      score += 1;
    }

    return Math.min(10, Math.max(1, score));
  }

  /**
   * Extrai keywords principais usando TF baseado em frequência
   */
  private extractKeywords(content: string): string[] {
    const stopWords = new Set([
      'a', 'o', 'e', 'é', 'de', 'da', 'do', 'em', 'um', 'uma', 'que', 'ou',
      'para', 'com', 'sem', 'por', 'às', 'al', 'os', 'as', 'seu', 'sua',
      'mais', 'muito', 'pouco', 'qual', 'quando', 'onde', 'como', 'se'
    ]);

    const tokens = content
      .toLowerCase()
      .replace(/[^\wáéíóúàâêôãõç\s]/gu, '') // Keep accented characters
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w));

    // Contar frequência
    const frequency = new Map<string, number>();
    for (const token of tokens) {
      frequency.set(token, (frequency.get(token) || 0) + 1);
    }

    // Pegar top 10 keywords mais frequentes
    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword]) => keyword);
  }

  /**
   * Detecta chunks duplicados baseado em hash
   */
  findDuplicates(chunks: IndexedChunk[]): Map<string, IndexedChunk[]> {
    const hashMap = new Map<string, IndexedChunk[]>();

    for (const chunk of chunks) {
      const hash = chunk.metadata.hash;
      if (!hashMap.has(hash)) {
        hashMap.set(hash, []);
      }
      hashMap.get(hash)!.push(chunk);
    }

    // Retornar apenas hashes com duplicatas
    const duplicates = new Map<string, IndexedChunk[]>();
    hashMap.forEach((chunksList, hash) => {
      if (chunksList.length > 1) {
        duplicates.set(hash, chunksList);
      }
    });

    return duplicates;
  }

  /**
   * Calcula estatísticas do índice
   */
  getIndexStats(chunks: IndexedChunk[]): Record<string, any> {
    const categories = new Map<string, number>();
    let totalWords = 0;
    const importanceDistribution = { '1': 0, '5': 0, '10': 0 };

    for (const chunk of chunks) {
      categories.set(
        chunk.metadata.category,
        (categories.get(chunk.metadata.category) || 0) + 1
      );
      totalWords += chunk.metadata.wordCount;

      if (chunk.metadata.importance <= 3) importanceDistribution['1']++;
      else if (chunk.metadata.importance <= 7) importanceDistribution['5']++;
      else importanceDistribution['10']++;
    }

    // Converter Map para objeto (compatível com TypeScript older)
    const categoriesObj: Record<string, number> = {};
    categories.forEach((value, key) => {
      categoriesObj[key] = value;
    });

    return {
      totalChunks: chunks.length,
      totalWords,
      avgChunkLength: Math.round(totalWords / chunks.length),
      categories: categoriesObj,
      importanceDistribution,
      duplicateRate: (this.findDuplicates(chunks).size / chunks.length) * 100,
    };
  }
}
