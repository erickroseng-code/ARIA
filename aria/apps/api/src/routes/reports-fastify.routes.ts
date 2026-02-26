import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ReportGenerationService, ReportDataAggregationService } from '@aria/core';

const reportGenService = new ReportGenerationService();
const reportAggService = new ReportDataAggregationService();
// Lightweight in-memory cache tracker (mirrors CacheService.clearForUser behaviour)
const inMemoryCache = new Map<string, unknown>();

interface ReportIdParams { id: string }
interface ListReportsQuery { skip?: string; limit?: string; status?: string }
interface RefreshReportBody { regenerate?: boolean; notify?: boolean }

export async function registerReportsRoutes(fastify: FastifyInstance): Promise<void> {
    /**
     * GET /api/reports — List user reports with pagination
     */
    fastify.get<{ Querystring: ListReportsQuery }>(
        '/',
        async (req: FastifyRequest<{ Querystring: ListReportsQuery }>, reply: FastifyReply) => {
            try {
                const userId = (req as any).user?.userId || 'admin';
                const skipNum = parseInt(req.query.skip || '0', 10);
                const limitNum = parseInt(req.query.limit || '10', 10);

                // In production: fetch from database with pagination.
                // MVP: return in-memory mock list consistent with ReportGenerationService.
                const reports = [
                    {
                        id: 'report_weekly_latest',
                        userId,
                        type: 'weekly',
                        period: { start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), end: new Date() },
                        status: 'ready',
                        generatedAt: new Date(),
                        notionPageId: null,
                    },
                    {
                        id: 'report_monthly_latest',
                        userId,
                        type: 'monthly',
                        period: { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date() },
                        status: 'ready',
                        generatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
                        notionPageId: null,
                    },
                ];

                const page = reports.slice(skipNum, skipNum + limitNum);

                return reply.send({
                    success: true,
                    data: page,
                    pagination: { skip: skipNum, limit: limitNum, total: reports.length, hasMore: skipNum + limitNum < reports.length },
                });
            } catch (error) {
                return reply.status(500).send({ error: 'Failed to list reports' });
            }
        },
    );

    /**
     * GET /api/reports/:id — Get single report details
     */
    fastify.get<{ Params: ReportIdParams }>(
        '/:id',
        async (req: FastifyRequest<{ Params: ReportIdParams }>, reply: FastifyReply) => {
            try {
                const userId = (req as any).user?.userId || 'admin';
                return reply.send({
                    id: req.params.id,
                    userId,
                    status: 'ready',
                    generatedAt: new Date(),
                    sections: {
                        executiveSummary: 'Relatório gerado pelo ARIA.',
                        keyMetrics: [],
                        insights: [],
                        recommendations: [],
                    },
                });
            } catch {
                return reply.status(500).send({ error: 'Failed to fetch report' });
            }
        },
    );

    /**
     * POST /api/reports/:id/refresh — Force regenerate a report, bypassing cache
     */
    fastify.post<{ Params: ReportIdParams; Body: RefreshReportBody }>(
        '/:id/refresh',
        async (req: FastifyRequest<{ Params: ReportIdParams; Body: RefreshReportBody }>, reply: FastifyReply) => {
            try {
                const { id } = req.params;
                const userId = (req as any).user?.userId || 'admin';
                const { regenerate = true, notify = true } = req.body ?? {};

                const reportData = await reportAggService.aggregateData({
                    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    end: new Date(),
                });

                if (!reportData) {
                    return reply.status(404).send({ error: 'No aggregated data found' });
                }

                const report = await reportGenService.generateReport({ userId, reportData, regenerate, notify });

                return reply.send({
                    success: true,
                    report,
                    message: `Report ${id} regenerated successfully`,
                    timestamp: new Date().toISOString(),
                });
            } catch (error) {
                return reply.status(500).send({
                    error: 'Failed to regenerate report',
                    message: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        },
    );

    /**
     * DELETE /api/reports/:id/cache — Clear cache for a specific report
     */
    fastify.delete<{ Params: ReportIdParams }>(
        '/:id/cache',
        async (req: FastifyRequest<{ Params: ReportIdParams }>, reply: FastifyReply) => {
            try {
                const userId = (req as any).user?.userId || 'admin';
                // Clear user entries from in-memory cache
                for (const key of inMemoryCache.keys()) {
                    if (key.startsWith(`report:${userId}:`)) inMemoryCache.delete(key);
                }
                return reply.send({ success: true, message: `Cache cleared for user ${userId}` });
            } catch {
                return reply.status(500).send({ error: 'Failed to clear cache' });
            }
        },
    );

    /**
     * GET /api/reports/cache/stats — Cache statistics (monitoring)
     */
    fastify.get('/cache/stats', async (_req: FastifyRequest, reply: FastifyReply) => {
        try {
            return reply.send({
                backend: 'in-memory',
                size: inMemoryCache.size,
                ttlSeconds: 3600,
            });
        } catch {
            return reply.status(500).send({ error: 'Failed to get cache stats' });
        }
    });
}
