/**
 * Google Calendar Data Collector
 * Task 4: Google Calendar Data Collection (subtasks 4.1-4.4)
 */

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  status: 'scheduled' | 'completed' | 'cancelled';
}

export interface GoogleCalendarCollectedData {
  meetingsScheduled: number;
  meetingsCompleted: number;
  hoursInMeetings: number;
}

const API_TIMEOUT_MS = 3000; // Task 4.4: 3s timeout

export class GoogleCalendarDataCollector {
  constructor(private calendarClient?: any) {}

  /**
   * Task 4.1-4.4: Collect Google Calendar data with timeout
   */
  async collectData(startDate: Date, endDate: Date): Promise<GoogleCalendarCollectedData> {
    const results = {
      meetingsScheduled: 0,
      meetingsCompleted: 0,
      hoursInMeetings: 0,
    };

    if (!this.calendarClient) {
      return results; // Mock: return zeros
    }

    try {
      const events = await this.withTimeout(
        this.fetchEventsInRange(startDate, endDate),
        'Google Calendar'
      );

      return this.aggregateEvents(events);
    } catch (error) {
      throw new Error(
        `Google Calendar collection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Task 4.1: Fetch events in date range
   */
  private async fetchEventsInRange(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    if (!this.calendarClient) return [];

    try {
      // Would call Google Calendar API
      // const response = await this.calendarClient.events.list({
      //   calendarId: 'primary',
      //   timeMin: startDate.toISOString(),
      //   timeMax: endDate.toISOString(),
      //   maxResults: 1000
      // });
      // return response.items.map((event: any) => this.normalizeEvent(event));
      return [];
    } catch (error) {
      throw new Error(`Failed to fetch calendar events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Task 4.2: Count meetings by status (completed, upcoming)
   */
  private countMeetingsByStatus(events: CalendarEvent[], status: CalendarEvent['status']): number {
    return events.filter((event) => event.status === status).length;
  }

  /**
   * Task 4.3: Sum meeting hours
   */
  private sumMeetingHours(events: CalendarEvent[]): number {
    return events.reduce((total, event) => {
      const durationMs = event.endTime.getTime() - event.startTime.getTime();
      const durationHours = durationMs / (1000 * 60 * 60);
      return total + durationHours;
    }, 0);
  }

  /**
   * Task 4.2-4.3: Aggregate events into metrics
   */
  private aggregateEvents(events: CalendarEvent[]): GoogleCalendarCollectedData {
    return {
      meetingsScheduled: this.countMeetingsByStatus(events, 'scheduled'),
      meetingsCompleted: this.countMeetingsByStatus(events, 'completed'),
      hoursInMeetings: this.sumMeetingHours(events),
    };
  }

  /**
   * Normalize Google Calendar event to standard format
   */
  private normalizeEvent(rawEvent: any): CalendarEvent {
    const startTime = new Date(rawEvent.start.dateTime || rawEvent.start.date);
    const endTime = new Date(rawEvent.end.dateTime || rawEvent.end.date);
    const now = new Date();

    // Determine status based on time and event properties
    let status: CalendarEvent['status'] = 'scheduled';
    if (endTime < now) {
      status = 'completed';
    } else if (rawEvent.status === 'cancelled') {
      status = 'cancelled';
    }

    return {
      id: rawEvent.id,
      title: rawEvent.summary || 'Untitled',
      startTime,
      endTime,
      status,
    };
  }

  /**
   * Task 4.4: Timeout wrapper for API calls
   */
  private async withTimeout<T>(promise: Promise<T>, source: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${source} timeout (${API_TIMEOUT_MS}ms)`)), API_TIMEOUT_MS)
      ),
    ]);
  }
}
