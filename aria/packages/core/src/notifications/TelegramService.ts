/**
 * Telegram Notification Service
 * Sends notifications when reports are ready
 *
 * Requires: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env
 */

export interface TelegramNotification {
  title: string;
  message: string;
  notionPageId?: string;
  period?: { start: Date; end: Date };
}

export class TelegramService {
  private botToken: string;
  private chatId: string;
  private baseUrl = 'https://api.telegram.org';

  constructor(botToken?: string, chatId?: string) {
    this.botToken = botToken || process.env.TELEGRAM_BOT_TOKEN || '';
    this.chatId = chatId || process.env.TELEGRAM_CHAT_ID || '';

    if (!this.botToken || !this.chatId) {
      console.warn(
        '⚠️  Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env'
      );
    }
  }

  /**
   * Check if Telegram is configured
   */
  isConfigured(): boolean {
    return !!this.botToken && !!this.chatId;
  }

  /**
   * Send notification via Telegram
   */
  async sendNotification(notification: TelegramNotification): Promise<boolean> {
    if (!this.isConfigured()) {
      console.log('ℹ️  Telegram not configured, skipping notification');
      return false;
    }

    try {
      const message = this.formatMessage(notification);

      const response = await fetch(
        `${this.baseUrl}/bot${this.botToken}/sendMessage`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: this.chatId,
            text: message,
            parse_mode: 'Markdown',
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error('Telegram API error:', error);
        return false;
      }

      console.log('✅ Notificação enviada via Telegram');
      return true;
    } catch (error) {
      console.error('Erro ao enviar notificação Telegram:', error);
      return false;
    }
  }

  /**
   * Format notification message for Telegram
   */
  private formatMessage(notification: TelegramNotification): string {
    const period = notification.period
      ? `\n📅 Período: ${notification.period.start.toLocaleDateString('pt-BR')} a ${notification.period.end.toLocaleDateString('pt-BR')}`
      : '';

    const link = notification.notionPageId
      ? `\n🔗 [Abrir no Notion](https://notion.so/${notification.notionPageId})`
      : '';

    return (
      `*${notification.title}*\n\n` +
      `${notification.message}` +
      `${period}` +
      `${link}\n\n` +
      `_Gerado por ARIA - AI Report Insights & Analysis_`
    );
  }

  /**
   * Send report ready notification
   */
  async sendReportReady(
    period: { start: Date; end: Date },
    notionPageId?: string
  ): Promise<boolean> {
    return this.sendNotification({
      title: '📊 Relatório Pronto!',
      message:
        'Seu relatório foi gerado com sucesso e está pronto para visualizar.',
      notionPageId,
      period,
    });
  }

  /**
   * Send report error notification
   */
  async sendReportError(error: string): Promise<boolean> {
    return this.sendNotification({
      title: '❌ Erro ao Gerar Relatório',
      message: `Houve um erro ao gerar seu relatório:\n\n\`${error}\``,
    });
  }
}
