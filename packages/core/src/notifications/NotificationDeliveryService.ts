/**
 * NotificationDeliveryService: Entrega notificações via Telegram e WebSocket
 * Com retry logic e error handling
 */

import { ProactiveNotificationService } from './ProactiveNotificationService';
import type { NotificationEvent } from './ProactiveNotificationService';

export interface DeliveryResult {
  notificationId: string;
  channel: 'telegram' | 'web-ui';
  success: boolean;
  sentAt: Date;
  error?: string;
  retryCount: number;
}

export class NotificationDeliveryService {
  private telegramToken?: string;
  private maxRetries: number = 3;
  private retryDelays: number[] = [1000, 5000, 15000]; // exponential backoff in ms
  private deliveryHistory: Map<string, DeliveryResult[]> = new Map();
  private activeWebSocketConnections: Map<string, any> = new Map();
  private failedQueue: Map<string, { notification: NotificationEvent; retries: number }> =
    new Map();

  constructor(
    private notificationService: ProactiveNotificationService,
    telegramToken?: string
  ) {
    this.telegramToken = telegramToken || process.env.TELEGRAM_BOT_TOKEN;
  }

  /**
   * Deliver all queued notifications for a user
   */
  async deliverQueuedNotifications(userId: string): Promise<DeliveryResult[]> {
    const queue = this.notificationService.getDeliveryQueue(userId);
    const results: DeliveryResult[] = [];

    for (const notification of queue) {
      const deliveryResults = await this.deliverNotification(userId, notification);
      results.push(...deliveryResults);
    }

    // Clear queue after delivery attempts
    this.notificationService.clearDeliveryQueue(userId);

    return results;
  }

  /**
   * Deliver single notification via all configured channels
   */
  async deliverNotification(userId: string, notification: NotificationEvent): Promise<DeliveryResult[]> {
    const prefs = this.notificationService.getUserPreferences(userId);
    const results: DeliveryResult[] = [];

    for (const channel of prefs.deliveryChannels) {
      if (channel === 'telegram') {
        const result = await this.deliverViaTelegram(userId, notification);
        results.push(result);

        if (!result.success) {
          // Queue for retry
          this.queueForRetry(notification);
        }
      } else if (channel === 'web-ui') {
        const result = await this.deliverViaWebSocket(userId, notification);
        results.push(result);

        if (!result.success) {
          // Queue for retry on user login
          this.queueForRetry(notification);
        }
      }
    }

    // Store delivery history
    this.deliveryHistory.set(notification.id, results);

    return results;
  }

  /**
   * Deliver via Telegram
   */
  private async deliverViaTelegram(
    userId: string,
    notification: NotificationEvent
  ): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      if (!this.telegramToken) {
        throw new Error('Telegram token not configured');
      }

      const message = this.formatTelegramMessage(notification);

      // In real implementation: call Telegram Bot API
      console.log(`[Telegram] Sending to user ${userId}: ${message}`);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 100));

      return {
        notificationId: notification.id,
        channel: 'telegram',
        success: true,
        sentAt: new Date(),
        retryCount: 0,
      };
    } catch (error) {
      return {
        notificationId: notification.id,
        channel: 'telegram',
        success: false,
        sentAt: new Date(),
        error: (error as Error).message,
        retryCount: 0,
      };
    }
  }

  /**
   * Deliver via WebSocket
   */
  private async deliverViaWebSocket(
    userId: string,
    notification: NotificationEvent
  ): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      const connection = this.activeWebSocketConnections.get(userId);

      if (!connection) {
        // User not connected, queue for later delivery
        return {
          notificationId: notification.id,
          channel: 'web-ui',
          success: false,
          sentAt: new Date(),
          error: 'User not connected',
          retryCount: 0,
        };
      }

      const payload = this.formatWebUIMessage(notification);
      connection.send(JSON.stringify(payload));

      return {
        notificationId: notification.id,
        channel: 'web-ui',
        success: true,
        sentAt: new Date(),
        retryCount: 0,
      };
    } catch (error) {
      return {
        notificationId: notification.id,
        channel: 'web-ui',
        success: false,
        sentAt: new Date(),
        error: (error as Error).message,
        retryCount: 0,
      };
    }
  }

  /**
   * Retry failed notifications with exponential backoff
   */
  async retryFailedNotifications(): Promise<number> {
    let retryCount = 0;

    for (const [notifId, { notification, retries }] of this.failedQueue) {
      if (retries >= this.maxRetries) {
        // Max retries reached, remove from queue
        this.failedQueue.delete(notifId);
        console.log(`Max retries reached for notification ${notifId}`);
        continue;
      }

      // Wait before retrying
      const delay = this.retryDelays[Math.min(retries, this.retryDelays.length - 1)];
      await new Promise(resolve => setTimeout(resolve, delay));

      // Retry delivery
      const results = await this.deliverNotification(notification.userId, notification);

      if (results.some(r => r.success)) {
        // At least one channel succeeded
        this.failedQueue.delete(notifId);
        retryCount++;
      } else {
        // Still failed, increment retry count
        this.failedQueue.set(notifId, {
          notification,
          retries: retries + 1,
        });
      }
    }

    return retryCount;
  }

  /**
   * Register WebSocket connection for a user
   */
  registerConnection(userId: string, connection: any): void {
    this.activeWebSocketConnections.set(userId, connection);
    console.log(`WebSocket connected for user ${userId}`);

    // Deliver any pending notifications
    this.deliverPendingNotifications(userId);
  }

  /**
   * Unregister WebSocket connection
   */
  unregisterConnection(userId: string): void {
    this.activeWebSocketConnections.delete(userId);
    console.log(`WebSocket disconnected for user ${userId}`);
  }

  /**
   * Deliver pending notifications when user connects
   */
  private async deliverPendingNotifications(userId: string): Promise<void> {
    // In real implementation: fetch from database/Redis and deliver
    console.log(`Checking pending notifications for user ${userId}`);
  }

  /**
   * Queue notification for retry
   */
  private queueForRetry(notification: NotificationEvent): void {
    if (!this.failedQueue.has(notification.id)) {
      this.failedQueue.set(notification.id, {
        notification,
        retries: 0,
      });
    }
  }

  /**
   * Format message for Telegram
   */
  private formatTelegramMessage(notification: NotificationEvent): string {
    const baseMessage = `*${notification.title}*\n${notification.description || ''}`;

    if (notification.type === 'calendar-reminder') {
      return baseMessage + `\n_Clique para abrir calendário_`;
    } else if (notification.type === 'task-overdue') {
      return baseMessage + `\n_Clique para abrir tarefa_`;
    }

    return baseMessage;
  }

  /**
   * Format message for Web UI
   */
  private formatWebUIMessage(notification: NotificationEvent): any {
    return {
      type: 'notification',
      id: notification.id,
      title: notification.title,
      description: notification.description,
      notificationType: notification.type,
      actions: [
        { label: 'Dismiss', action: 'dismiss' },
        { label: 'Snooze 15m', action: 'snooze_15' },
        { label: 'Snooze 1h', action: 'snooze_60' },
        { label: 'Snooze 1d', action: 'snooze_1440' },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get delivery history
   */
  getDeliveryHistory(notificationId: string): DeliveryResult[] {
    return this.deliveryHistory.get(notificationId) || [];
  }

  /**
   * Get failed queue status
   */
  getFailedQueueStatus(): {
    count: number;
    notifications: Array<{ id: string; retries: number }>;
  } {
    return {
      count: this.failedQueue.size,
      notifications: Array.from(this.failedQueue.entries()).map(([id, { retries }]) => ({
        id,
        retries,
      })),
    };
  }

  /**
   * Clear delivery history (cleanup)
   */
  clearDeliveryHistory(): void {
    this.deliveryHistory.clear();
    console.log('Delivery history cleared');
  }

  /**
   * Test notification delivery
   */
  async testDelivery(userId: string): Promise<{ telegram: boolean; webui: boolean }> {
    const testNotification: NotificationEvent = {
      id: `test-${Date.now()}`,
      type: 'calendar-reminder',
      userId,
      title: '🧪 Teste de Notificação',
      description: 'Esta é uma notificação de teste',
      createdAt: new Date(),
    };

    const results = await this.deliverNotification(userId, testNotification);

    return {
      telegram: results.some(r => r.channel === 'telegram' && r.success),
      webui: results.some(r => r.channel === 'web-ui' && r.success),
    };
  }
}
