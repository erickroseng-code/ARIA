/**
 * CalendarEventService: Google Calendar integration for ARIA
 * Handles event creation, queries, cancellation, and OAuth token refresh
 */

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  description?: string;
  googleMeetLink?: string;
  url: string;
}

export interface GoogleOAuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  tokenType: string;
}

interface CacheEntry {
  data: CalendarEvent[];
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const API_TIMEOUT_MS = 10000; // 10 seconds per API call
const CALENDAR_API_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export class CalendarEventService {
  private cache: Map<string, CacheEntry> = new Map();
  private tokenRefreshBuffer = 5 * 60 * 1000; // Refresh 5min before expiry

  constructor(
    private getStoredToken: () => Promise<GoogleOAuthToken | null>,
    private saveToken: (token: GoogleOAuthToken) => Promise<void>,
    private clientId?: string,
    private clientSecret?: string
  ) {}

  /**
   * Create a calendar event
   */
  async createEvent(
    title: string,
    startTime: Date,
    endTime: Date,
    timezone: string,
    description?: string
  ): Promise<CalendarEvent> {
    const token = await this.ensureValidToken();

    const eventBody = {
      summary: title,
      description: description || '',
      start: {
        dateTime: startTime.toISOString(),
        timeZone: timezone,
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: timezone,
      },
    };

    try {
      const response = await this.makeApiRequest('POST', CALENDAR_API_URL, eventBody, token);
      const event = response as any;

      this.clearCache();

      return {
        id: event.id,
        title: event.summary,
        startTime: new Date(event.start.dateTime),
        endTime: new Date(event.end.dateTime),
        timezone,
        description: event.description,
        googleMeetLink: event.conferenceData?.entryPoints?.[0]?.uri,
        url: event.htmlLink,
      };
    } catch (error) {
      throw new Error(`Failed to create calendar event: ${(error as Error).message}`);
    }
  }

  /**
   * Query calendar events for a date range
   */
  async queryEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    const cacheKey = `${startDate.toISOString()}_${endDate.toISOString()}`;

    // Check cache
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const token = await this.ensureValidToken();

    const params = new URLSearchParams({
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    });

    try {
      const response = await this.makeApiRequest(
        'GET',
        `${CALENDAR_API_URL}?${params}`,
        null,
        token
      );

      const items = (response as any).items || [];
      const events: CalendarEvent[] = items.map((item: any) => ({
        id: item.id,
        title: item.summary,
        startTime: new Date(item.start.dateTime || item.start.date),
        endTime: new Date(item.end.dateTime || item.end.date),
        timezone: item.start.timeZone || 'America/Sao_Paulo',
        description: item.description,
        googleMeetLink: item.conferenceData?.entryPoints?.[0]?.uri,
        url: item.htmlLink,
      }));

      this.setCache(cacheKey, events);
      return events;
    } catch (error) {
      throw new Error(`Failed to query calendar events: ${(error as Error).message}`);
    }
  }

  /**
   * Cancel (delete) a calendar event
   */
  async cancelEvent(eventId: string): Promise<void> {
    const token = await this.ensureValidToken();

    try {
      await this.makeApiRequest('DELETE', `${CALENDAR_API_URL}/${eventId}`, null, token);
      this.clearCache();
    } catch (error) {
      throw new Error(`Failed to cancel event: ${(error as Error).message}`);
    }
  }

  /**
   * Ensure token is valid, refresh if needed
   */
  private async ensureValidToken(): Promise<string> {
    const token = await this.getStoredToken();

    if (!token) {
      throw new Error(
        'No OAuth token found. Please authenticate with Google Calendar: [re-auth link needed]'
      );
    }

    // Check if token expires within buffer
    if (Date.now() > token.expiresAt.getTime() - this.tokenRefreshBuffer) {
      await this.refreshToken(token);
      const updatedToken = await this.getStoredToken();
      if (!updatedToken) throw new Error('Failed to refresh token');
      return updatedToken.accessToken;
    }

    return token.accessToken;
  }

  /**
   * Refresh OAuth token using refresh token
   */
  private async refreshToken(token: GoogleOAuthToken): Promise<void> {
    const params = new URLSearchParams({
      client_id: this.clientId || process.env.GOOGLE_CLIENT_ID || '',
      client_secret: this.clientSecret || process.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: token.refreshToken,
      grant_type: 'refresh_token',
    });

    try {
      const response = await this.makeApiRequest(
        'POST',
        'https://oauth2.googleapis.com/token',
        params.toString(),
        '',
        { 'Content-Type': 'application/x-www-form-urlencoded' }
      );

      const data = response as any;
      const newToken: GoogleOAuthToken = {
        accessToken: data.access_token,
        refreshToken: token.refreshToken, // Keep existing refresh token
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        tokenType: data.token_type,
      };

      await this.saveToken(newToken);
    } catch (error) {
      throw new Error(
        `Token refresh failed. Please re-authenticate: ${(error as Error).message}`
      );
    }
  }

  /**
   * Make HTTP request with timeout
   */
  private async makeApiRequest(
    method: string,
    url: string,
    body: any,
    token: string,
    headers: Record<string, string> = {}
  ): Promise<any> {
    const defaultHeaders: Record<string, string> = {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
      ...headers,
    };

    // Remove empty Authorization header
    if (!token) delete defaultHeaders.Authorization;

    return Promise.race([
      fetch(url, {
        method,
        headers: defaultHeaders,
        body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
      }).then((res) => {
        if (!res.ok) {
          throw new Error(`API error: ${res.status} ${res.statusText}`);
        }
        return method === 'DELETE' ? null : res.json();
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`API timeout after ${API_TIMEOUT_MS}ms`)), API_TIMEOUT_MS)
      ),
    ]);
  }

  /**
   * Clear all cache
   */
  private clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get from cache if valid
   */
  private getFromCache(key: string): CalendarEvent[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cache entry
   */
  private setCache(key: string, data: CalendarEvent[]): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }
}
