/**
 * CalendarHandler: Integra CALENDAR intent com CalendarEventService
 * Trata comandos de agenda (criar, consultar, cancelar eventos)
 */

import { CalendarService, isWorkspaceConfigured } from '@aria/integrations';

import type { ParsedCommand } from '../IntentParser';

export interface CalendarHandlerResponse {
  type: 'success' | 'error' | 'auth_required';
  message: string;
  authUrl?: string;
  events?: any[];
  eventId?: string;
}

export class CalendarHandler {
  constructor(private userId: string) { }

  /**
   * Handle calendar intent
   */
  async handle(command: ParsedCommand): Promise<CalendarHandlerResponse> {
    const service = new CalendarService();

    try {
      switch (command.action) {
        case 'create':
          return await this.handleCreateEvent(service, command);
        case 'query':
          return await this.handleQueryEvents(service, command);
        case 'cancel':
          return await this.handleCancelEvent(service, command);
        default:
          return {
            type: 'error',
            message: `Ação de calendário não suportada: ${command.action}`,
          };
      }
    } catch (error) {
      return {
        type: 'error',
        message: `Erro ao processar agenda: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Handle event creation
   */
  private async handleCreateEvent(
    service: CalendarService,
    command: ParsedCommand
  ): Promise<CalendarHandlerResponse> {
    // Check if user has Google Workspace authorization (server-side, no localStorage)
    const configured = await isWorkspaceConfigured();
    if (!configured) {
      return {
        type: 'auth_required',
        message: '🔐 Você precisa autorizar o Google Workspace para usar esta funcionalidade',
        authUrl: 'http://localhost:3001/api/auth/google/url',
      };
    }

    const { eventTitle, eventDate, eventTime } = command.entities;

    if (!eventTitle || !eventDate) {
      return {
        type: 'error',
        message: '❌ Preciso do título do evento e da data para agendar',
      };
    }

    // Parse date and time (simplified)
    const startDate = this.parseEventDate(eventDate, eventTime);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Default 1 hour duration

    try {
      const event = await service.createEvent(
        eventTitle,
        startDate.toISOString(),
        endDate.toISOString(),
        `Evento criado via ARIA Assistant`
      );

      return {
        type: 'success',
        message: `✅ Evento "${eventTitle}" agendado para ${this.formatDateTime(startDate)}`,
        eventId: event.id,
      };
    } catch (error) {
      const errorMsg = (error as Error).message;
      if (errorMsg.includes('Insufficient Permission') || errorMsg.includes('Forbidden') || errorMsg.includes('403')) {
        return {
          type: 'auth_required',
          message: `❌ Preciso de permissão para criar eventos no seu Google Calendar. Por favor, autorize acessando: http://localhost:3001/api/auth/google/url`,
        };
      }
      return {
        type: 'error',
        message: `❌ Erro ao criar evento: ${errorMsg}`,
      };
    }
  }

  /**
   * Handle event queries
   */
  private async handleQueryEvents(
    service: CalendarService,
    command: ParsedCommand
  ): Promise<CalendarHandlerResponse> {
    const { eventDate } = command.entities;

    // Parse date range
    const { startDate, endDate } = this.parseDateRange(eventDate || 'hoje');

    try {
      const events = await service.listEvents(startDate, endDate);

      if (events.length === 0) {
        return {
          type: 'success',
          message: `📅 Você não tem reuniões na agenda para o período solicitado.`,
          events: [],
        };
      }

      const eventList = events
        .map((e, i) => `${i + 1}. **${e.title}** — ${this.formatDateTime(new Date(e.startTime))}`)
        .join('\n');

      return {
        type: 'success',
        message: `📅 Suas reuniões ${eventDate || 'hoje'}:\n\n${eventList}`,
        events,
      };
    } catch (error) {
      const errorMsg = (error as Error).message;
      let aiInstruction = `Não consegui consultar sua agenda: ${errorMsg}`;
      if (errorMsg.includes('Insufficient Permission') || errorMsg.includes('Forbidden') || errorMsg.includes('403')) {
        aiInstruction = `Não consegui acessar sua agenda porque o token atual não tem permissão para isso (falta do escopo de Calendar). Para liberar o acesso, por favor atualize suas permissões clicando no botão do painel ou acessando: http://localhost:3001/api/auth/google/url`;
      }
      return {
        type: 'error',
        message: aiInstruction,
      };
    }
  }

  /**
   * Handle event cancellation
   */
  private async handleCancelEvent(
    service: CalendarService,
    command: ParsedCommand
  ): Promise<CalendarHandlerResponse> {
    const { eventTitle } = command.entities;

    if (!eventTitle) {
      return {
        type: 'error',
        message: '❌ Preciso do nome do evento para cancelar',
      };
    }

    // In a real implementation, you'd search for the event first
    // For now, we'll just show a message
    return {
      type: 'success',
      message: `❌ Cancelamento de "${eventTitle}" — use o Google Calendar para confirmar`,
    };
  }

  /**
   * Parse event date (simplified)
   */
  private parseEventDate(dateStr: string, timeStr?: string): Date {
    const now = new Date();
    let date = new Date(now);

    // Simple pattern matching
    if (dateStr.toLowerCase().includes('amanhã') || dateStr.toLowerCase().includes('tomorrow')) {
      date.setDate(date.getDate() + 1);
    } else if (dateStr.toLowerCase().includes('hoje') || dateStr.toLowerCase().includes('today')) {
      // Use today
    } else {
      // Try to parse as a date
      try {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          date = parsed;
        }
      } catch {
        // Keep current date
      }
    }

    // Parse time
    if (timeStr) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      if (!isNaN(hours)) {
        date.setHours(hours);
        date.setMinutes(minutes || 0);
      }
    } else {
      date.setHours(10, 0, 0, 0); // Default 10 AM
    }

    return date;
  }

  /**
   * Parse date range
   */
  private parseDateRange(dateStr: string): { startDate: Date; endDate: Date } {
    const now = new Date();
    let startDate = new Date(now);
    let endDate = new Date(now);

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    if (dateStr.includes('semana')) {
      // This week
      startDate.setDate(startDate.getDate() - startDate.getDay());
      endDate.setDate(startDate.getDate() + 6);
    } else if (dateStr.includes('mês')) {
      // This month
      startDate.setDate(1);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0);
    }

    return { startDate, endDate };
  }

  /**
   * Get user timezone (defaults to PT-BR)
   */
  private getUserTimezone(): string {
    return process.env.USER_TIMEZONE || 'America/Sao_Paulo';
  }

  /**
   * Format date/time for display
   */
  private formatDateTime(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: this.getUserTimezone(),
    };

    return new Intl.DateTimeFormat('pt-BR', options).format(date);
  }
}
