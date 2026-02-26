import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ScheduledReportService } from '@aria/core';
import type { ReportFrequency, DeliveryChannel } from '@aria/core';

const scheduledReportService = new ScheduledReportService();

interface CreateScheduleBody {
    frequency: string;
    hour: number;
    minute: number;
    timezone: string;
    channels: string[];
    options?: Record<string, unknown>;
}

interface ScheduleIdParams {
    id: string;
}

interface HistoryQuery {
    limit?: string;
}

export async function registerScheduledReportsRoutes(fastify: FastifyInstance): Promise<void> {
    /**
     * POST /api/scheduled-reports — Create a new schedule
     */
    fastify.post<{ Body: CreateScheduleBody }>(
        '/',
        async (req: FastifyRequest<{ Body: CreateScheduleBody }>, reply: FastifyReply) => {
            try {
                const { frequency, hour, minute, timezone, channels, options } = req.body;
                const userId = 'admin'; // MVP: single user
                const schedule = await scheduledReportService.createSchedule(
                    userId, frequency as ReportFrequency, hour, minute, timezone, channels as DeliveryChannel[], options,
                );
                return reply.status(201).send(schedule);
            } catch (error) {
                return reply.status(400).send({
                    error: error instanceof Error ? error.message : 'Invalid request',
                });
            }
        },
    );

    /**
     * GET /api/scheduled-reports — List schedules for current user
     */
    fastify.get('/', async (_req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schedules = scheduledReportService.getUserSchedules('admin');
            return reply.send({ data: schedules });
        } catch {
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    /**
     * GET /api/scheduled-reports/:id — Get a specific schedule
     */
    fastify.get<{ Params: ScheduleIdParams }>(
        '/:id',
        async (req: FastifyRequest<{ Params: ScheduleIdParams }>, reply: FastifyReply) => {
            try {
                const schedule = scheduledReportService.getSchedule(req.params.id);
                if (!schedule) return reply.status(404).send({ error: 'Schedule not found' });
                return reply.send(schedule);
            } catch {
                return reply.status(500).send({ error: 'Internal server error' });
            }
        },
    );

    /**
     * PUT /api/scheduled-reports/:id — Update a schedule
     */
    fastify.put<{ Params: ScheduleIdParams; Body: Partial<CreateScheduleBody> }>(
        '/:id',
        async (req: FastifyRequest<{ Params: ScheduleIdParams; Body: Partial<CreateScheduleBody> }>, reply: FastifyReply) => {
            try {
                const schedule = await scheduledReportService.updateSchedule(req.params.id, req.body as any);
                return reply.send(schedule);
            } catch (error) {
                return reply.status(400).send({
                    error: error instanceof Error ? error.message : 'Invalid request',
                });
            }
        },
    );

    /**
     * DELETE /api/scheduled-reports/:id — Delete a schedule
     */
    fastify.delete<{ Params: ScheduleIdParams }>(
        '/:id',
        async (req: FastifyRequest<{ Params: ScheduleIdParams }>, reply: FastifyReply) => {
            try {
                await scheduledReportService.deleteSchedule(req.params.id);
                return reply.status(204).send();
            } catch {
                return reply.status(404).send({ error: 'Schedule not found' });
            }
        },
    );

    /**
     * POST /api/scheduled-reports/:id/pause — Pause a schedule
     */
    fastify.post<{ Params: ScheduleIdParams }>(
        '/:id/pause',
        async (req: FastifyRequest<{ Params: ScheduleIdParams }>, reply: FastifyReply) => {
            try {
                const schedule = await scheduledReportService.pauseSchedule(req.params.id);
                return reply.send(schedule);
            } catch {
                return reply.status(404).send({ error: 'Schedule not found' });
            }
        },
    );

    /**
     * POST /api/scheduled-reports/:id/resume — Resume a schedule
     */
    fastify.post<{ Params: ScheduleIdParams }>(
        '/:id/resume',
        async (req: FastifyRequest<{ Params: ScheduleIdParams }>, reply: FastifyReply) => {
            try {
                const schedule = await scheduledReportService.resumeSchedule(req.params.id);
                return reply.send(schedule);
            } catch {
                return reply.status(404).send({ error: 'Schedule not found' });
            }
        },
    );

    /**
     * GET /api/scheduled-reports/:id/history — Get delivery history
     */
    fastify.get<{ Params: ScheduleIdParams; Querystring: HistoryQuery }>(
        '/:id/history',
        async (req: FastifyRequest<{ Params: ScheduleIdParams; Querystring: HistoryQuery }>, reply: FastifyReply) => {
            try {
                const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
                const history = scheduledReportService.getDeliveryHistory(req.params.id, limit);
                return reply.send({ data: history });
            } catch {
                return reply.status(500).send({ error: 'Internal server error' });
            }
        },
    );
}
