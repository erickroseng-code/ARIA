import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Google Calendar Routes (Fastify-native)
 *
 * Exposes the CalendarService from @aria/integrations for frontend and cross-service queries.
 */
import { CalendarService } from '@aria/integrations';

export async function registerGoogleCalendarRoutes(fastify: FastifyInstance): Promise<void> {
    const NOT_CONFIGURED = {
        error: 'Google Calendar integration fully packaged, but action not yet implemented',
        status: 'pending_implementation',
    };

    /**
     * GET /api/calendar/auth/url — Generate OAuth URL
     */
    fastify.get('/auth/url', async (_req, reply) => {
        return reply.status(501).send(NOT_CONFIGURED);
    });

    /**
     * GET /api/calendar/auth/callback — OAuth callback
     */
    fastify.get('/auth/callback', async (_req, reply) => {
        return reply.status(501).send(NOT_CONFIGURED);
    });

    /**
     * POST /api/calendar/events — Create a calendar event
     */
    fastify.post('/events', async (req, reply) => {
        const { title, startTime, endTime, description } = req.body as any;
        if (!title || !startTime || !endTime) {
            return reply.status(400).send({ error: 'Missing required fields: title, startTime, endTime' });
        }
        try {
            const service = new CalendarService();
            const event = await service.createEvent(
                title,
                startTime,
                endTime,
                description || `Evento criado via ARIA`
            );
            return reply.status(201).send({
                success: true,
                event: {
                    id: event.id,
                    title: event.title,
                    startTime: event.startTime,
                    endTime: event.endTime,
                    htmlLink: event.htmlLink
                }
            });
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error('[CalendarService.createEvent] Error:', errorMsg);
            return reply.status(500).send({
                error: 'Failed to create calendar event',
                details: errorMsg
            });
        }
    });

    fastify.get('/events', async (req, reply) => {
        try {
            const { startDate, endDate, maxResults } = req.query as any;
            const start = startDate ? new Date(startDate) : undefined;
            const end = endDate ? new Date(endDate) : undefined;
            const limit = maxResults ? parseInt(maxResults as string) : 20;

            const service = new CalendarService();
            const events = await service.listEvents(start, end, limit);
            return reply.send({
                success: true,
                count: events.length,
                events
            });
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error('[CalendarService.listEvents] Error:', errorMsg);
            return reply.status(500).send({
                error: 'Failed to fetch calendar events',
                details: errorMsg
            });
        }
    });

    /**
     * DELETE /api/calendar/events/:eventId — Cancel an event
     */
    fastify.delete('/events/:eventId', async (_req, reply) => {
        return reply.status(501).send(NOT_CONFIGURED);
    });

    /**
     * GET /api/calendar/health — Check if calendar integration is configured
     */
    fastify.get('/health', async (_req, reply) => {
        const configured = !!(
            process.env.GOOGLE_CLIENT_ID &&
            process.env.GOOGLE_CLIENT_SECRET
        );
        return reply.send({
            configured,
            message: configured
                ? 'Google Calendar Integrado com sucesso'
                : 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET not set',
        });
    });
}
