/**
 * SummaryNotificationService: Notifica utilizador quando resumo de reunião está pronto
 * Suporta: Telegram, Web UI (banner)
 */

export type NotificationChannel = 'telegram' | 'web-ui' | 'both';

export interface NotificationPayload {
  userId: string;
  meetingTitle: string;
  summaryUrl: string; // Link to Notion page or summary page
  channel: NotificationChannel;
  timestamp: Date;
}

export interface NotificationResult {
  success: boolean;
  channel: NotificationChannel;
  sentAt: Date;
  error?: string;
}

export class SummaryNotificationService {
  private telegramToken?: string;
  private telegramChatId?: string;
  private webSocketConnections: Map<string, any> = new Map(); // userId -> WebSocket

  constructor(config?: { telegramToken?: string; telegramChatId?: string }) {
    this.telegramToken = config?.telegramToken || process.env.TELEGRAM_BOT_TOKEN;
    this.telegramChatId = config?.telegramChatId || process.env.TELEGRAM_CHAT_ID;
  }

  /**
   * Send summary ready notification
   */
  async notifySummaryReady(payload: NotificationPayload): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    if (payload.channel === 'telegram' || payload.channel === 'both') {
      results.push(await this.sendTelegramNotification(payload));
    }

    if (payload.channel === 'web-ui' || payload.channel === 'both') {
      results.push(await this.sendWebUINotification(payload));
    }

    return results;
  }

  /**
   * Send notification via Telegram
   */
  private async sendTelegramNotification(payload: NotificationPayload): Promise<NotificationResult> {
    const startTime = Date.now();

    try {
      if (!this.telegramToken) {
        throw new Error('Telegram token not configured');
      }

      const message = this.formatTelegramMessage(payload);

      // In real implementation: call Telegram Bot API
      // For now, log as placeholder
      console.log(`[Telegram] Sending to user ${payload.userId}: ${message}`);

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 100));

      return {
        success: true,
        channel: 'telegram',
        sentAt: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        channel: 'telegram',
        sentAt: new Date(),
        error: (error as Error).message,
      };
    }
  }

  /**
   * Send notification via Web UI (banner/toast)
   */
  private async sendWebUINotification(payload: NotificationPayload): Promise<NotificationResult> {
    const startTime = Date.now();

    try {
      // Check if user has active WebSocket connection
      const userConnection = this.webSocketConnections.get(payload.userId);

      if (!userConnection) {
        // User not connected - store notification for when they reconnect
        await this.storeNotificationForLater(payload);
        return {
          success: true,
          channel: 'web-ui',
          sentAt: new Date(),
        };
      }

      // Send via WebSocket
      const message = {
        type: 'summary_ready',
        meetingTitle: payload.meetingTitle,
        summaryUrl: payload.summaryUrl,
        timestamp: payload.timestamp,
      };

      userConnection.send(JSON.stringify(message));

      return {
        success: true,
        channel: 'web-ui',
        sentAt: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        channel: 'web-ui',
        sentAt: new Date(),
        error: (error as Error).message,
      };
    }
  }

  /**
   * Register WebSocket connection for a user
   */
  registerWebSocketConnection(userId: string, connection: any): void {
    this.webSocketConnections.set(userId, connection);
    console.log(`WebSocket connected for user ${userId}`);

    // Deliver stored notifications
    this.deliverPendingNotifications(userId);
  }

  /**
   * Unregister WebSocket connection
   */
  unregisterWebSocketConnection(userId: string): void {
    this.webSocketConnections.delete(userId);
    console.log(`WebSocket disconnected for user ${userId}`);
  }

  /**
   * Format message for Telegram
   */
  private formatTelegramMessage(payload: NotificationPayload): string {
    return (
      `✅ Resumo pronto!\n\n` +
      `📋 *${payload.meetingTitle}*\n\n` +
      `[Ver Resumo](${payload.summaryUrl})\n\n` +
      `_Gerado em ${new Date().toLocaleTimeString('pt-BR')}_`
    );
  }

  /**
   * Store notification for offline users
   */
  private async storeNotificationForLater(payload: NotificationPayload): Promise<void> {
    // In real implementation: store in Redis or database
    // For now, just log
    console.log(
      `Storing notification for user ${payload.userId} (offline): ${payload.meetingTitle}`
    );
  }

  /**
   * Deliver pending notifications when user reconnects
   */
  private async deliverPendingNotifications(userId: string): Promise<void> {
    // In real implementation: fetch from Redis/database and send
    console.log(`Checking pending notifications for user ${userId}`);
  }

  /**
   * Send bulk notifications
   */
  async notifyMultipleSummaries(
    payloads: NotificationPayload[]
  ): Promise<NotificationResult[][]> {
    return Promise.all(payloads.map(payload => this.notifySummaryReady(payload)));
  }

  /**
   * Get notification status for user
   */
  async getNotificationStatus(userId: string): Promise<{
    isConnected: boolean;
    pendingNotifications: number;
  }> {
    const isConnected = this.webSocketConnections.has(userId);

    // In real implementation: count pending notifications from storage
    const pendingNotifications = 0;

    return {
      isConnected,
      pendingNotifications,
    };
  }

  /**
   * Clear old notifications (cleanup)
   */
  async clearOldNotifications(olderThanHours: number): Promise<number> {
    // In real implementation: delete from storage
    console.log(`Clearing notifications older than ${olderThanHours} hours`);
    return 0;
  }

  /**
   * Test notification connectivity
   */
  async testConnectivity(): Promise<{ telegram: boolean; webUI: boolean }> {
    return {
      telegram: !!this.telegramToken,
      webUI: this.webSocketConnections.size > 0,
    };
  }
}
