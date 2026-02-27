import { PrismaClient } from '@prisma/client';

interface MaverickReport {
  profile: {
    username: string;
    bio: string;
    followers: string;
    following: string;
    posts_count: string;
  };
  analysis: {
    positive_points: string[];
    profile_gaps: string[];
    best_posts: { caption_preview: string; reason: string }[];
    worst_posts: { caption_preview: string; reason: string }[];
  };
  strategy: {
    diagnosis: string;
    key_concept: string;
    citation: string;
    next_steps: string[];
  };
}

export class MaverickService {
  private prisma: PrismaClient;

  constructor(prismaClient: PrismaClient) {
    this.prisma = prismaClient;
  }

  /**
   * Salva uma análise do Maverick Squad no banco de dados
   */
  async saveAnalysis(report: MaverickReport, status: 'completed' | 'failed' = 'completed', error?: string) {
    try {
      const analysis = await this.prisma.maverickAnalysis.create({
        data: {
          username: report.profile.username,
          profile: report.profile as any,
          analysis: report.analysis as any,
          strategy: report.strategy as any,
          fullReport: report as any,
          status,
          error: error || null,
        },
      });

      console.log(`[LOG] 💾 Análise salva no histórico: @${report.profile.username}`);
      return analysis;
    } catch (err) {
      console.error('[ERROR] Erro ao salvar análise:', err);
      throw err;
    }
  }

  /**
   * Recupera todas as análises de um usuário
   */
  async getAnalysisByUsername(username: string) {
    try {
      const analyses = await this.prisma.maverickAnalysis.findMany({
        where: { username },
        orderBy: { createdAt: 'desc' },
      });

      return analyses;
    } catch (err) {
      console.error('[ERROR] Erro ao recuperar análises:', err);
      throw err;
    }
  }

  /**
   * Recupera a análise mais recente de um usuário
   */
  async getLatestAnalysis(username: string) {
    try {
      const analysis = await this.prisma.maverickAnalysis.findFirst({
        where: { username, status: 'completed' },
        orderBy: { createdAt: 'desc' },
      });

      return analysis;
    } catch (err) {
      console.error('[ERROR] Erro ao recuperar última análise:', err);
      throw err;
    }
  }

  /**
   * Recupera todas as análises com paginação
   */
  async getAllAnalyses(limit: number = 50, offset: number = 0) {
    try {
      const [analyses, total] = await Promise.all([
        this.prisma.maverickAnalysis.findMany({
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.prisma.maverickAnalysis.count(),
      ]);

      return {
        data: analyses,
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      };
    } catch (err) {
      console.error('[ERROR] Erro ao recuperar histórico:', err);
      throw err;
    }
  }

  /**
   * Deleta uma análise
   */
  async deleteAnalysis(id: string) {
    try {
      await this.prisma.maverickAnalysis.delete({
        where: { id },
      });

      console.log(`[LOG] 🗑️  Análise deletada: ${id}`);
      return { success: true };
    } catch (err) {
      console.error('[ERROR] Erro ao deletar análise:', err);
      throw err;
    }
  }

  /**
   * Recupera estatísticas do histórico
   */
  async getStats() {
    try {
      const [total, byStatus, uniqueUsers] = await Promise.all([
        this.prisma.maverickAnalysis.count(),
        this.prisma.maverickAnalysis.groupBy({
          by: ['status'],
          _count: true,
        }),
        this.prisma.maverickAnalysis.findMany({
          distinct: ['username'],
          select: { username: true },
        }),
      ]);

      return {
        totalAnalyses: total,
        byStatus: Object.fromEntries(
          byStatus.map((s) => [s.status, s._count])
        ),
        uniqueUsers: uniqueUsers.length,
      };
    } catch (err) {
      console.error('[ERROR] Erro ao recuperar estatísticas:', err);
      throw err;
    }
  }
}
