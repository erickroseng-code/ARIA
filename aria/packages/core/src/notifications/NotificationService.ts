/**
 * Notification Service
 * Orchestrates all notification channels (Telegram, Web UI, Database)
 * Task 4: Notification System
 */

import { TelegramService } from './TelegramService';
import { GeneratedReport } from '../reports/ReportGenerationService';

export interface NotificationRecord {
  id: string;
  userId: string;
  reportId: string;
  type: 'report_ready' | 'report_error' | 'report_started';
  channels: {
    telegram: boolean;
    webUI: boolean;
    database: boolean;
  };
  sentAt: Date;
  message?: string;
}

export class NotificationService {
  private telegramService: TelegramService;
  private notifications: NotificationRecord[] = []; // In-memory storage (DB in production)

  constructor(telegramBotToken?: string, telegramChatId?: string) {
    this.telegramService = new TelegramService(
      telegramBotToken,
      telegramChatId
    );
  }

  /**
   * Task 4.1: Notify when report is ready
   */
  async notifyReportReady(
    report: GeneratedReport,
    userId: string
  ): Promise<NotificationRecord> {
    const notification: NotificationRecord = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      reportId: report.id,
      type: 'report_ready',
      channels: {
        telegram: false,
        webUI: true, // Always notify Web UI
        database: true, // Always store in DB
      },
      sentAt: new Date(),
      message: `Relatório de ${report.period.start.toLocaleDateString('pt-BR')} a ${report.period.end.toLocaleDateString('pt-BR')} pronto para visualizar`,
    };

    // Send via Telegram (if configured)
    if (this.telegramService.isConfigured()) {
      const sent = await this.telegramService.sendReportReady(
        report.period,
        report.notionPageId
      );
      notification.channels.telegram = sent;
    }

    // Store in database
    this.storeNotification(notification);

    // Task 4.2: Web UI update (broadcaster pattern)
    this.broadcastToWebUI(notification);

    return notification;
  }

  /**
   * Task 4.1: Notify when report generation fails
   */
  async notifyReportError(
    userId: string,
    errorMessage: string
  ): Promise<NotificationRecord> {
    const notification: NotificationRecord = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      reportId: '',
      type: 'report_error',
      channels: {
        telegram: false,
        webUI: true,
        database: true,
      },
      sentAt: new Date(),
      message: `Erro ao gerar relatório: ${errorMessage}`,
    };

    // Send via Telegram (if configured)
    if (this.telegramService.isConfigured()) {
      const sent = await this.telegramService.sendReportError(errorMessage);
      notification.channels.telegram = sent;
    }

    // Store in database
    this.storeNotification(notification);

    // Web UI update
    this.broadcastToWebUI(notification);

    return notification;
  }

  /**
   * Task 4.3: Store notification in database
   * (In-memory for now, replace with real DB)
   */
  private storeNotification(notification: NotificationRecord): void {
    this.notifications.push(notification);
    console.log(`✅ Notificação armazenada: ${notification.id}`);
  }

  /**
   * Task 4.2: Broadcast to Web UI
   * (In production: WebSocket, Server-Sent Events, or polling endpoint)
   */
  private broadcastToWebUI(notification: NotificationRecord): void {
    console.log('📱 Web UI Update:');
    console.log(`   Status: ${notification.type}`);
    console.log(`   Message: ${notification.message}`);
    console.log(
      `   Time: ${notification.sentAt.toLocaleTimeString('pt-BR')}`
    );
  }

  /**
   * Task 4.3: Get notification history for user
   */
  getNotificationsForUser(userId: string): NotificationRecord[] {
    return this.notifications.filter((n) => n.userId === userId);
  }

  /**
   * Task 4.3: Get all notifications
   */
  getAllNotifications(): NotificationRecord[] {
    return [...this.notifications];
  }

  /**
   * Task 4.4: Clear notifications (for testing)
   */
  clearNotifications(): void {
    this.notifications = [];
  }

  /**
   * Check if services are configured
   */
  isFullyConfigured(): boolean {
    return this.telegramService.isConfigured();
  }

  /**
   * Get configuration status
   */
  getConfigurationStatus(): {
    telegram: boolean;
    webUI: boolean;
    database: boolean;
  } {
    return {
      telegram: this.telegramService.isConfigured(),
      webUI: true, // Always available
      database: true, // Always available
    };
  }
}
