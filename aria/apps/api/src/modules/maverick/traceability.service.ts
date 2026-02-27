/**
 * Traceability Service - Rastreia uso da base de conhecimento
 *
 * Registra quais trechos foram usados, com que confiança,
 * em qual contexto, e permite feedback do usuário
 */

import { PrismaClient } from '@prisma/client';
import { CitationValidationResult } from './citation-validator';

export interface TraceRecord {
  sourceId: string;
  sourceText: string;
  fullSourceUrl: string;
  contextUsed: string;
  citationText: string;
  positionInAnalysis: string;
  isValid: boolean;
  validationScore: number;
  relevanceScore: number;
  confidenceScore: number;
  hallucination: boolean;
}

export interface TraceStats {
  totalTracedSources: number;
  validSources: number;
  invalidSources: number;
  hallucinationCount: number;
  averageConfidence: number;
  averageRelevance: number;
  mostUsedSources: Array<{
    sourceId: string;
    usageCount: number;
    category: string;
    avgRelevance: number;
  }>;
  unusedSources: Array<{
    sourceId: string;
    title: string;
    category: string;
  }>;
  sourcesByCategory: Record<string, number>;
}

export interface SourceFeedback {
  userFeedback: 'good' | 'inaccurate' | 'irrelevant' | 'helpful';
  feedbackNote?: string;
}

export class TraceabilityService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Registra uma análise com rastreamento completo de conhecimento
   */
  async traceAnalysis(
    analysisId: string,
    traces: TraceRecord[]
  ): Promise<void> {
    const createData = traces.map(trace => ({
      analysisId,
      sourceId: trace.sourceId,
      sourceText: trace.sourceText.substring(0, 500), // Limita a 500 chars
      fullSourceUrl: trace.fullSourceUrl,
      contextUsed: trace.contextUsed,
      citationText: trace.citationText,
      positionInAnalysis: trace.positionInAnalysis,
      isValid: trace.isValid,
      validationScore: trace.validationScore,
      relevanceScore: trace.relevanceScore,
      confidenceScore: trace.confidenceScore,
      hallucination: trace.hallucination,
    }));

    // Criar registros de rastreamento
    for (const data of createData) {
      await this.prisma.knowledgeTrace.create({ data });

      // Atualizar metadados da fonte
      await this.updateSourceMetadata(
        data.sourceId,
        data.relevanceScore,
        data.confidenceScore
      );
    }
  }

  /**
   * Obtém rastreamento de uma análise
   */
  async getAnalysisTrace(analysisId: string) {
    return await this.prisma.knowledgeTrace.findMany({
      where: { analysisId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Obtém rastreamento por posição na análise
   */
  async getTraceByPosition(analysisId: string, position: string) {
    return await this.prisma.knowledgeTrace.findMany({
      where: {
        analysisId,
        positionInAnalysis: position,
      },
    });
  }

  /**
   * Obtém rastreamento por fonte
   */
  async getTraceBySource(sourceId: string) {
    return await this.prisma.knowledgeTrace.findMany({
      where: { sourceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Obtém todas as alucinações detectadas
   */
  async getAllHallucinations() {
    return await this.prisma.knowledgeTrace.findMany({
      where: { hallucination: true },
      orderBy: { createdAt: 'desc' },
      include: {
        maverickAnalysis: {
          select: { id: true, username: true, createdAt: true },
        },
      },
    });
  }

  /**
   * Obtém alucinações de uma análise específica
   */
  async getAnalysisHallucinations(analysisId: string) {
    return await this.prisma.knowledgeTrace.findMany({
      where: { analysisId, hallucination: true },
    });
  }

  /**
   * Calcula estatísticas de rastreamento
   */
  async getTraceStats(analysisId?: string): Promise<TraceStats> {
    const whereClause = analysisId ? { analysisId } : {};

    const traces = await this.prisma.knowledgeTrace.findMany({
      where: whereClause,
    });

    if (traces.length === 0) {
      return {
        totalTracedSources: 0,
        validSources: 0,
        invalidSources: 0,
        hallucinationCount: 0,
        averageConfidence: 0,
        averageRelevance: 0,
        mostUsedSources: [],
        unusedSources: [],
        sourcesByCategory: {},
      };
    }

    const validSources = traces.filter(t => t.isValid).length;
    const invalidSources = traces.filter(t => !t.isValid).length;
    const hallucinationCount = traces.filter(t => t.hallucination).length;

    const avgConfidence =
      traces.reduce((sum, t) => sum + t.confidenceScore, 0) / traces.length;
    const avgRelevance =
      traces.reduce((sum, t) => sum + t.relevanceScore, 0) / traces.length;

    // Fontes mais usadas
    const sourceUsage = new Map<string, number>();
    traces.forEach(t => {
      sourceUsage.set(t.sourceId, (sourceUsage.get(t.sourceId) || 0) + 1);
    });

    const sourceMetadata = await this.prisma.sourceMetadata.findMany();
    const metadataMap = new Map(sourceMetadata.map(m => [m.sourceId, m]));

    const mostUsedSources = Array.from(sourceUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([sourceId, count]) => {
        const metadata = metadataMap.get(sourceId);
        return {
          sourceId,
          usageCount: count,
          category: metadata?.category || 'unknown',
          avgRelevance: metadata?.avgRelevance || 0,
        };
      });

    // Fontes nunca usadas
    const usedSourceIds = new Set(traces.map(t => t.sourceId));
    const unusedSources = sourceMetadata
      .filter(m => !usedSourceIds.has(m.sourceId))
      .slice(0, 10)
      .map(m => ({
        sourceId: m.sourceId,
        title: m.title,
        category: m.category,
      }));

    // Distribuição por categoria
    const categoryDistribution: Record<string, number> = {};
    sourceMetadata.forEach(m => {
      if (usedSourceIds.has(m.sourceId)) {
        categoryDistribution[m.category] =
          (categoryDistribution[m.category] || 0) + 1;
      }
    });

    return {
      totalTracedSources: traces.length,
      validSources,
      invalidSources,
      hallucinationCount,
      averageConfidence: Math.round(avgConfidence),
      averageRelevance: Math.round(avgRelevance),
      mostUsedSources,
      unusedSources,
      sourcesByCategory: categoryDistribution,
    };
  }

  /**
   * Registra feedback do usuário para um rastreamento
   */
  async recordFeedback(
    traceId: string,
    feedback: SourceFeedback
  ): Promise<void> {
    await this.prisma.knowledgeTrace.update({
      where: { id: traceId },
      data: {
        userFeedback: feedback.userFeedback,
        feedbackNote: feedback.feedbackNote,
      },
    });
  }

  /**
   * Obtém rastreamentos com feedback específico
   */
  async getTracesByFeedback(feedback: string, analysisId?: string) {
    const whereClause: any = { userFeedback: feedback };
    if (analysisId) {
      whereClause.analysisId = analysisId;
    }

    return await this.prisma.knowledgeTrace.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Gera relatório de cobertura da base
   */
  async getCoverageReport(analysisId?: string) {
    const stats = await this.getTraceStats(analysisId);
    const totalSources = (
      await this.prisma.sourceMetadata.findMany()
    ).length;

    const coverageRate = totalSources > 0 ? (
      (stats.totalTracedSources / totalSources) * 100
    ) : 0;

    return {
      totalSources,
      usedSources: stats.totalTracedSources,
      unusedSources: totalSources - stats.totalTracedSources,
      coverageRate: Math.round(coverageRate),
      validationRate: stats.totalTracedSources > 0 ?
        Math.round((stats.validSources / stats.totalTracedSources) * 100) : 0,
      hallucinationRate: stats.totalTracedSources > 0 ?
        Math.round((stats.hallucinationCount / stats.totalTracedSources) * 100) : 0,
    };
  }

  /**
   * Atualiza metadados de uma fonte
   */
  private async updateSourceMetadata(
    sourceId: string,
    relevanceScore: number,
    confidenceScore: number
  ): Promise<void> {
    const existing = await this.prisma.sourceMetadata.findUnique({
      where: { sourceId },
    });

    if (existing) {
      const newUsageCount = existing.usageCount + 1;
      const newTotalConfidence = existing.totalConfidence + confidenceScore;
      const newAvgRelevance = Math.round(
        (existing.avgRelevance + relevanceScore) / 2
      );

      await this.prisma.sourceMetadata.update({
        where: { sourceId },
        data: {
          usageCount: newUsageCount,
          lastUsedAt: new Date(),
          avgRelevance: newAvgRelevance,
          totalConfidence: newTotalConfidence,
        },
      });
    }
  }

  /**
   * Obtém ranking de confiabilidade de fontes
   */
  async getSourceReliabilityRanking() {
    const sources = await this.prisma.sourceMetadata.findMany(
      {
        where: { usageCount: { gt: 0 } },
        orderBy: { avgRelevance: 'desc' },
        take: 20,
      }
    );

    return sources.map(s => ({
      sourceId: s.sourceId,
      title: s.title,
      category: s.category,
      usageCount: s.usageCount,
      reliability: Math.round(
        (s.avgRelevance * 0.6 + (s.totalConfidence / Math.max(s.usageCount, 1)) * 0.4)
      ),
      lastUsedAt: s.lastUsedAt,
    }));
  }
}
