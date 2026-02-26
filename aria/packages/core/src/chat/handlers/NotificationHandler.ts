// @ts-nocheck
/**
 * NotificationHandler: Gerencia preferências e ações de notificações
 * Integra-se com ProactiveNotificationService para controle de notificações
 */

import { ProactiveNotificationService, NotificationPreferences } from '../../notifications/ProactiveNotificationService';
import { NotificationDeliveryService } from '../../notifications/NotificationDeliveryService';
import type { ParsedCommand } from '../IntentParser';

export interface NotificationHandlerResponse {
  type: 'success' | 'error' | 'info';
  message: string;
  data?: any;
}

export class NotificationHandler {
  private notificationService: ProactiveNotificationService;
  private deliveryService: NotificationDeliveryService;

  constructor(private userId: string) {
    this.notificationService = new ProactiveNotificationService();
    this.deliveryService = new NotificationDeliveryService(this.notificationService);
  }

  /**
   * Handle notification-related commands
   */
  async handle(command: ParsedCommand): Promise<NotificationHandlerResponse> {
    try {
      switch (command.action) {
        case 'enable':
          return await this.handleEnable(command);
        case 'disable':
          return await this.handleDisable(command);
        case 'snooze':
          return await this.handleSnooze(command);
        case 'dismiss':
          return await this.handleDismiss(command);
        case 'preferences':
          return await this.handlePreferences(command);
        case 'status':
          return await this.handleStatus(command);
        case 'test':
          return await this.handleTestNotification(command);
        default:
          return {
            type: 'error',
            message: `Ação de notificação não suportada: ${command.action}`,
          };
      }
    } catch (error) {
      return {
        type: 'error',
        message: `Erro ao processar notificação: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Enable notifications
   */
  private async handleEnable(command: ParsedCommand): Promise<NotificationHandlerResponse> {
    const prefs = this.notificationService.getUserPreferences(this.userId);

    if (command.entities.type === 'calendar') {
      prefs.enableCalendarReminders = true;
      return {
        type: 'success',
        message: '✅ Lembretes de calendário ativados',
      };
    } else if (command.entities.type === 'tasks') {
      prefs.enableTaskReminders = true;
      return {
        type: 'success',
        message: '✅ Lembretes de tarefas ativados',
      };
    }

    prefs.enableCalendarReminders = true;
    prefs.enableTaskReminders = true;
    this.notificationService.setUserPreferences(prefs);

    return {
      type: 'success',
      message: '✅ Todas as notificações ativadas',
    };
  }

  /**
   * Disable notifications
   */
  private async handleDisable(command: ParsedCommand): Promise<NotificationHandlerResponse> {
    const prefs = this.notificationService.getUserPreferences(this.userId);

    if (command.entities.type === 'calendar') {
      prefs.enableCalendarReminders = false;
      return {
        type: 'success',
        message: '⏸️ Lembretes de calendário desativados',
      };
    } else if (command.entities.type === 'tasks') {
      prefs.enableTaskReminders = false;
      return {
        type: 'success',
        message: '⏸️ Lembretes de tarefas desativados',
      };
    }

    prefs.enableCalendarReminders = false;
    prefs.enableTaskReminders = false;
    this.notificationService.setUserPreferences(prefs);

    return {
      type: 'success',
      message: '⏸️ Todas as notificações desativadas',
    };
  }

  /**
   * Handle snooze action
   */
  private async handleSnooze(command: ParsedCommand): Promise<NotificationHandlerResponse> {
    const notificationId = command.entities.notificationId as string;
    const minutes = command.entities.minutes as number || 15;

    if (!notificationId) {
      return {
        type: 'error',
        message: '❌ ID de notificação não fornecido',
      };
    }

    this.notificationService.snoozeNotification(notificationId, minutes);

    const timeLabel =
      minutes === 15 ? '15 min' : minutes === 60 ? '1 hora' : minutes === 1440 ? '1 dia' : `${minutes} min`;

    return {
      type: 'success',
      message: `⏰ Notificação silenciada por ${timeLabel}`,
    };
  }

  /**
   * Handle dismiss action
   */
  private async handleDismiss(command: ParsedCommand): Promise<NotificationHandlerResponse> {
    const notificationId = command.entities.notificationId as string;

    if (!notificationId) {
      return {
        type: 'error',
        message: '❌ ID de notificação não fornecido',
      };
    }

    this.notificationService.dismissNotification(notificationId);

    return {
      type: 'success',
      message: '✅ Notificação descartada',
    };
  }

  /**
   * Get notification preferences
   */
  private async handlePreferences(command: ParsedCommand): Promise<NotificationHandlerResponse> {
    const prefs = this.notificationService.getUserPreferences(this.userId);

    const status = `
📋 **Suas Preferências de Notificação:**

- **Lembretes de Calendário:** ${prefs.enableCalendarReminders ? '✅ Ativado' : '❌ Desativado'} (${prefs.calendarReminderMinutes} min antes)
- **Lembretes de Tarefas:** ${prefs.enableTaskReminders ? '✅ Ativado' : '❌ Desativado'}
- **Canais de Entrega:** ${prefs.deliveryChannels.join(', ')}
- **Timezone:** ${prefs.timezone}
- **Max. Notificações/Hora:** ${prefs.maxNotificationsPerHour}
    `.trim();

    return {
      type: 'info',
      message: status,
      data: prefs,
    };
  }

  /**
   * Get notification status
   */
  private async handleStatus(command: ParsedCommand): Promise<NotificationHandlerResponse> {
    const monitoringStatus = this.notificationService.getMonitoringStatus();
    const isMonitoring = monitoringStatus.some(s => s.userId === this.userId);
    const history = this.notificationService.getNotificationHistory(this.userId, 5);
    const failedQueue = this.deliveryService.getFailedQueueStatus();

    const status = `
📊 **Status de Notificações:**

- **Monitoramento:** ${isMonitoring ? '✅ Ativo' : '❌ Inativo'}
- **Notificações Recentes:** ${history.length}
- **Fila de Retry:** ${failedQueue.count} itens
- **Última Notificação:** ${history[0]?.createdAt.toLocaleTimeString('pt-BR') || 'Nenhuma'}
    `.trim();

    return {
      type: 'info',
      message: status,
      data: {
        isMonitoring,
        recentNotifications: history,
        failedQueue,
      },
    };
  }

  /**
   * Test notification delivery
   */
  private async handleTestNotification(command: ParsedCommand): Promise<NotificationHandlerResponse> {
    try {
      const result = await this.deliveryService.testDelivery(this.userId);

      const telegramStatus = result.telegram ? '✅' : '❌';
      const webuiStatus = result.webui ? '✅' : '❌';

      return {
        type: 'success',
        message: `
🧪 **Teste de Notificação:**

- **Telegram:** ${telegramStatus}
- **Web UI:** ${webuiStatus}

Verifique seus canais de entrega!
        `.trim(),
        data: result,
      };
    } catch (error) {
      return {
        type: 'error',
        message: `Erro ao testar notificações: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Start monitoring for a user
   */
  async startMonitoring(): Promise<void> {
    await this.notificationService.startMonitoring(this.userId);
  }

  /**
   * Stop monitoring for a user
   */
  stopMonitoring(): void {
    this.notificationService.stopMonitoring(this.userId);
  }

  /**
   * Register WebSocket connection for Web UI notifications
   */
  registerWebSocketConnection(connection: any): void {
    this.deliveryService.registerConnection(this.userId, connection);
  }

  /**
   * Unregister WebSocket connection
   */
  unregisterWebSocketConnection(): void {
    this.deliveryService.unregisterConnection(this.userId);
  }
}
