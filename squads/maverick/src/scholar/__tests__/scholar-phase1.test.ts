/**
 * Fase 1 Tests - Scholar Engine Improvements
 *
 * Testa: IndexBuilder, SearchScorer, ImprovedScholarEngine
 */

import { IndexBuilder, IndexedChunk } from '../index-builder';
import { SearchScorer } from '../search-scorer';
import { ImprovedScholarEngine } from '../engine-improved';

describe('Fase 1: Scholar Engine Improvements', () => {
  describe('IndexBuilder', () => {
    let builder: IndexBuilder;

    beforeEach(() => {
      builder = new IndexBuilder();
    });

    test('gera IDs únicos determinísticos', () => {
      const chunks = [
        {
          source: 'manifesto.txt',
          content: 'Este é um conteúdo de teste muito importante',
          tags: ['teste'],
        },
        {
          source: 'manifesto.txt',
          content: 'Outro conteúdo similar mas diferente',
          tags: ['teste'],
        },
      ];

      const indexed = builder.buildIndex(chunks);

      expect(indexed[0].id).toBeDefined();
      expect(indexed[1].id).toBeDefined();
      expect(indexed[0].id).not.toBe(indexed[1].id);
      expect(indexed[0].id).toMatch(/MANIFESTO_\d+_[a-f0-9]{8}/);
    });

    test('extrai metadados corretamente', () => {
      const chunks = [
        {
          source: 'test.txt',
          content:
            'Estratégia de posicionamento de marca é fundamental para sucesso',
          tags: [],
        },
      ];

      const indexed = builder.buildIndex(chunks);
      const chunk = indexed[0];

      expect(chunk.metadata.length).toBe(
        'Estratégia de posicionamento de marca é fundamental para sucesso'
          .length
      );
      expect(chunk.metadata.wordCount).toBeGreaterThan(0);
      expect(chunk.metadata.category).toBe('strategy');
      expect(chunk.metadata.importance).toBeGreaterThan(0);
      expect(chunk.metadata.importance).toBeLessThanOrEqual(10);
      expect(chunk.metadata.keywords.length).toBeGreaterThan(0);
      expect(chunk.metadata.hash).toBeDefined();
    });

    test('infere categoria corretamente', () => {
      const testCases = [
        {
          content: 'A estratégia de posicionamento é importante',
          expected: 'strategy',
        },
        {
          content: 'Crie conteúdo de alta qualidade para seus posts',
          expected: 'content',
        },
        {
          content: 'Aumente o engajamento da sua audiência',
          expected: 'engagement',
        },
        {
          content: 'Técnicas de venda e conversão online',
          expected: 'sales',
        },
        {
          content: 'Construir autoridade no mercado',
          expected: 'authority',
        },
      ];

      for (const testCase of testCases) {
        const indexed = builder.buildIndex([
          { source: 'test.txt', content: testCase.content, tags: [] },
        ]);
        expect(indexed[0].metadata.category).toBe(testCase.expected);
      }
    });

    test('calcula importância baseado em tamanho', () => {
      const smallChunk = {
        source: 'test.txt',
        content: 'Pequeno',
        tags: [],
      };

      const largeChunk = {
        source: 'test.txt',
        content:
          'palavra '.repeat(600) +
          ' com muito texto para calcular importância',
        tags: [],
      };

      const indexedSmall = builder.buildIndex([smallChunk]);
      const indexedLarge = builder.buildIndex([largeChunk]);

      expect(indexedSmall[0].metadata.importance).toBeLessThan(
        indexedLarge[0].metadata.importance
      );
    });

    test('detecta duplicatas', () => {
      const chunks = [
        {
          source: 'file1.txt',
          content: 'Conteúdo idêntico para testar',
          tags: [],
        },
        {
          source: 'file2.txt',
          content: 'Conteúdo idêntico para testar',
          tags: [],
        },
        {
          source: 'file3.txt',
          content: 'Conteúdo diferente',
          tags: [],
        },
      ];

      const indexed = builder.buildIndex(chunks);
      const duplicates = builder.findDuplicates(indexed);

      expect(duplicates.size).toBe(1); // Um hash duplicado
      expect(Array.from(duplicates.values())[0]).toHaveLength(2);
    });

    test('calcula estatísticas do índice', () => {
      const chunks = [
        {
          source: 'test.txt',
          content: 'Estratégia de posicionamento é importante',
          tags: [],
        },
        {
          source: 'test.txt',
          content: 'Crie conteúdo de alta qualidade',
          tags: [],
        },
      ];

      const indexed = builder.buildIndex(chunks);
      const stats = builder.getIndexStats(indexed);

      expect(stats.totalChunks).toBe(2);
      expect(stats.totalWords).toBeGreaterThan(0);
      expect(stats.avgChunkLength).toBeGreaterThan(0);
      expect(stats.categories).toBeDefined();
      expect(stats.importanceDistribution).toBeDefined();
    });
  });

  describe('SearchScorer', () => {
    let scorer: SearchScorer;

    beforeEach(() => {
      scorer = new SearchScorer();
    });

    test('calcula TF-IDF score', () => {
      const chunks = [
        { id: '1', content: 'estratégia de posicionamento' },
        { id: '2', content: 'conteúdo de qualidade' },
        { id: '3', content: 'estratégia estratégia e posicionamento em marketing' }, // estratégia aparece 2x
      ];

      scorer.buildIndex(chunks);

      const score1 = scorer.calculateTfIdfScore(['estratégia'], chunks[0].content);
      const score3 = scorer.calculateTfIdfScore(['estratégia'], chunks[2].content);

      expect(score3).toBeGreaterThan(score1); // chunk[3] tem "estratégia" 2x vs 1x
    });

    test('calcula relevance score corretamente', () => {
      const chunks = [{ id: '1', content: 'teste de relevância' }];
      scorer.buildIndex(chunks);

      const score = scorer.calculateRelevanceScore(
        'relevância',
        'teste de relevância',
        50,
        20
      );

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    test('detecta exact phrase match', () => {
      const chunks = [
        {
          id: '1',
          content: 'A estratégia de posicionamento é fundamental',
        },
      ];
      scorer.buildIndex(chunks);

      const scoreWithPhrase = scorer.calculateRelevanceScore(
        'estratégia de posicionamento',
        chunks[0].content,
        50,
        chunks[0].content.length
      );

      const scoreWithoutPhrase = scorer.calculateRelevanceScore(
        'marketing digital online',
        chunks[0].content,
        0,
        chunks[0].content.length
      );

      expect(scoreWithPhrase).toBeGreaterThan(scoreWithoutPhrase);
    });
  });

  describe('ImprovedScholarEngine', () => {
    let engine: ImprovedScholarEngine;

    beforeEach(() => {
      engine = new ImprovedScholarEngine();
    });

    test('inicializa sem erros', () => {
      expect(engine).toBeDefined();
    });

    test('search retorna array vazio se base não carregada', () => {
      const results = engine.search('teste');
      expect(results).toEqual([]);
    });

    test('searchByCategory filtra por categoria', async () => {
      await engine.loadKnowledgeBase();
      const results = engine.searchByCategory('estratégia', 'strategy', 5);

      for (const result of results) {
        expect(result.category).toBe('strategy');
      }
    });

    test('searchByImportance filtra por importância', async () => {
      await engine.loadKnowledgeBase();
      const results = engine.searchByImportance('teste', 7, 5);

      for (const result of results) {
        expect(result.importance).toBeGreaterThanOrEqual(7);
      }
    });

    test('findRelated encontra chunks relacionados', async () => {
      await engine.loadKnowledgeBase();
      const indexInfo = engine.getIndexInfo();

      if (indexInfo.chunks.length > 0) {
        const firstChunkId = indexInfo.chunks[0].id;
        const related = engine.findRelated(firstChunkId);

        for (const chunk of related) {
          expect(chunk.chunkId).not.toBe(firstChunkId);
        }
      }
    });

    test('legacySearch mantém compatibilidade', async () => {
      await engine.loadKnowledgeBase();
      const results = await engine.legacySearch('teste', 3);

      for (const result of results) {
        expect(result.source).toBeDefined();
        expect(result.content).toBeDefined();
        expect(result.tags).toBeDefined();
      }
    });
  });
});
