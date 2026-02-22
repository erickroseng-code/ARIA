/**
 * ProactiveNotificationService: Notificações proativas de reuniões e tarefas
 * Monitora calendário (15 min antes) e tarefas atrasadas
 */

export type NotificationTrigger = 'calendar-reminder' | 'task-overdue' | 'task-due-soon';

export interface NotificationEvent {
  id: string;
  type: NotificationTrigger;
  userId: string;
  title: string;
  description?: string;
  context?: {
    eventId?: string;
    taskId?: string;
    dueTime?: Date;
    priority?: 'high' | 'normal' | 'low';
  };
  createdAt: Date;
  deliveredAt?: Date;
  dismissed?: boolean;
  snoozedUntil?: Date;
}

export interface NotificationPreferences {
  userId: string;
  enableCalendarReminders: boolean;
  enableTaskReminders: boolean;
  calendarReminderMinutes: number; // Default: 15
  deliveryChannels: ('telegram' | 'web-ui')[];
  timezone: string;
  maxNotificationsPerHour: number; // Rate limiting
}

export interface SnoozeOption {
  label: string;
  minutes: number;
}

export class ProactiveNotificationService {
  private notificationHistory: Map<string, NotificationEvent> = new Map();
  private snoozedNotifications: Map<string, Date> = new Map();
  private deliveryQueues: Map<string, NotificationEvent[]> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private userPreferences: Map<string, NotificationPreferences> = new Map();

  // Snooze options
  private snoozeOptions: SnoozeOption[] = [
    { label: '15 min', minutes: 15 },
    { label: '1 hour', minutes: 60 },
    { label: '1 day', minutes: 1440 },
  ];

  constructor(private pollingIntervalMs: number = 60000) {} // 1 minute

  /**
   * Set user notification preferences
   */
  setUserPreferences(preferences: NotificationPreferences): void {
    this.userPreferences.set(preferences.userId, preferences);
    console.log(`Preferences set for user ${preferences.userId}`);
  }

  /**
   * Get user notification preferences
   */
  getUserPreferences(userId: string): NotificationPreferences {
    return (
      this.userPreferences.get(userId) || {
        userId,
        enableCalendarReminders: true,
        enableTaskReminders: true,
        calendarReminderMinutes: 15,
        deliveryChannels: ['telegram', 'web-ui'],
        timezone: 'America/Sao_Paulo',
        maxNotificationsPerHour: 10,
      }
    );
  }

  /**
   * Start monitoring events for a user
   */
  async startMonitoring(userId: string): Promise<void> {
    if (this.monitoringIntervals.has(userId)) {
      console.log(`Already monitoring for user ${userId}`);
      return;
    }

    // Initial check
    await this.checkCalendarReminders(userId);
    await this.checkTaskOverdueStatus(userId);

    // Set up polling
    const interval = setInterval(async () => {
      await this.checkCalendarReminders(userId);
      await this.checkTaskOverdueStatus(userId);
    }, this.pollingIntervalMs);

    this.monitoringIntervals.set(userId, interval);
    console.log(`Started monitoring notifications for user ${userId}`);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(userId: string): void {
    const interval = this.monitoringIntervals.get(userId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(userId);
      console.log(`Stopped monitoring for user ${userId}`);
    }
  }

  /**
   * Check for calendar reminders (15 min before)
   */
  async checkCalendarReminders(userId: string): Promise<NotificationEvent[]> {
    try {
      const prefs = this.getUserPreferences(userId);

      if (!prefs.enableCalendarReminders) {
        return [];
      }

      // In real implementation: query CalendarEventService
      // For now, return empty (would be populated by calendar events)
      const upcomingEvents = await this.getUpcomingCalendarEvents(
        userId,
        prefs.calendarReminderMinutes
      );

      const notifications: NotificationEvent[] = [];

      for (const event of upcomingEvents) {
        // Check if already notified (deduplication)
        const deduplicationKey = `calendar-${event.id}`;
        if (this.notificationHistory.has(deduplicationKey)) {
          continue;
        }

        // Check if snoozed
        if (this.snoozedNotifications.has(deduplicationKey)) {
          const snoozeUntil = this.snoozedNotifications.get(deduplicationKey);
          if (snoozeUntil && snoozeUntil > new Date()) {
            continue; // Still snoozed
          }
          this.snoozedNotifications.delete(deduplicationKey);
        }

        const notification: NotificationEvent = {
          id: deduplicationKey,
          type: 'calendar-reminder',
          userId,
          title: `📅 Reunião em ${prefs.calendarReminderMinutes} min`,
          description: event.title,
          context: {
            eventId: event.id,
            dueTime: event.startTime,
          },
          createdAt: new Date(),
        };

        notifications.push(notification);
        this.notificationHistory.set(deduplicationKey, notification);
      }

      // Queue for delivery
      if (notifications.length > 0) {
        await this.queueForDelivery(userId, notifications);
      }

      return notifications;
    } catch (error) {
      console.error(`Error checking calendar reminders for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Check for overdue tasks
   */
  async checkTaskOverdueStatus(userId: string): Promise<NotificationEvent[]> {
    try {
      const prefs = this.getUserPreferences(userId);

      if (!prefs.enableTaskReminders) {
        return [];
      }

      // In real implementation: query ClickUp API
      // For now, return empty (would be populated by overdue tasks)
      const overdueTasks = await this.getOverdueTasks(userId);

      const notifications: NotificationEvent[] = [];

      for (const task of overdueTasks) {
        // Check if already notified (deduplication)
        const deduplicationKey = `task-${task.id}`;
        if (this.notificationHistory.has(deduplicationKey)) {
          continue;
        }

        // Check if snoozed
        if (this.snoozedNotifications.has(deduplicationKey)) {
          const snoozeUntil = this.snoozedNotifications.get(deduplicationKey);
          if (snoozeUntil && snoozeUntil > new Date()) {
            continue; // Still snoozed
          }
          this.snoozedNotifications.delete(deduplicationKey);
        }

        const notification: NotificationEvent = {
          id: deduplicationKey,
          type: 'task-overdue',
          userId,
          title: '🔴 Tarefa atrasou!',
          description: task.name,
          context: {
            taskId: task.id,
            dueTime: task.dueDate,
            priority: task.priority,
          },
          createdAt: new Date(),
        };

        notifications.push(notification);
        this.notificationHistory.set(deduplicationKey, notification);
      }

      // Queue for delivery
      if (notifications.length > 0) {
        await this.queueForDelivery(userId, notifications);
      }

      return notifications;
    } catch (error) {
      console.error(`Error checking task status for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Queue notifications for delivery
   */
  async queueForDelivery(userId: string, notifications: NotificationEvent[]): Promise<void> {
    // Rate limiting check
    const prefs = this.getUserPreferences(userId);
    const recentCount = this.getRecentNotificationCount(userId, 60); // Last 60 minutes

    for (const notification of notifications) {
      if (recentCount >= prefs.maxNotificationsPerHour) {
        console.log(
          `Rate limit reached for user ${userId}: ${recentCount}/${prefs.maxNotificationsPerHour}`
        );
        break;
      }

      const queue = this.deliveryQueues.get(userId) || [];
      queue.push(notification);
      this.deliveryQueues.set(userId, queue);
    }
  }

  /**
   * Snooze a notification
   */
  snoozeNotification(notificationId: string, minutes: number): void {
    const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000);
    this.snoozedNotifications.set(notificationId, snoozeUntil);
    console.log(`Notification ${notificationId} snoozed until ${snoozeUntil.toISOString()}`);
  }

  /**
   * Dismiss a notification
   */
  dismissNotification(notificationId: string): void {
    const notification = this.notificationHistory.get(notificationId);
    if (notification) {
      notification.dismissed = true;
      this.notificationHistory.set(notificationId, notification);
      console.log(`Notification ${notificationId} dismissed`);
    }
  }

  /**
   * Get delivery queue for user
   */
  getDeliveryQueue(userId: string): NotificationEvent[] {
    return this.deliveryQueues.get(userId) || [];
  }

  /**
   * Clear delivery queue after successful delivery
   */
  clearDeliveryQueue(userId: string): void {
    this.deliveryQueues.delete(userId);
  }

  /**
   * Get snooze options
   */
  getSnoozeOptions(): SnoozeOption[] {
    return this.snoozeOptions;
  }

  /**
   * Get notification history
   */
  getNotificationHistory(userId: string, limit: number = 10): NotificationEvent[] {
    return Array.from(this.notificationHistory.values())
      .filter(n => n.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
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
   * Private: Get upcoming calendar events (stub)
   */
  private async getUpcomingCalendarEvents(
    userId: string,
    minutesBefore: number
  ): Promise<any[]> {
    // In real implementation: call CalendarEventService
    return [];
  }

  /**
   * Private: Get overdue tasks (stub)
   */
  private async getOverdueTasks(userId: string): Promise<any[]> {
    // In real implementation: call ClickUp API
    return [];
  }

  /**
   * Private: Count recent notifications
   */
  private getRecentNotificationCount(userId: string, minutes: number): number {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    return Array.from(this.notificationHistory.values()).filter(
      n => n.userId === userId && n.createdAt > cutoffTime && !n.dismissed
    ).length;
  }
}
