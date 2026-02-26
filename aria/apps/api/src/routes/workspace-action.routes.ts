import { FastifyInstance } from 'fastify';
import { WorkspaceActionService, WorkspaceAction } from '@aria/integrations';

/**
 * POST /api/workspace/action
 *
 * Executes a Google Workspace write/mutate action.
 * The request body must contain a valid WorkspaceAction payload.
 *
 * Example body:
 * {
 *   "service": "gmail",
 *   "action": "trashEmail",
 *   "params": { "messageId": "18e9d..." }
 * }
 */
export async function workspaceActionRoutes(fastify: FastifyInstance) {
    fastify.post<{ Body: WorkspaceAction }>(
        '/api/workspace/action',
        {
            schema: {
                body: {
                    type: 'object',
                    required: ['service', 'action', 'params'],
                    properties: {
                        service: { type: 'string', enum: ['drive', 'gmail', 'sheets', 'docs', 'calendar'] },
                        action: { type: 'string' },
                        params: { type: 'object' },
                    },
                },
            },
        },
        async (request, reply) => {
            const actionService = new WorkspaceActionService();
            const result = await actionService.execute(request.body);
            const statusCode = result.success ? 200 : 422;
            return reply.status(statusCode).send(result);
        }
    );

    fastify.get('/api/workspace/capabilities', async (_request, reply) => {
        return reply.send({
            drive: {
                read: ['listRecentFiles', 'searchFiles'],
                write: ['renameFile', 'moveFile', 'copyFile', 'trashFile', 'restoreFile', 'deleteFile', 'createFolder'],
            },
            gmail: {
                read: ['listRecentEmails', 'searchEmails'],
                write: ['sendEmail', 'replyEmail', 'trashEmail', 'deleteEmail', 'markAsRead', 'markAsUnread', 'starEmail', 'moveToLabel'],
            },
            sheets: {
                read: ['readRange'],
                write: ['writeRange', 'appendRows', 'clearRange', 'addSheet'],
            },
            docs: {
                read: ['readDocument'],
                write: ['appendText', 'replaceText', 'createDocument'],
            },
            calendar: {
                read: ['listEvents'],
                write: ['createEvent', 'updateEvent', 'deleteEvent'],
            },
        });
    });
    fastify.get('/api/workspace/token-debug', async (_request, reply) => {
        const token = process.env.GOOGLE_REFRESH_TOKEN;
        return reply.send({
            hasToken: !!token,
            tokenPrefix: token ? token.substring(0, 25) : null,
            tokenLength: token?.length || 0,
        });
    });
}
