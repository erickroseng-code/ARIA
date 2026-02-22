/**
 * MeetingSummaryService: Gera resumos de reuniões usando Claude Haiku
 * Integra-se com MeetingCompletionDetector para processar eventos de reunião concluída
 */

import Anthropic from '@anthropic-ai/sdk';

export interface SummaryBulletPoint {
  category: 'participant' | 'decision' | 'action_item' | 'next_step' | 'discussion';
  content: string;
}

export interface MeetingSummary {
  meetingTitle: string;
  meetingDate: Date;
  participants: string[];
  bulletPoints: SummaryBulletPoint[];
  rawSummary: string;
  generatedAt: Date;
  processedIn: number; // milliseconds
}

export class MeetingSummaryService {
  private client: Anthropic;
  private model: string = 'claude-3-5-haiku-20241022';

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Generate summary from meeting notes/transcript
   */
  async summarizeMeeting(
    meetingTitle: string,
    meetingNotes: string,
    participants: string[] = [],
    timeoutMs: number = 180000 // 3 minutes
  ): Promise<MeetingSummary> {
    const startTime = Date.now();

    try {
      const summary = await Promise.race([
        this.generateSummary(meetingTitle, meetingNotes, participants),
        this.createTimeout(timeoutMs),
      ]) as string;

      const processedIn = Date.now() - startTime;

      // Parse Claude response into structured bullet points
      const bulletPoints = this.parseSummaryResponse(summary);

      return {
        meetingTitle,
        meetingDate: new Date(),
        participants,
        bulletPoints,
        rawSummary: summary,
        generatedAt: new Date(),
        processedIn,
      };
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw new Error(`Meeting summarization timeout after ${timeoutMs}ms`);
      }
      throw new Error(`Failed to summarize meeting: ${(error as Error).message}`);
    }
  }

  /**
   * Generate summary using Claude Haiku API
   */
  private async generateSummary(
    meetingTitle: string,
    meetingNotes: string,
    participants: string[]
  ): Promise<string> {
    const systemPrompt = `Você é um assistente expert em resumir reuniões de forma concisa e estruturada.
Seu objetivo é extrair os pontos-chave de uma transcrição ou notas de reunião.

Gere um resumo com os seguintes elementos:
- **Participantes**: Lista de quem estava na reunião
- **Decisões**: Decisões tomadas durante a reunião
- **Itens de Ação**: Ações/tarefas atribuídas com prazos
- **Próximos Passos**: Passos planejados para o futuro
- **Discussões Principais**: Tópicos principais discutidos

Formato esperado:
Comece cada seção com um emoji e rótulo (ex: "🤝 Participantes:").
Use bullet points (-) para cada item.
Seja conciso: máximo 5-10 pontos por seção.
Use português brasileiro.`;

    const userPrompt = `Reunião: ${meetingTitle}
${participants.length > 0 ? `Participantes: ${participants.join(', ')}\n` : ''}

Transcrição/Notas da Reunião:
${meetingNotes}

Por favor, gere um resumo estruturado desta reunião.`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text;
    }

    throw new Error('Unexpected response format from Claude API');
  }

  /**
   * Parse Claude response into structured bullet points
   */
  private parseSummaryResponse(response: string): SummaryBulletPoint[] {
    const bulletPoints: SummaryBulletPoint[] = [];
    const lines = response.split('\n');

    let currentCategory: 'participant' | 'decision' | 'action_item' | 'next_step' | 'discussion' | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Detect section headers
      if (trimmed.includes('Participantes') || trimmed.includes('participantes')) {
        currentCategory = 'participant';
        continue;
      }
      if (trimmed.includes('Decisões') || trimmed.includes('decisões')) {
        currentCategory = 'decision';
        continue;
      }
      if (trimmed.includes('Ação') || trimmed.includes('ação') || trimmed.includes('Action')) {
        currentCategory = 'action_item';
        continue;
      }
      if (trimmed.includes('Próximos Passos') || trimmed.includes('próximos passos')) {
        currentCategory = 'next_step';
        continue;
      }
      if (trimmed.includes('Discussão') || trimmed.includes('discussão') || trimmed.includes('Discussion')) {
        currentCategory = 'discussion';
        continue;
      }

      // Parse bullet points
      if ((trimmed.startsWith('-') || trimmed.startsWith('•')) && currentCategory) {
        const content = trimmed.substring(1).trim();
        if (content.length > 0) {
          bulletPoints.push({
            category: currentCategory,
            content,
          });
        }
      }
    }

    // Fallback: if no structured parsing worked, create a generic summary
    if (bulletPoints.length === 0) {
      bulletPoints.push({
        category: 'discussion',
        content: response.substring(0, 200),
      });
    }

    return bulletPoints;
  }

  /**
   * Format summary as markdown for Notion storage
   */
  formatSummaryAsMarkdown(summary: MeetingSummary): string {
    let markdown = `# 📋 ${summary.meetingTitle}\n\n`;
    markdown += `**Data:** ${summary.meetingDate.toLocaleDateString('pt-BR')}\n`;

    if (summary.participants.length > 0) {
      markdown += `**Participantes:** ${summary.participants.join(', ')}\n\n`;
    }

    // Group by category
    const byCategory: Record<string, SummaryBulletPoint[]> = {};
    for (const point of summary.bulletPoints) {
      if (!byCategory[point.category]) {
        byCategory[point.category] = [];
      }
      byCategory[point.category].push(point);
    }

    const categoryLabels: Record<string, string> = {
      participant: '🤝 Participantes',
      decision: '✅ Decisões',
      action_item: '📌 Itens de Ação',
      next_step: '🚀 Próximos Passos',
      discussion: '💬 Discussões',
    };

    for (const [category, points] of Object.entries(byCategory)) {
      const label = categoryLabels[category] || category;
      markdown += `## ${label}\n`;
      for (const point of points) {
        markdown += `- ${point.content}\n`;
      }
      markdown += '\n';
    }

    return markdown;
  }

  /**
   * Validate meeting notes before processing
   */
  validateMeetingNotes(notes: string): { valid: boolean; error?: string } {
    if (!notes || notes.trim().length === 0) {
      return { valid: false, error: 'Meeting notes cannot be empty' };
    }

    if (notes.length > 50000) {
      return { valid: false, error: 'Meeting notes exceed maximum length (50KB)' };
    }

    return { valid: true };
  }

  /**
   * Create a timeout promise
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new TimeoutError(`Operation timeout after ${ms}ms`)), ms);
    });
  }
}

class TimeoutError extends Error {
  name = 'TimeoutError';
}
