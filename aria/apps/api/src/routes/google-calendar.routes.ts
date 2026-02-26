// @ts-nocheck
import { Router, Request, Response } from 'express';
import { CalendarEventService } from '@aios-core/integrations/src/google-calendar/CalendarEventService';
import { OAuthTokenManager } from '@aios-core/integrations/src/google-calendar/oauth';

const router = Router();

// Helper to get user ID from request (can be from JWT, session, or param)
function getUserId(req: Request): string {
  return (req.user as any)?.id || req.query.userId as string || 'default-user';
}

/**
 * OAuth Authorization URL
 * GET /api/google-calendar/auth/url
 */
router.get('/auth/url', (req: Request, res: Response) => {
  try {
    const state = Math.random().toString(36).substring(7);
    const authUrl = OAuthTokenManager.getAuthorizationUrl(state);

    return res.status(200).json({
      authUrl,
      state,
    });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return res.status(500).json({
      error: 'Failed to generate authorization URL',
    });
  }
});

/**
 * OAuth Callback
 * GET /api/google-calendar/auth/callback?code=...
 */
router.get('/auth/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.query;
    const userId = getUserId(req);

    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    const token = await OAuthTokenManager.exchangeCodeForToken(code as string);
    await OAuthTokenManager.saveToken(userId, token);

    return res.status(200).json({
      message: 'Authorization successful',
      userId,
    });
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    return res.status(500).json({
      error: (error as Error).message || 'Authorization failed',
    });
  }
});

/**
 * Create a calendar event
 * POST /api/google-calendar/events
 * Body: { title, startTime, endTime, timezone, description? }
 */
router.post('/events', async (req: Request, res: Response) => {
  try {
    const { title, startTime, endTime, timezone, description } = req.body;
    const userId = getUserId(req);

    // Validate inputs
    if (!title || !startTime || !endTime || !timezone) {
      return res.status(400).json({
        error: 'Missing required fields: title, startTime, endTime, timezone',
      });
    }

    const service = new CalendarEventService(
      async () => OAuthTokenManager.getToken(userId),
      async (token) => OAuthTokenManager.saveToken(userId, token),
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    const event = await service.createEvent(
      title,
      new Date(startTime),
      new Date(endTime),
      timezone,
      description
    );

    return res.status(201).json(event);
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return res.status(500).json({
      error: (error as Error).message || 'Failed to create calendar event',
    });
  }
});

/**
 * Query calendar events
 * GET /api/google-calendar/events?startDate=ISO&endDate=ISO
 */
router.get('/events', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const userId = getUserId(req);

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required query params: startDate, endDate (ISO format)',
      });
    }

    const service = new CalendarEventService(
      async () => OAuthTokenManager.getToken(userId),
      async (token) => OAuthTokenManager.saveToken(userId, token),
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    const events = await service.queryEvents(new Date(startDate as string), new Date(endDate as string));

    return res.status(200).json(events);
  } catch (error) {
    console.error('Error querying calendar events:', error);
    return res.status(500).json({
      error: (error as Error).message || 'Failed to query calendar events',
    });
  }
});

/**
 * Cancel (delete) a calendar event
 * DELETE /api/google-calendar/events/:eventId
 */
router.delete('/events/:eventId', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const userId = getUserId(req);

    if (!eventId) {
      return res.status(400).json({ error: 'Missing required param: eventId' });
    }

    const service = new CalendarEventService(
      async () => OAuthTokenManager.getToken(userId),
      async (token) => OAuthTokenManager.saveToken(userId, token),
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    await service.cancelEvent(eventId);

    return res.status(204).send();
  } catch (error) {
    console.error('Error canceling calendar event:', error);
    return res.status(500).json({
      error: (error as Error).message || 'Failed to cancel calendar event',
    });
  }
});

export default router;
