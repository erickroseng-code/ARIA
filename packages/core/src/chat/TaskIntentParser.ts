import Anthropic from '@anthropic-ai/sdk';

export interface TaskIntent {
  title: string;
  dueDate?: Date;
  dueDateRelative?: string;
  clientName?: string;
  clientId?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  destination?: 'clickup' | 'notion' | 'both';
  completeness: 'complete' | 'ambiguous' | 'incomplete';
  ambiguityReason?: string;
  clarificationNeeded?: string;
}

export interface ParseResult {
  intent: TaskIntent;
  confidence: number;
  preview: string;
  requiresConfirmation: boolean;
}

const TASK_INTENT_EXTRACTION_PROMPT = `
Extraia informações de tarefa do texto abaixo.
Retorne JSON válido SEMPRE, mesmo se informação incompleta.

Texto: "{userText}"

JSON obrigatório:
{
  "title": "string ou null",
  "dueDateRelative": "amanhã|sexta|próxima segunda|em 2 dias|14:00|null",
  "clientName": "string ou null",
  "priority": "low|medium|high|urgent ou null",
  "destination": "clickup|notion|both ou null",
  "completeness": "complete|ambiguous|incomplete",
  "ambiguityReason": "string se ambiguous"
}

Regras:
- title: Ação clara (ex: "Ligar para cliente")
- Datas: Sempre relativas quando possível
- Cliente: Nome exato se mencionado
- Prioridade: Extrair de urgência explícita
- completeness: complete = tem título e data; ambiguous = falta contexto; incomplete = falta título
`;

export class TaskIntentParser {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  async parseTaskIntent(text: string): Promise<ParseResult> {
    // Input validation
    if (!text || typeof text !== 'string') {
      throw new Error('Input must be a non-empty string');
    }

    if (text.length > 1000) {
      throw new Error('Input text exceeds 1000 characters');
    }

    try {
      // Call Claude API for intent extraction
      const prompt = TASK_INTENT_EXTRACTION_PROMPT.replace('{userText}', text);

      const message = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // Parse response
      const responseText =
        message.content[0].type === 'text' ? message.content[0].text : '';

      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Construct TaskIntent
      const intent: TaskIntent = {
        title: parsed.title || '',
        dueDateRelative: parsed.dueDateRelative || undefined,
        clientName: parsed.clientName || undefined,
        priority: parsed.priority || 'medium',
        destination: parsed.destination || undefined,
        completeness: parsed.completeness || 'incomplete',
        ambiguityReason: parsed.ambiguityReason || undefined,
      };

      // Determine if confirmation is needed
      const requiresConfirmation =
        intent.completeness === 'ambiguous' ||
        intent.completeness === 'incomplete' ||
        !intent.destination;

      // Generate preview message
      const preview = this.generatePreview(intent);

      // Calculate confidence
      const confidence = this.calculateConfidence(intent);

      return {
        intent,
        confidence,
        preview,
        requiresConfirmation,
      };
    } catch (error) {
      // Fallback to pattern matching if Claude fails
      console.error('Claude API error:', error);
      return this.fallbackPatternMatching(text);
    }
  }

  private generatePreview(intent: TaskIntent): string {
    let preview = `Vou criar: *${intent.title}*`;

    if (intent.destination) {
      preview += ` no *${intent.destination}*`;
    }

    if (intent.clientName) {
      preview += ` para *${intent.clientName}*`;
    }

    if (intent.dueDateRelative) {
      preview += ` em *${intent.dueDateRelative}*`;
    }

    if (intent.priority && intent.priority !== 'medium') {
      preview += ` com prioridade *${intent.priority}*`;
    }

    return preview;
  }

  private calculateConfidence(intent: TaskIntent): number {
    let confidence = 0.5; // Base confidence

    if (intent.title) confidence += 0.2;
    if (intent.dueDateRelative) confidence += 0.15;
    if (intent.clientName) confidence += 0.1;
    if (intent.destination) confidence += 0.1;
    if (intent.priority) confidence += 0.05;

    // Reduce confidence for ambiguous/incomplete
    if (intent.completeness === 'incomplete') confidence *= 0.7;
    if (intent.completeness === 'ambiguous') confidence *= 0.85;

    return Math.min(confidence, 1);
  }

  private fallbackPatternMatching(text: string): ParseResult {
    // Basic pattern matching for common task creation phrases
    const intent: TaskIntent = {
      title: '',
      completeness: 'incomplete',
    };

    // Try to extract title
    const titleMatch = text.match(/(?:cria|criar|nova)\s+(?:tarefa\s+)?(.+?)(?:\s+para|\s+no|\s+em|$)/i);
    if (titleMatch) {
      intent.title = titleMatch[1].trim();
    }

    // Try to extract client
    const clientMatch = text.match(/(?:para|cliente)\s+(.+?)(?:\s+(?:amanhã|hoje|segunda|terça|quarta|quinta|sexta|sábado|domingo)|$)/i);
    if (clientMatch) {
      intent.clientName = clientMatch[1].trim();
    }

    // Try to extract date
    if (text.match(/amanhã/i)) {
      intent.dueDateRelative = 'amanhã';
    } else if (text.match(/(?:próxima\s+)?segunda/i)) {
      intent.dueDateRelative = 'próxima segunda';
    } else if (text.match(/(?:próxima\s+)?terça/i)) {
      intent.dueDateRelative = 'próxima terça';
    }

    // Try to extract destination
    if (text.match(/(?:no|em)\s+clickup/i)) {
      intent.destination = 'clickup';
    } else if (text.match(/(?:no|em)\s+notion/i)) {
      intent.destination = 'notion';
    }

    // Determine priority from keywords
    if (text.match(/(?:urgente|asap|logo|hoje)/i)) {
      intent.priority = 'high';
    } else if (text.match(/quando\s+tiver\s+tempo/i)) {
      intent.priority = 'low';
    } else {
      intent.priority = 'medium';
    }

    // Set completeness
    if (intent.title && intent.dueDateRelative) {
      intent.completeness = 'complete';
    } else if (intent.title) {
      intent.completeness = 'ambiguous';
      intent.ambiguityReason = 'Data não especificada';
    } else {
      intent.completeness = 'incomplete';
      intent.ambiguityReason = 'Título da tarefa não identificado';
    }

    const requiresConfirmation =
      intent.completeness !== 'complete' || !intent.destination;
    const preview = this.generatePreview(intent);
    const confidence = this.calculateConfidence(intent);

    return {
      intent,
      confidence,
      preview,
      requiresConfirmation,
    };
  }
}
