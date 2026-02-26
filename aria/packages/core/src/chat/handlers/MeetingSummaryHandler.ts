// @ts-nocheck
/**
 * MeetingSummaryHandler: Integra resumos de reunião com sistema de chat
 * Trata comandos relacionados a geração de resumos
 */

import { MeetingSummaryService } from '@aios-core/integrations/src/ai/MeetingSummaryService';
import { InputHandler } from '../documents/InputHandler';
import { MeetingCompletionDetector } from '@aios-core/integrations/src/google-calendar/MeetingCompletionDetector';
import { SummaryNotificationService } from '../notifications/SummaryNotificationService';
import type { ParsedCommand } from '../IntentParser';

export interface SummaryHandlerResponse {
  type: 'success' | 'error' | 'processing';
  message: string;
  summary?: any;
  notionUrl?: string;
}

export class MeetingSummaryHandler {
  private summaryService: MeetingSummaryService;
  private inputHandler: InputHandler;
  private notificationService: SummaryNotificationService;
  private activeGenerations: Map<string, Promise<any>> = new Map();

  constructor(
    private userId: string,
    private meetingDetector?: MeetingCompletionDetector,
    notificationService?: SummaryNotificationService
  ) {
    this.summaryService = new MeetingSummaryService();
    this.inputHandler = new InputHandler();
    this.notificationService = notificationService || new SummaryNotificationService();
  }

  /**
   * Handle summary-related intent
   */
  async handle(command: ParsedCommand): Promise<SummaryHandlerResponse> {
    try {
      switch (command.action) {
        case 'generate':
          return await this.handleGenerateSummary(command);
        case 'manual-trigger':
          return await this.handleManualTrigger(command);
        case 'status':
          return await this.handleSummaryStatus(command);
        default:
          return {
            type: 'error',
            message: `Ação de resumo não suportada: ${command.action}`,
          };
      }
    } catch (error) {
      return {
        type: 'error',
        message: `Erro ao processar resumo: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Handle summary generation from user input
   */
  private async handleGenerateSummary(
    command: ParsedCommand
  ): Promise<SummaryHandlerResponse> {
    // Extract meeting info and notes from command
    const meetingTitle = command.entities.meetingTitle || 'Reunião';
    const meetingNotes = command.entities.meetingNotes || '';
    const participants = command.entities.participants || [];

    // Validate notes
    const validation = this.inputHandler.validateAndCleanNotes(meetingNotes);
    if (!validation.valid) {
      return {
        type: 'error',
        message: `❌ ${validation.error}`,
      };
    }

    // Start async generation
    const generationPromise = this.generateAndNotify(
      meetingTitle,
      validation.cleaned,
      participants
    );

    // Store for tracking
    const generationId = `gen-${Date.now()}`;
    this.activeGenerations.set(generationId, generationPromise);

    // Clean up after completion
    generationPromise.finally(() => {
      this.activeGenerations.delete(generationId);
    });

    return {
      type: 'processing',
      message: `⏳ Gerando resumo de "${meetingTitle}"... Você receberá uma notificação quando estiver pronto.`,
    };
  }

  /**
   * Handle manual trigger via command
   */
  private async handleManualTrigger(
    command: ParsedCommand
  ): Promise<SummaryHandlerResponse> {
    const meetingTitle = command.entities.meetingTitle || 'Reunião';
    const meetingNotes = command.entities.meetingNotes;

    if (!meetingNotes) {
      return {
        type: 'error',
        message: '❌ Por favor, forneça as notas da reunião para gerar um resumo',
      };
    }

    // Validate and trigger via detector
    if (this.meetingDetector) {
      try {
        const completionEvent = await this.meetingDetector.manualTriggerSummarization(
          meetingTitle,
          meetingNotes
        );

        return {
          type: 'processing',
          message: `⏳ Gerando resumo para "${completionEvent.meeting.title}"...`,
        };
      } catch (error) {
        return {
          type: 'error',
          message: `Erro ao disparar geração: ${(error as Error).message}`,
        };
      }
    }

    return {
      type: 'error',
      message: 'Meeting detector não configurado',
    };
  }

  /**
   * Handle status query
   */
  private async handleSummaryStatus(
    command: ParsedCommand
  ): Promise<SummaryHandlerResponse> {
    const activeCount = this.activeGenerations.size;

    if (activeCount === 0) {
      return {
        type: 'success',
        message: '✅ Nenhuma geração de resumo em andamento',
      };
    }

    return {
      type: 'success',
      message: `⏳ ${activeCount} resumo(s) sendo gerado(s)...`,
    };
  }

  /**
   * Generate summary and notify user
   */
  private async generateAndNotify(
    meetingTitle: string,
    notes: string,
    participants: string[]
  ): Promise<void> {
    try {
      // Generate summary
      const summary = await this.summaryService.summarizeMeeting(
        meetingTitle,
        notes,
        participants
      );

      // Format for Notion
      const markdownContent = this.summaryService.formatSummaryAsMarkdown(summary);

      // In real implementation: store in Notion and get URL
      const notionUrl = `https://notion.so/summary-${Date.now()}`;

      // Notify user
      await this.notificationService.notifySummaryReady({
        userId: this.userId,
        meetingTitle,
        summaryUrl: notionUrl,
        channel: 'both', // Telegram + Web UI
        timestamp: new Date(),
      });

      console.log(`Summary generated and notification sent for meeting: ${meetingTitle}`);
    } catch (error) {
      console.error(`Failed to generate summary: ${error}`);

      // Notify user of failure
      await this.notificationService.notifySummaryReady({
        userId: this.userId,
        meetingTitle,
        summaryUrl: '#',
        channel: 'telegram', // Only notify about error via Telegram
        timestamp: new Date(),
      });
    }
  }

  /**
   * Get list of active generations
   */
  getActiveGenerations(): string[] {
    return Array.from(this.activeGenerations.keys());
  }

  /**
   * Cancel a specific generation
   */
  async cancelGeneration(generationId: string): Promise<boolean> {
    return this.activeGenerations.delete(generationId);
  }

  /**
   * Set up listener for meeting completion events
   */
  setupMeetingCompletionListener(): void {
    if (!this.meetingDetector) {
      console.log('Meeting detector not configured');
      return;
    }

    this.meetingDetector.onMeetingCompleted(async (event) => {
      console.log(`Meeting completed: ${event.meeting.title}`);

      // Check if there are notes attached to the meeting
      if (event.meeting.description) {
        // Auto-generate summary
        try {
          const summary = await this.summaryService.summarizeMeeting(
            event.meeting.title,
            event.meeting.description,
            event.meeting.participants
          );

          // Notify user
          await this.notificationService.notifySummaryReady({
            userId: this.userId,
            meetingTitle: event.meeting.title,
            summaryUrl: `https://notion.so/meeting-${event.meeting.eventId}`,
            channel: 'both',
            timestamp: new Date(),
          });
        } catch (error) {
          console.error(`Error auto-generating summary: ${error}`);
        }
      }
    });
  }
}
