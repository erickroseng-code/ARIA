/**
 * Improved Scholar Engine
 *
 * Integra IndexBuilder + SearchScorer para search inteligente
 */

import { DocumentParser, DocumentChunk } from './parsers';
import { IndexBuilder, IndexedChunk } from './index-builder';
import { SearchScorer } from './search-scorer';
import * as fs from 'fs';
import * as path from 'path';

export interface SearchResult {
  chunkId: string;
  source: string;
  content: string;
  relevanceScore: number; // 0-100
  category: string;
  importance: number; // 1-10
  keywords: string[];
  matchedKeywords: string[];
}

export class ImprovedScholarEngine {
  private indexedChunks: IndexedChunk[] = [];
  private parser: DocumentParser;
  private indexBuilder: IndexBuilder;
  private scorer: SearchScorer;
  private knowledgeDir: string;

  constructor() {
    this.parser = new DocumentParser();
    this.indexBuilder = new IndexBuilder();
    this.scorer = new SearchScorer();
    this.knowledgeDir = path.resolve(__dirname, '../../data/knowledge');

    if (!fs.existsSync(this.knowledgeDir)) {
      fs.mkdirSync(this.knowledgeDir, { recursive: true });
    }
  }

  /**
   * Carrega e indexa base de conhecimento
   */
  async loadKnowledgeBase(): Promise<void> {
    console.log('📚 Scholar: Carregando e indexando base de conhecimento...');
    const files = fs.readdirSync(this.knowledgeDir);

    const rawChunks: DocumentChunk[] = [];

    for (const file of files) {
      try {
        const filePath = path.join(this.knowledgeDir, file);

        if (fs.statSync(filePath).isDirectory()) continue;

        const fileChunks = await this.parser.parseFile(filePath);
        rawChunks.push(...fileChunks);
      } catch (e) {
        console.warn(`⚠️ Erro ao ler ${file}:`, e);
      }
    }

    // Construir índice
    this.indexedChunks = this.indexBuilder.buildIndex(rawChunks);

    // Treinar scorer
    this.scorer.buildIndex(
      this.indexedChunks.map(c => ({ id: c.id, content: c.content }))
    );

    // Detectar duplicatas
    const duplicates = this.indexBuilder.findDuplicates(this.indexedChunks);
    if (duplicates.size > 0) {
      console.warn(`⚠️ Detectados ${duplicates.size} trechos duplicados`);
    }

    // Estatísticas
    const stats = this.indexBuilder.getIndexStats(this.indexedChunks);
    console.log(`✅ Base Indexada: ${this.indexedChunks.length} fragmentos`);
    console.log(`   📊 Estatísticas:`, stats);
  }

  /**
   * Busca avançada com scoring de relevância
   */
  search(query: string, limit: number = 5): SearchResult[] {
    if (this.indexedChunks.length === 0) {
      console.warn('⚠️ Base de conhecimento não carregada');
      return [];
    }

    const queryTerms = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    const scoredResults = this.indexedChunks
      .map(chunk => {
        const tfIdfScore = this.scorer.calculateTfIdfScore(
          queryTerms,
          chunk.content
        );

        const relevanceScore = this.scorer.calculateRelevanceScore(
          query,
          chunk.content,
          tfIdfScore,
          chunk.metadata.length
        );

        // Matchadas keywords
        const matchedKeywords = chunk.metadata.keywords.filter(kw =>
          queryTerms.some(qt => kw.includes(qt) || qt.includes(kw))
        );

        return {
          chunkId: chunk.id,
          source: chunk.source,
          content: chunk.content,
          relevanceScore,
          category: chunk.metadata.category,
          importance: chunk.metadata.importance,
          keywords: chunk.metadata.keywords,
          matchedKeywords,
        };
      })
      .filter(result => result.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);

    console.log(
      `🔍 Search: "${query}" retornou ${scoredResults.length}/${this.indexedChunks.length} resultados`
    );

    return scoredResults;
  }

  /**
   * Busca por categoria específica
   */
  searchByCategory(
    query: string,
    category: string,
    limit: number = 5
  ): SearchResult[] {
    const allResults = this.search(query, limit * 2);
    return allResults
      .filter(r => r.category === category)
      .slice(0, limit);
  }

  /**
   * Busca por importance range
   */
  searchByImportance(
    query: string,
    minImportance: number,
    limit: number = 5
  ): SearchResult[] {
    const allResults = this.search(query, limit * 2);
    return allResults
      .filter(r => r.importance >= minImportance)
      .slice(0, limit);
  }

  /**
   * Encontra trechos relacionados por ID
   */
  findRelated(chunkId: string, limit: number = 3): SearchResult[] {
    const chunk = this.indexedChunks.find(c => c.id === chunkId);
    if (!chunk) return [];

    const query = chunk.metadata.keywords.slice(0, 3).join(' ');
    const results = this.search(query, limit + 1);

    return results.filter(r => r.chunkId !== chunkId).slice(0, limit);
  }

  /**
   * Retorna informações do índice
   */
  getIndexInfo(): Record<string, any> {
    return {
      totalChunks: this.indexedChunks.length,
      stats: this.indexBuilder.getIndexStats(this.indexedChunks),
      chunks: this.indexedChunks.map(c => ({
        id: c.id,
        source: c.source,
        length: c.metadata.length,
        category: c.metadata.category,
        importance: c.metadata.importance,
      })),
    };
  }

  /**
   * Compatibilidade com engine antigo - usa novo search
   */
  async legacySearch(query: string, limit: number = 3): Promise<DocumentChunk[]> {
    const results = this.search(query, limit);
    return results.map(r => ({
      source: r.source,
      content: r.content,
      tags: r.keywords,
    }));
  }
}
