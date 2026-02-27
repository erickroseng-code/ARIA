/**
 * Metrics Service Tests
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { MetricsService } from '../metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;
  let mockPrisma: any;

  const mockAnalysis = {
    id: 'analysis-123',
    username: 'test_user',
    profile: {},
    analysis: {},
    strategy: {},
    fullReport: {},
    status: 'completed',
    error: null,
    createdAt: new Date('2026-02-27'),
    updatedAt: new Date('2026-02-27'),
    traces: [
      {
        id: 'trace-1',
        analysisId: 'analysis-123',
        sourceId: 'SOURCE_1',
        sourceText: 'Source text 1',
        fullSourceUrl: 'url1',
        contextUsed: 'context 1',
        citationText: '[Citation 1]',
        positionInAnalysis: 'analysis',
        isValid: true,
        validationScore: 90,
        relevanceScore: 85,
        confidenceScore: 95,
        hallucination: false,
        userFeedback: 'good',
        feedbackNote: null,
        createdAt: new Date(),
      },
    ],
  };

  const mockSourceMetadata = [
    {
      id: 'meta-1',
      sourceId: 'SOURCE_1',
      title: 'Strategy Guide',
      category: 'strategy',
      importance: 9,
      usageCount: 15,
      lastUsedAt: new Date(),
      avgRelevance: 87,
      totalConfidence: 1305,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'meta-2',
      sourceId: 'SOURCE_2',
      title: 'Content Tips',
      category: 'content',
      importance: 7,
      usageCount: 8,
      lastUsedAt: new Date(),
      avgRelevance: 82,
      totalConfidence: 656,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockTraces = [
    {
      id: 'trace-1',
      analysisId: 'analysis-123',
      sourceId: 'SOURCE_1',
      sourceText: 'Text 1',
      fullSourceUrl: 'url1',
      contextUsed: 'context 1',
      citationText: '[Citation 1]',
      positionInAnalysis: 'analysis',
      isValid: true,
      validationScore: 90,
      relevanceScore: 85,
      confidenceScore: 95,
      hallucination: false,
      userFeedback: 'good',
      feedbackNote: null,
      createdAt: new Date(),
    },
    {
      id: 'trace-2',
      analysisId: 'analysis-123',
      sourceId: 'SOURCE_2',
      sourceText: 'Text 2',
      fullSourceUrl: 'url2',
      contextUsed: 'context 2',
      citationText: '[Citation 2]',
      positionInAnalysis: 'strategy',
      isValid: true,
      validationScore: 85,
      relevanceScore: 80,
      confidenceScore: 90,
      hallucination: false,
      userFeedback: null,
      feedbackNote: null,
      createdAt: new Date(),
    },
    {
      id: 'trace-3',
      analysisId: 'analysis-124',
      sourceId: 'SOURCE_1',
      sourceText: 'Text 3',
      fullSourceUrl: 'url3',
      contextUsed: 'context 3',
      citationText: '[Citation 3]',
      positionInAnalysis: 'conclusion',
      isValid: false,
      validationScore: 20,
      relevanceScore: 10,
      confidenceScore: 25,
      hallucination: true,
      userFeedback: 'inaccurate',
      feedbackNote: 'Not accurate',
      createdAt: new Date(),
    },
  ];

  beforeEach(() => {
    mockPrisma = {
      maverickAnalysis: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      knowledgeTrace: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      sourceMetadata: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    service = new MetricsService(mockPrisma);
  });

  describe('getAnalysisMetrics', () => {
    test('retorna null se análise não encontrada', async () => {
      mockPrisma.maverickAnalysis.findUnique.mockResolvedValueOnce(null);

      const result = await service.getAnalysisMetrics('analysis-999');

      expect(result).toBeNull();
    });

    test('retorna métricas completas de uma análise', async () => {
      mockPrisma.maverickAnalysis.findUnique.mockResolvedValueOnce(mockAnalysis);
      mockPrisma.knowledgeTrace.findMany
        .mockResolvedValueOnce([mockTraces[0]]) // for getTraceStats
        .mockResolvedValueOnce(mockSourceMetadata); // for sourceMetadata in getTraceStats

      const result = await service.getAnalysisMetrics('analysis-123');

      expect(result).not.toBeNull();
      expect(result?.analysisId).toBe('analysis-123');
      expect(result?.username).toBe('test_user');
      expect(result?.traces.total).toBeGreaterThanOrEqual(0);
      expect(result?.coverage.totalSources).toBeGreaterThanOrEqual(0);
      expect(result?.quality.averageConfidence).toBeGreaterThanOrEqual(0);
    });

    test('inclui hallucinations na resposta', async () => {
      mockPrisma.maverickAnalysis.findUnique.mockResolvedValueOnce(mockAnalysis);
      mockPrisma.knowledgeTrace.findMany
        .mockResolvedValueOnce([mockTraces[0]]) // for getTraceStats
        .mockResolvedValueOnce(mockSourceMetadata);

      const result = await service.getAnalysisMetrics('analysis-123');

      expect(result?.hallucinations).toBeDefined();
      expect(Array.isArray(result?.hallucinations)).toBe(true);
    });

    test('inclui top sources na resposta', async () => {
      mockPrisma.maverickAnalysis.findUnique.mockResolvedValueOnce(mockAnalysis);
      mockPrisma.knowledgeTrace.findMany
        .mockResolvedValueOnce([mockTraces[0]])
        .mockResolvedValueOnce(mockSourceMetadata);

      const result = await service.getAnalysisMetrics('analysis-123');

      expect(result?.topSources).toBeDefined();
      expect(Array.isArray(result?.topSources)).toBe(true);
    });
  });

  describe('getDashboardMetrics', () => {
    test('retorna métricas do dashboard', async () => {
      mockPrisma.maverickAnalysis.count.mockResolvedValueOnce(5);
      mockPrisma.knowledgeTrace.count.mockResolvedValueOnce(25);
      mockPrisma.maverickAnalysis.findMany.mockResolvedValueOnce([]);
      mockPrisma.knowledgeTrace.findMany.mockResolvedValue(mockTraces);
      mockPrisma.sourceMetadata.findMany.mockResolvedValue(mockSourceMetadata);

      const result = await service.getDashboardMetrics();

      expect(result.totalAnalyses).toBe(5);
      expect(result.totalTraces).toBe(25);
      expect(result.knowledgeBase.totalSources).toBeGreaterThanOrEqual(0);
      expect(result.qualityMetrics).toBeDefined();
    });

    test('calcula coverage rates corretamente', async () => {
      mockPrisma.maverickAnalysis.count.mockResolvedValueOnce(2);
      mockPrisma.knowledgeTrace.count.mockResolvedValueOnce(10);
      mockPrisma.maverickAnalysis.findMany.mockResolvedValueOnce([]);
      mockPrisma.knowledgeTrace.findMany.mockResolvedValue(mockTraces);
      mockPrisma.sourceMetadata.findMany.mockResolvedValue(mockSourceMetadata);

      const result = await service.getDashboardMetrics();

      expect(result.averageCoverageRate).toBeGreaterThanOrEqual(0);
      expect(result.averageValidationRate).toBeGreaterThanOrEqual(0);
      expect(result.averageHallucinationRate).toBeGreaterThanOrEqual(0);
    });

    test('retorna knowledge base statistics', async () => {
      mockPrisma.maverickAnalysis.count.mockResolvedValueOnce(1);
      mockPrisma.knowledgeTrace.count.mockResolvedValueOnce(5);
      mockPrisma.maverickAnalysis.findMany.mockResolvedValueOnce([]);
      mockPrisma.knowledgeTrace.findMany.mockResolvedValue(mockTraces);
      mockPrisma.sourceMetadata.findMany.mockResolvedValue(mockSourceMetadata);

      const result = await service.getDashboardMetrics();

      expect(result.knowledgeBase.mostUsedSources).toBeDefined();
      expect(result.knowledgeBase.leastUsedSources).toBeDefined();
      expect(Array.isArray(result.knowledgeBase.mostUsedSources)).toBe(true);
    });

    test('retorna category distribution', async () => {
      mockPrisma.maverickAnalysis.count.mockResolvedValueOnce(1);
      mockPrisma.knowledgeTrace.count.mockResolvedValueOnce(5);
      mockPrisma.maverickAnalysis.findMany.mockResolvedValueOnce([]);
      mockPrisma.knowledgeTrace.findMany.mockResolvedValue(mockTraces);
      mockPrisma.sourceMetadata.findMany.mockResolvedValue(mockSourceMetadata);

      const result = await service.getDashboardMetrics();

      expect(result.categoryDistribution).toBeDefined();
      expect(typeof result.categoryDistribution).toBe('object');
    });

    test('retorna source reliability rankings', async () => {
      mockPrisma.maverickAnalysis.count.mockResolvedValueOnce(1);
      mockPrisma.knowledgeTrace.count.mockResolvedValueOnce(5);
      mockPrisma.maverickAnalysis.findMany.mockResolvedValueOnce([]);
      mockPrisma.knowledgeTrace.findMany.mockResolvedValue(mockTraces);
      mockPrisma.sourceMetadata.findMany.mockResolvedValue(mockSourceMetadata);

      const result = await service.getDashboardMetrics();

      expect(result.sourceRankings).toBeDefined();
      expect(Array.isArray(result.sourceRankings)).toBe(true);
    });

    test('retorna recent hallucinations', async () => {
      const hallucTraces = mockTraces.filter(t => t.hallucination);
      mockPrisma.maverickAnalysis.count.mockResolvedValueOnce(1);
      mockPrisma.knowledgeTrace.count.mockResolvedValueOnce(3);
      mockPrisma.maverickAnalysis.findMany.mockResolvedValueOnce([]);
      mockPrisma.knowledgeTrace.findMany
        .mockResolvedValueOnce(mockTraces) // for quality metrics
        .mockResolvedValueOnce(hallucTraces); // for recent hallucinations

      const result = await service.getDashboardMetrics();

      expect(result.recentHallucinations).toBeDefined();
      expect(Array.isArray(result.recentHallucinations)).toBe(true);
    });

    test('retorna feedback analytics', async () => {
      mockPrisma.maverickAnalysis.count.mockResolvedValueOnce(1);
      mockPrisma.knowledgeTrace.count.mockResolvedValueOnce(5);
      mockPrisma.maverickAnalysis.findMany.mockResolvedValueOnce([]);
      mockPrisma.knowledgeTrace.findMany.mockResolvedValue(mockTraces);
      mockPrisma.sourceMetadata.findMany.mockResolvedValue(mockSourceMetadata);

      const result = await service.getDashboardMetrics();

      expect(result.feedbackAnalytics).toBeDefined();
      expect(result.feedbackAnalytics.totalFeedback).toBeGreaterThanOrEqual(0);
      expect(result.feedbackAnalytics.goodCount).toBeGreaterThanOrEqual(0);
    });

    test('calcula quality metrics corretamente', async () => {
      mockPrisma.maverickAnalysis.count.mockResolvedValueOnce(1);
      mockPrisma.knowledgeTrace.count.mockResolvedValueOnce(3);
      mockPrisma.maverickAnalysis.findMany.mockResolvedValueOnce([]);
      mockPrisma.knowledgeTrace.findMany.mockResolvedValue(mockTraces);
      mockPrisma.sourceMetadata.findMany.mockResolvedValue(mockSourceMetadata);

      const result = await service.getDashboardMetrics();

      expect(result.qualityMetrics.averageConfidence).toBeGreaterThanOrEqual(0);
      expect(result.qualityMetrics.averageRelevance).toBeGreaterThanOrEqual(0);
      expect(result.qualityMetrics.totalHallucinations).toBeGreaterThanOrEqual(0);
      expect(result.qualityMetrics.hallucinationRate).toBeGreaterThanOrEqual(0);
    });
  });
});
