/**
 * Traceability Service Tests
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { TraceabilityService } from '../traceability.service';

describe('TraceabilityService', () => {
  let service: TraceabilityService;
  let mockPrisma: any;

  const mockTraces = [
    {
      sourceId: 'MANIFESTO_0_87ffe253',
      sourceText: 'Estratégia de posicionamento de marca é fundamental...',
      fullSourceUrl: 'knowledge.md#chunk-1',
      contextUsed: 'Used in strategy section',
      citationText: '[Estratégia de posicionamento]',
      positionInAnalysis: 'strategy',
      isValid: true,
      validationScore: 100,
      relevanceScore: 95,
      confidenceScore: 100,
      hallucination: false,
    },
    {
      sourceId: 'CONTENT_1_34ffd891',
      sourceText: 'Conteúdo de qualidade atrai clientes...',
      fullSourceUrl: 'guide.md#chunk-2',
      contextUsed: 'Used in analysis section',
      citationText: '[Conteúdo de qualidade]',
      positionInAnalysis: 'analysis',
      isValid: true,
      validationScore: 85,
      relevanceScore: 88,
      confidenceScore: 85,
      hallucination: false,
    },
    {
      sourceId: 'FAKE_2_99999999',
      sourceText: 'Informação falsa que não existe...',
      fullSourceUrl: 'unknown.md#chunk-3',
      contextUsed: 'Used in conclusion',
      citationText: '[Informação falsa]',
      positionInAnalysis: 'conclusion',
      isValid: false,
      validationScore: 0,
      relevanceScore: 0,
      confidenceScore: 0,
      hallucination: true,
    },
  ];

  beforeEach(() => {
    mockPrisma = {
      knowledgeTrace: {
        create: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({}),
      },
      sourceMetadata: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    service = new TraceabilityService(mockPrisma);
  });

  describe('traceAnalysis', () => {
    test('registra traces de análise', async () => {
      const analysisId = 'analysis-123';

      await service.traceAnalysis(analysisId, mockTraces);

      expect(mockPrisma.knowledgeTrace.create).toHaveBeenCalledTimes(
        mockTraces.length
      );

      const calls = mockPrisma.knowledgeTrace.create.mock.calls;
      expect(calls[0][0].data.analysisId).toBe(analysisId);
      expect(calls[0][0].data.sourceId).toBe('MANIFESTO_0_87ffe253');
    });

    test('limita sourceText a 500 caracteres', async () => {
      const longTrace = {
        ...mockTraces[0],
        sourceText: 'x'.repeat(600),
      };

      await service.traceAnalysis('analysis-123', [longTrace]);

      const call = mockPrisma.knowledgeTrace.create.mock.calls[0][0].data;
      expect(call.sourceText.length).toBe(500);
    });

    test('atualiza metadados de fonte', async () => {
      await service.traceAnalysis('analysis-123', [mockTraces[0]]);

      // Verifica se tentou atualizar sourceMetadata
      expect(mockPrisma.sourceMetadata.findUnique).toHaveBeenCalled();
    });
  });

  describe('getAnalysisTrace', () => {
    test('retorna traces de uma análise', async () => {
      mockPrisma.knowledgeTrace.findMany.mockResolvedValueOnce(mockTraces);

      const result = await service.getAnalysisTrace('analysis-123');

      expect(mockPrisma.knowledgeTrace.findMany).toHaveBeenCalledWith({
        where: { analysisId: 'analysis-123' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockTraces);
    });
  });

  describe('getTraceByPosition', () => {
    test('filtra traces por posição na análise', async () => {
      const strategyTraces = mockTraces.filter(
        t => t.positionInAnalysis === 'strategy'
      );
      mockPrisma.knowledgeTrace.findMany.mockResolvedValueOnce(strategyTraces);

      const result = await service.getTraceByPosition('analysis-123', 'strategy');

      expect(mockPrisma.knowledgeTrace.findMany).toHaveBeenCalledWith({
        where: {
          analysisId: 'analysis-123',
          positionInAnalysis: 'strategy',
        },
      });
    });
  });

  describe('getTraceBySource', () => {
    test('retorna todos os usos de uma fonte', async () => {
      const sourceTraces = mockTraces.filter(
        t => t.sourceId === 'MANIFESTO_0_87ffe253'
      );
      mockPrisma.knowledgeTrace.findMany.mockResolvedValueOnce(sourceTraces);

      const result = await service.getTraceBySource('MANIFESTO_0_87ffe253');

      expect(mockPrisma.knowledgeTrace.findMany).toHaveBeenCalledWith({
        where: { sourceId: 'MANIFESTO_0_87ffe253' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getAllHallucinations', () => {
    test('retorna apenas alucinações', async () => {
      const hallucinations = mockTraces.filter(t => t.hallucination);
      mockPrisma.knowledgeTrace.findMany.mockResolvedValueOnce(hallucinations);

      const result = await service.getAllHallucinations();

      expect(mockPrisma.knowledgeTrace.findMany).toHaveBeenCalledWith({
        where: { hallucination: true },
        orderBy: { createdAt: 'desc' },
        include: {
          maverickAnalysis: {
            select: { id: true, username: true, createdAt: true },
          },
        },
      });
    });
  });

  describe('getAnalysisHallucinations', () => {
    test('retorna alucinações de uma análise específica', async () => {
      const hallucinations = mockTraces.filter(t => t.hallucination);
      mockPrisma.knowledgeTrace.findMany.mockResolvedValueOnce(hallucinations);

      const result = await service.getAnalysisHallucinations('analysis-123');

      expect(mockPrisma.knowledgeTrace.findMany).toHaveBeenCalledWith({
        where: { analysisId: 'analysis-123', hallucination: true },
      });
    });
  });

  describe('getTraceStats', () => {
    test('calcula estatísticas de rastreamento', async () => {
      mockPrisma.knowledgeTrace.findMany.mockResolvedValueOnce(mockTraces);
      mockPrisma.sourceMetadata.findMany.mockResolvedValueOnce([]);

      const stats = await service.getTraceStats();

      expect(stats.totalTracedSources).toBe(3);
      expect(stats.validSources).toBe(2);
      expect(stats.invalidSources).toBe(1);
      expect(stats.hallucinationCount).toBe(1);
      expect(stats.averageConfidence).toBeGreaterThan(0);
      expect(stats.averageRelevance).toBeGreaterThan(0);
    });

    test('retorna zeros quando não há traces', async () => {
      mockPrisma.knowledgeTrace.findMany.mockResolvedValueOnce([]);

      const stats = await service.getTraceStats();

      expect(stats.totalTracedSources).toBe(0);
      expect(stats.validSources).toBe(0);
      expect(stats.averageConfidence).toBe(0);
    });

    test('filtra por analysisId se fornecido', async () => {
      mockPrisma.knowledgeTrace.findMany.mockResolvedValueOnce([]);

      await service.getTraceStats('analysis-123');

      expect(mockPrisma.knowledgeTrace.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { analysisId: 'analysis-123' },
        })
      );
    });
  });

  describe('recordFeedback', () => {
    test('registra feedback do usuário', async () => {
      const traceId = 'trace-123';
      const feedback = {
        userFeedback: 'good' as const,
        feedbackNote: 'Very helpful information',
      };

      await service.recordFeedback(traceId, feedback);

      expect(mockPrisma.knowledgeTrace.update).toHaveBeenCalledWith({
        where: { id: traceId },
        data: {
          userFeedback: 'good',
          feedbackNote: 'Very helpful information',
        },
      });
    });
  });

  describe('getTracesByFeedback', () => {
    test('filtra traces por feedback', async () => {
      mockPrisma.knowledgeTrace.findMany.mockResolvedValueOnce([]);

      await service.getTracesByFeedback('good');

      expect(mockPrisma.knowledgeTrace.findMany).toHaveBeenCalledWith({
        where: { userFeedback: 'good' },
        orderBy: { createdAt: 'desc' },
      });
    });

    test('filtra por feedback e analysisId', async () => {
      mockPrisma.knowledgeTrace.findMany.mockResolvedValueOnce([]);

      await service.getTracesByFeedback('inaccurate', 'analysis-123');

      expect(mockPrisma.knowledgeTrace.findMany).toHaveBeenCalledWith({
        where: { userFeedback: 'inaccurate', analysisId: 'analysis-123' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getCoverageReport', () => {
    test('calcula cobertura da base', async () => {
      const sourcesMetadata = Array(10).fill({}).map((_, i) => ({
        sourceId: `SOURCE_${i}`,
        title: `Source ${i}`,
        usageCount: 0,
        avgRelevance: 0,
        totalConfidence: 0,
      }));

      mockPrisma.knowledgeTrace.findMany.mockResolvedValueOnce(mockTraces);
      // Use mockResolvedValue (not Once) because sourceMetadata.findMany() is called multiple times
      mockPrisma.sourceMetadata.findMany.mockResolvedValue(sourcesMetadata);

      const report = await service.getCoverageReport();

      expect(report.totalSources).toBe(10);
      expect(report.usedSources).toBe(3);
      expect(report.unusedSources).toBe(7);
      expect(report.coverageRate).toBe(30);
      expect(report.validationRate).toBeGreaterThan(0);
    });

    test('calcula hallucinationRate corretamente', async () => {
      mockPrisma.knowledgeTrace.findMany.mockResolvedValueOnce(mockTraces);
      mockPrisma.sourceMetadata.findMany.mockResolvedValueOnce([]);

      const report = await service.getCoverageReport();

      // 1 alucinação de 3 traces = 33%
      expect(report.hallucinationRate).toBe(
        Math.round((1 / 3) * 100)
      );
    });
  });

  describe('getSourceReliabilityRanking', () => {
    test('retorna ranking de confiabilidade de fontes', async () => {
      const sources = [
        {
          sourceId: 'SOURCE_1',
          title: 'High Confidence Source',
          category: 'strategy',
          usageCount: 10,
          avgRelevance: 95,
          totalConfidence: 950,
          lastUsedAt: new Date(),
        },
        {
          sourceId: 'SOURCE_2',
          title: 'Low Confidence Source',
          category: 'content',
          usageCount: 5,
          avgRelevance: 40,
          totalConfidence: 200,
          lastUsedAt: new Date(),
        },
      ];

      mockPrisma.sourceMetadata.findMany.mockResolvedValueOnce(sources);

      const ranking = await service.getSourceReliabilityRanking();

      expect(ranking.length).toBe(2);
      expect(ranking[0].sourceId).toBe('SOURCE_1');
      expect(ranking[0].reliability).toBeGreaterThan(ranking[1].reliability);
    });
  });
});
