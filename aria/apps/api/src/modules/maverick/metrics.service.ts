/**
 * Metrics Service - Quality Metrics Dashboard
 *
 * Orquestra dados de Scholar Engine, Citation Validator, e Traceability
 * para fornecer visualização completa da qualidade das análises Maverick
 */

import { PrismaClient } from '@prisma/client';
import { TraceabilityService } from './traceability.service';

export interface AnalysisMetrics {
  analysisId: string;
  username: string;
  createdAt: Date;

  // Traceability Data
  traces: {
    total: number;
    valid: number;
    invalid: number;
  };

  // Coverage Metrics
  coverage: {
    totalSources: number;
    usedSources: number;
    coverageRate: number; // percentage
    validationRate: number; // percentage
    hallucinationRate: number; // percentage
  };

  // Quality Metrics
  quality: {
    averageConfidence: number; // 0-100
    averageRelevance: number; // 0-100
    hallucinationCount: number;
    validSourceCount: number;
  };

  // Source Rankings
  topSources: Array<{
    sourceId: string;
    title: string;
    category: string;
    usageCount: number;
    reliability: number;
    avgRelevance: number;
  }>;

  // Hallucinations
  hallucinations: Array<{
    sourceId: string;
    sourceText: string;
    positionInAnalysis: string;
    confidenceScore: number;
  }>;
}

export interface DashboardMetrics {
  // Overall Statistics
  totalAnalyses: number;
  totalTraces: number;
  averageCoverageRate: number;
  averageValidationRate: number;
  averageHallucinationRate: number;

  // Knowledge Base Stats
  knowledgeBase: {
    totalSources: number;
    mostUsedSources: Array<{
      sourceId: string;
      title: string;
      usageCount: number;
      category: string;
    }>;
    leastUsedSources: Array<{
      sourceId: string;
      title: string;
      usageCount: number;
      category: string;
    }>;
  };

  // Quality Trends
  qualityMetrics: {
    averageConfidence: number;
    averageRelevance: number;
    totalHallucinations: number;
    hallucinationRate: number;
  };

  // Category Distribution
  categoryDistribution: Record<string, {
    count: number;
    avgRelevance: number;
    avgConfidence: number;
  }>;

  // Source Reliability Rankings (Top 20)
  sourceRankings: Array<{
    sourceId: string;
    title: string;
    category: string;
    usageCount: number;
    reliability: number;
    avgRelevance: number;
    totalConfidence: number;
  }>;

  // Recent Hallucinations
  recentHallucinations: Array<{
    analysisId: string;
    sourceId: string;
    sourceText: string;
    confidenceScore: number;
    createdAt: Date;
  }>;

  // Feedback Analytics
  feedbackAnalytics: {
    totalFeedback: number;
    goodCount: number;
    inaccurateCount: number;
    irrelevantCount: number;
    helpfulCount: number;
  };
}

// Type helpers for Prisma models
type KnowledgeTraceRow = Awaited<ReturnType<PrismaClient['knowledgeTrace']['findMany']>>[number];
type SourceMetadataRow = Awaited<ReturnType<PrismaClient['sourceMetadata']['findMany']>>[number];

export class MetricsService {
  private traceabilityService: TraceabilityService;

  constructor(private prisma: PrismaClient) {
    this.traceabilityService = new TraceabilityService(prisma);
  }

  /**
   * Obtém métricas completas de uma análise específica
   */
  async getAnalysisMetrics(analysisId: string): Promise<AnalysisMetrics | null> {
    const analysis = await this.prisma.maverickAnalysis.findUnique({
      where: { id: analysisId },
      include: {
        traces: true,
      },
    });

    if (!analysis) {
      return null;
    }

    // Get traceability stats
    const stats = await this.traceabilityService.getTraceStats(analysisId);
    const coverage = await this.traceabilityService.getCoverageReport(analysisId);

    // Get hallucinations
    const hallucinations: KnowledgeTraceRow[] = await this.traceabilityService.getAnalysisHallucinations(analysisId);

    // Get top sources
    const ranking = await this.traceabilityService.getSourceReliabilityRanking();
    const topSources = ranking.slice(0, 10).map((r) => ({
      sourceId: r.sourceId,
      title: r.title,
      category: r.category,
      usageCount: r.usageCount,
      reliability: r.reliability,
      avgRelevance: r.avgRelevance || 0,
    }));

    return {
      analysisId,
      username: analysis.username,
      createdAt: analysis.createdAt,

      traces: {
        total: stats.totalTracedSources,
        valid: stats.validSources,
        invalid: stats.invalidSources,
      },

      coverage: {
        totalSources: coverage.totalSources,
        usedSources: coverage.usedSources,
        coverageRate: coverage.coverageRate,
        validationRate: coverage.validationRate,
        hallucinationRate: coverage.hallucinationRate,
      },

      quality: {
        averageConfidence: stats.averageConfidence,
        averageRelevance: stats.averageRelevance,
        hallucinationCount: stats.hallucinationCount,
        validSourceCount: stats.validSources,
      },

      topSources,

      hallucinations: hallucinations.map((h: KnowledgeTraceRow) => ({
        sourceId: h.sourceId,
        sourceText: h.sourceText,
        positionInAnalysis: h.positionInAnalysis,
        confidenceScore: h.confidenceScore,
      })),
    };
  }

  /**
   * Obtém métricas do dashboard geral
   */
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    // Overall counts
    const totalAnalyses = await this.prisma.maverickAnalysis.count();
    const totalTraces = await this.prisma.knowledgeTrace.count();
    const allTraces: KnowledgeTraceRow[] = await this.prisma.knowledgeTrace.findMany();
    const allSourceMetadata: SourceMetadataRow[] = await this.prisma.sourceMetadata.findMany();

    // Calculate coverage rates
    const analyses = await this.prisma.maverickAnalysis.findMany();
    const analysesWithStats = await Promise.all(
      analyses
        .slice(0, 100) // Limit for performance
        .map((a) => this.traceabilityService.getCoverageReport(a.id))
    );

    const avgCoverageRate = analysesWithStats.length > 0
      ? Math.round(analysesWithStats.reduce((sum: number, s) => sum + s.coverageRate, 0) / analysesWithStats.length)
      : 0;

    const avgValidationRate = analysesWithStats.length > 0
      ? Math.round(analysesWithStats.reduce((sum: number, s) => sum + s.validationRate, 0) / analysesWithStats.length)
      : 0;

    const avgHallucinationRate = analysesWithStats.length > 0
      ? Math.round(analysesWithStats.reduce((sum: number, s) => sum + s.hallucinationRate, 0) / analysesWithStats.length)
      : 0;

    // Knowledge Base Stats
    const sortedByUsage = [...allSourceMetadata].sort((a, b) => b.usageCount - a.usageCount);
    const mostUsedSources = sortedByUsage.slice(0, 10).map((s: SourceMetadataRow) => ({
      sourceId: s.sourceId,
      title: s.title,
      usageCount: s.usageCount,
      category: s.category,
    }));

    const leastUsedSources = sortedByUsage.slice(-10).reverse().map((s: SourceMetadataRow) => ({
      sourceId: s.sourceId,
      title: s.title,
      usageCount: s.usageCount,
      category: s.category,
    }));

    // Quality metrics
    const avgConfidence = allTraces.length > 0
      ? Math.round(allTraces.reduce((sum: number, t: KnowledgeTraceRow) => sum + t.confidenceScore, 0) / allTraces.length)
      : 0;

    const avgRelevance = allTraces.length > 0
      ? Math.round(allTraces.reduce((sum: number, t: KnowledgeTraceRow) => sum + t.relevanceScore, 0) / allTraces.length)
      : 0;

    const hallucinationCount = allTraces.filter((t: KnowledgeTraceRow) => t.hallucination).length;
    const hallucinationRate = allTraces.length > 0
      ? Math.round((hallucinationCount / allTraces.length) * 100)
      : 0;

    // Category Distribution
    const categoryDistribution: Record<string, {
      count: number;
      avgRelevance: number;
      avgConfidence: number;
    }> = {};

    for (const metadata of allSourceMetadata) {
      const categoryTraces = allTraces.filter((t: KnowledgeTraceRow) => {
        const source = allSourceMetadata.find((s: SourceMetadataRow) => s.sourceId === t.sourceId);
        return source?.category === metadata.category;
      });

      if (categoryTraces.length > 0) {
        categoryDistribution[metadata.category] = {
          count: categoryTraces.length,
          avgRelevance: Math.round(
            categoryTraces.reduce((sum: number, t: KnowledgeTraceRow) => sum + t.relevanceScore, 0) / categoryTraces.length
          ),
          avgConfidence: Math.round(
            categoryTraces.reduce((sum: number, t: KnowledgeTraceRow) => sum + t.confidenceScore, 0) / categoryTraces.length
          ),
        };
      }
    }

    // Source Reliability Rankings
    const sourceRankings = await this.traceabilityService.getSourceReliabilityRanking();

    // Recent Hallucinations
    const recentHallucinations: KnowledgeTraceRow[] = await this.prisma.knowledgeTrace.findMany({
      where: { hallucination: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Feedback Analytics
    const allFeedback = await this.traceabilityService.getTracesByFeedback('good');
    const inaccurateFeedback = await this.traceabilityService.getTracesByFeedback('inaccurate');
    const irrelevantFeedback = await this.traceabilityService.getTracesByFeedback('irrelevant');
    const helpfulFeedback = await this.traceabilityService.getTracesByFeedback('helpful');

    return {
      totalAnalyses,
      totalTraces,
      averageCoverageRate: avgCoverageRate,
      averageValidationRate: avgValidationRate,
      averageHallucinationRate: avgHallucinationRate,

      knowledgeBase: {
        totalSources: allSourceMetadata.length,
        mostUsedSources,
        leastUsedSources,
      },

      qualityMetrics: {
        averageConfidence: avgConfidence,
        averageRelevance: avgRelevance,
        totalHallucinations: hallucinationCount,
        hallucinationRate,
      },

      categoryDistribution,

      sourceRankings: sourceRankings.slice(0, 20).map((r) => ({
        sourceId: r.sourceId,
        title: r.title,
        category: r.category,
        usageCount: r.usageCount,
        reliability: r.reliability,
        avgRelevance: r.avgRelevance || 0,
        totalConfidence: r.totalConfidence || 0,
      })),

      recentHallucinations: recentHallucinations.map((h: KnowledgeTraceRow) => ({
        analysisId: h.analysisId,
        sourceId: h.sourceId,
        sourceText: h.sourceText,
        confidenceScore: h.confidenceScore,
        createdAt: h.createdAt,
      })),

      feedbackAnalytics: {
        totalFeedback: allFeedback.length + inaccurateFeedback.length + irrelevantFeedback.length + helpfulFeedback.length,
        goodCount: allFeedback.length,
        inaccurateCount: inaccurateFeedback.length,
        irrelevantCount: irrelevantFeedback.length,
        helpfulCount: helpfulFeedback.length,
      },
    };
  }

  /**
   * Obtém feedback filtrado por tipo
   * Nota: Implementação alternativa de getTracesByFeedback para compatibilidade
   */
  async getTracesByFeedback(feedback: string): Promise<any[]> {
    return await this.traceabilityService.getTracesByFeedback(feedback);
  }
}
