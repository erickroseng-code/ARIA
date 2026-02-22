/**
 * MeetingCompletionDetector: Monitoriza eventos do Google Calendar e detecta quando reuniões são concluídas
 * Integra-se com CalendarEventService para monitoramento contínuo
 */

import { CalendarEventService } from './CalendarEventService';
import type { CalendarEvent } from './CalendarEventService';

export interface MeetingContext {
  eventId: string;
  title: string;
  startTime: Date;
  endTime: Date;
  participants?: string[]; // Extracted from title or description
  description?: string;
  timezone: string;
  completedAt?: Date;
}

export interface MeetingCompletionEvent {
  type: 'meeting_completed';
  meeting: MeetingContext;
  detectedAt: Date;
  detectionMethod: 'time-based' | 'manual-command';
}

export class MeetingCompletionDetector {
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private completedMeetings: Set<string> = new Set();
  private listeners: ((event: MeetingCompletionEvent) => Promise<void>)[] = [];

  constructor(
    private calendarService: CalendarEventService,
    private pollingIntervalMs: number = 60000 // 1 minute
  ) {}

  /**
   * Start monitoring calendar events for a user
   */
  async startMonitoring(userId: string): Promise<void> {
    // Prevent duplicate monitoring
    if (this.monitoringIntervals.has(userId)) {
      console.log(`Already monitoring calendar for user ${userId}`);
      return;
    }

    // Initial check
    await this.checkAndNotifyCompletedMeetings(userId);

    // Set up polling
    const interval = setInterval(
      () => this.checkAndNotifyCompletedMeetings(userId),
      this.pollingIntervalMs
    );

    this.monitoringIntervals.set(userId, interval);
    console.log(`Started monitoring calendar for user ${userId}`);
  }

  /**
   * Stop monitoring calendar events for a user
   */
  stopMonitoring(userId: string): void {
    const interval = this.monitoringIntervals.get(userId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(userId);
      console.log(`Stopped monitoring calendar for user ${userId}`);
    }
  }

  /**
   * Check for completed meetings since last check
   */
  private async checkAndNotifyCompletedMeetings(userId: string): Promise<void> {
    try {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      // Query today's events
      const events = await this.calendarService.queryEvents(startOfDay, endOfDay);

      for (const event of events) {
        // Check if event has ended and hasn't been notified yet
        if (
          event.endTime < now &&
          !this.completedMeetings.has(event.id)
        ) {
          // Extract participants from title or description
          const participants = this.extractParticipants(event);

          const meetingContext: MeetingContext = {
            eventId: event.id,
            title: event.title,
            startTime: event.startTime,
            endTime: event.endTime,
            participants,
            description: event.description,
            timezone: event.timezone,
            completedAt: now,
          };

          // Notify listeners
          await this.notifyListeners({
            type: 'meeting_completed',
            meeting: meetingContext,
            detectedAt: now,
            detectionMethod: 'time-based',
          });

          // Mark as completed
          this.completedMeetings.add(event.id);
        }
      }
    } catch (error) {
      console.error(`Error checking completed meetings for user ${userId}:`, error);
    }
  }

  /**
   * Manual trigger for meeting summarization via command
   * Used when user runs: "/resumir reunião" or similar
   */
  async manualTriggerSummarization(
    meetingTitle: string,
    meetingNotes?: string
  ): Promise<MeetingCompletionEvent> {
    const now = new Date();
    const eventId = `manual-${Date.now()}`;

    const meetingContext: MeetingContext = {
      eventId,
      title: meetingTitle,
      startTime: now,
      endTime: now,
      timezone: 'America/Sao_Paulo',
      description: meetingNotes,
      completedAt: now,
    };

    const event: MeetingCompletionEvent = {
      type: 'meeting_completed',
      meeting: meetingContext,
      detectedAt: now,
      detectionMethod: 'manual-command',
    };

    // Notify listeners
    await this.notifyListeners(event);

    // Mark as completed
    this.completedMeetings.add(eventId);

    return event;
  }

  /**
   * Register listener for meeting completion events
   */
  onMeetingCompleted(callback: (event: MeetingCompletionEvent) => Promise<void>): void {
    this.listeners.push(callback);
  }

  /**
   * Remove listener
   */
  removeListener(callback: (event: MeetingCompletionEvent) => Promise<void>): void {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Get monitoring status
   */
  getMonitoringStatus(): { userId: string; isMonitoring: boolean }[] {
    const status: { userId: string; isMonitoring: boolean }[] = [];
    this.monitoringIntervals.forEach((_, userId) => {
      status.push({ userId, isMonitoring: true });
    });
    return status;
  }

  /**
   * Clear completed meetings cache (for testing or reset)
   */
  clearCompletedCache(): void {
    this.completedMeetings.clear();
  }

  /**
   * Private: Notify all listeners of meeting completion
   */
  private async notifyListeners(event: MeetingCompletionEvent): Promise<void> {
    for (const listener of this.listeners) {
      try {
        await listener(event);
      } catch (error) {
        console.error('Error notifying listener of meeting completion:', error);
      }
    }
  }

  /**
   * Extract participant names from title and description
   * Examples:
   * - "Reunião com Empresa X" → ["Empresa X"]
   * - "Meeting with John & Jane" → ["John", "Jane"]
   * - Description may contain attendees list
   */
  private extractParticipants(event: CalendarEvent): string[] {
    const participants: Set<string> = new Set();

    // Extract from title: patterns like "with X", "com X", "and Y"
    const titlePatterns = [
      /(?:with|com)\s+([A-Za-z\s&]+?)(?:\s+(?:at|em|às)|\s*$)/gi,
      /(?:&|and)\s+([A-Za-z\s]+?)(?:\s+(?:at|em|às)|\s*$)/gi,
    ];

    for (const pattern of titlePatterns) {
      let match;
      while ((match = pattern.exec(event.title)) !== null) {
        const names = match[1]
          .split(/[&,]/)
          .map(n => n.trim())
          .filter(n => n.length > 0);
        names.forEach(n => participants.add(n));
      }
    }

    // Extract from description if available
    if (event.description) {
      // Look for "Attendees:" or "Participantes:" sections
      const attendeesMatch = event.description.match(
        /(?:Attendees|Participantes|Participants):\s*([^\n]+)/i
      );
      if (attendeesMatch) {
        const names = attendeesMatch[1]
          .split(/[,;]/)
          .map(n => n.trim())
          .filter(n => n.length > 0);
        names.forEach(n => participants.add(n));
      }
    }

    return Array.from(participants);
  }
}
