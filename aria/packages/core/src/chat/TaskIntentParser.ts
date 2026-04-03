import Anthropic from '@anthropic-ai/sdk';

export type PriorityLevel = 'low' | 'medium' | 'high' | 'urgent';
export type TaskDestination = 'notion';
export type CompletenessLevel = 'complete' | 'ambiguous' | 'incomplete';
export type TaskActionType = 'create' | 'update' | 'read';

export interface TaskIntent {
  // Action type
  actionType?: TaskActionType; // create | update | read (defaults to create)

  // For CREATE actions
  title?: string; // Required for complete tasks
  dueDate?: Date;
  dueDateRelative?: string; // "amanhã", "sexta", "próxima segunda", "em 2 dias", "14:00"
  clientName?: string; // Company name
  clientId?: string; // Notion page ID (if found)
  priority?: PriorityLevel; // low | medium | high | urgent
  destination?: TaskDestination; // notion

  // For UPDATE actions
  targetTaskName?: string; // Name of task to update
  targetTaskId?: string; // Task ID (if found)
  updateField?: string; // "status" | "priority" | "dueDate"
  updateValue?: string; // New value ("concluído", "high", "amanhã")

  completeness: CompletenessLevel; // complete | ambiguous | incomplete
  ambiguityReason?: string; // Why it's ambiguous
  clarificationNeeded?: string; // Question to ask user
  rawText: string; // Original input for reference
}

export interface ParseResult {
  intent: TaskIntent;
  confidence: number; // 0-1
  preview: string; // Human-readable preview
  requiresConfirmation: boolean;
}

const TASK_INTENT_EXTRACTION_PROMPT = `You are a task extraction expert. Extract task information from natural language input.

User input: "{userText}"

Return ONLY valid JSON (no other text) with this structure:
{
  "title": "string or null",
  "dueDateRelative": "amanhã|sexta|próxima segunda|em 2 dias|14:00|null",
  "clientName": "string or null",
  "priority": "low|medium|high|urgent|null",
  "destination": "notion|null",
  "completeness": "complete|ambiguous|incomplete",
  "ambiguityReason": "string if ambiguous or incomplete, null otherwise",
  "clarificationNeeded": "string if ambiguous/incomplete asking for clarification, null otherwise"
}

Rules:
1. title: Must be a clear action (e.g., "Ligar para cliente", "Enviar proposta")
   - If no clear action, set title to null and completeness to 'incomplete'
2. dueDate: ALWAYS relative when mentioned (e.g., "amanhã" not "2026-02-22")
3. clientName: Exact name if mentioned, null otherwise
4. priority:
   - "urgente", "ASAP", "logo", "hoje" → "high"
   - "quando tiver tempo", "sem pressa" → "low"
   - Default → "medium"
5. destination: Use "notion" when destination is specified or implied
6. completeness:
   - "complete" = has title AND (has date OR destination is clear)
   - "ambiguous" = has title but missing context (unclear date, no client for relation, ambiguous destination)
   - "incomplete" = missing title or critical info
7. For ambiguous: provide ambiguityReason and clarificationNeeded asking user

Examples:
- "cria tarefa ligar pra João segunda" → title: "Ligar para João", dueDate: "segunda", priority: "medium", completeness: "complete"
- "tem que fazer something today" → title: "Something", dueDate: "hoje", priority: "high", completeness: "complete"
- "quando tiver tempo me avisa" → title: null, completeness: "incomplete"
- "faz a proposta" → title: "Fazer proposta", dueDate: null, completeness: "ambiguous", clarificationNeeded: "Quando precisa dessa proposta?"`;

export class TaskIntentParser {
  private claude: any;

  constructor(claudeClient?: any) {
    this.claude = claudeClient || new Anthropic();
  }

  /**
   * Validate input to prevent injection and enforce length limits
   */
  private validateInput(text: string): { valid: boolean; error?: string } {
    if (!text || typeof text !== 'string') {
      return { valid: false, error: 'Input must be a non-empty string' };
    }

    if (text.length > 1000) {
      return { valid: false, error: 'Input exceeds 1000 character limit' };
    }

    // Basic injection prevention - check for suspicious patterns
    const suspiciousPatterns = ['{' + '{', '}}', '<%', '%>', '<?', '?>'];
    if (suspiciousPatterns.some((pattern) => text.includes(pattern))) {
      return { valid: false, error: 'Input contains suspicious patterns' };
    }

    return { valid: true };
  }

  /**
   * Parse task intent from natural language text
   */
  async parseTaskIntent(text: string): Promise<ParseResult> {
    // Validate input
    const validation = this.validateInput(text);
    if (!validation.valid) {
      return {
        intent: {
          completeness: 'incomplete',
          ambiguityReason: validation.error,
          clarificationNeeded: 'Invalid input format. Please try again.',
          rawText: text,
        },
        confidence: 0,
        preview: `❌ Invalid input: ${validation.error}`,
        requiresConfirmation: false,
      };
    }

    try {
      const prompt = TASK_INTENT_EXTRACTION_PROMPT.replace('{userText}', text);

      const response = await this.claude.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const firstContent = response.content?.[0];
      let content = '{}';
      if (
        firstContent &&
        'type' in firstContent &&
        firstContent.type === 'text' &&
        'text' in firstContent
      ) {
        const textBlock = firstContent as unknown as { text: string };
        content = textBlock.text;
      }

      try {
        const parsed = JSON.parse(content);
        return this.buildParseResult(parsed, text);
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError);
        // Fallback to pattern matching
        return this.fallbackParse(text);
      }
    } catch (error) {
      console.error('Claude API error:', error);
      // Fallback to pattern matching
      return this.fallbackParse(text);
    }
  }

  /**
   * Build structured parse result from Claude response
   */
  private buildParseResult(parsed: Record<string, any>, rawText: string): ParseResult {
    const intent: TaskIntent = {
      title: parsed.title || undefined,
      dueDateRelative: parsed.dueDateRelative || undefined,
      clientName: parsed.clientName || undefined,
      priority: parsed.priority as PriorityLevel | undefined,
      destination: parsed.destination === 'notion' ? 'notion' : undefined,
      completeness: (parsed.completeness || 'incomplete') as CompletenessLevel,
      ambiguityReason: parsed.ambiguityReason || undefined,
      clarificationNeeded: parsed.clarificationNeeded || undefined,
      rawText,
    };

    // Calculate confidence based on completeness
    let confidence = 1.0;
    if (intent.completeness === 'ambiguous') confidence = 0.7;
    if (intent.completeness === 'incomplete') confidence = 0.4;
    if (!intent.title) confidence = Math.max(0, confidence - 0.3);

    const preview = this.generatePreview(intent);
    const requiresConfirmation = intent.completeness !== 'complete';

    return {
      intent,
      confidence: Math.max(0, Math.min(1, confidence)),
      preview,
      requiresConfirmation,
    };
  }

  /**
   * Generate human-readable preview from task intent
   */
  private generatePreview(intent: TaskIntent): string {
    if (intent.completeness === 'incomplete' && !intent.title) {
      return `❓ Não entendi a tarefa. ${intent.clarificationNeeded || 'Qual é a ação que precisa fazer?'}`;
    }

    const parts: string[] = [];

    if (intent.completeness !== 'incomplete') {
      parts.push(`📝 **${intent.title || 'Tarefa sem título'}**`);
    }

    if (intent.dueDateRelative) {
      parts.push(`📅 ${intent.dueDateRelative}`);
    } else if (intent.completeness === 'ambiguous') {
      parts.push(`⏰ (sem data especificada)`);
    }

    if (intent.clientName) {
      parts.push(`👤 para ${intent.clientName}`);
    }

    if (intent.priority && intent.priority !== 'medium') {
      const priorityEmoji = {
        low: '🟢',
        high: '🟠',
        urgent: '🔴',
        medium: '',
      };
      parts.push(`${priorityEmoji[intent.priority]} ${intent.priority}`);
    }

    if (intent.destination) {
      parts.push(`→ ${intent.destination}`);
    }

    let preview = parts.join(' ');

    if (intent.completeness === 'ambiguous' && intent.clarificationNeeded) {
      preview += `\n\n❓ ${intent.clarificationNeeded}`;
    }

    return preview;
  }

  /**
   * Fallback pattern matching for when Claude API fails
   */
  private fallbackParse(text: string): ParseResult {
    const lowerText = text.toLowerCase();

    // Extract title (look for common action patterns)
    let title: string | undefined;
    const actionPatterns = [
      /(?:criar|fazer|preparar|enviar|ligar|telefonar|pedir|solicitar|cumprir|executar|entregar)\s+(?:uma?\s+)?(.+?)(?:\s+(?:pra|para|ao|em|no|na|quando|se)|$)/i,
      /^(.+?)\s+(?:pra|para|com|no|na|segunda|terça|quarta|quinta|sexta|sábado|domingo|amanhã|hoje|semana|mês)/i,
    ];

    for (const pattern of actionPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        title = match[1].trim();
        break;
      }
    }

    // Extract date
    let dueDateRelative: string | undefined;
    if (
      lowerText.includes('amanhã') ||
      lowerText.includes('tomorrow')
    ) {
      dueDateRelative = 'amanhã';
    } else if (
      lowerText.includes('segunda') ||
      lowerText.includes('monday')
    ) {
      dueDateRelative = 'segunda';
    } else if (lowerText.includes('sexta') || lowerText.includes('friday')) {
      dueDateRelative = 'sexta';
    } else if (lowerText.includes('hoje') || lowerText.includes('today')) {
      dueDateRelative = 'hoje';
    }

    // Extract client name
    let clientName: string | undefined;
    const clientPatterns = [
      /(?:pra|para)\s+(?:cliente\s+)?(.+?)(?:\s+(?:segunda|terça|quarta|quinta|sexta|sábado|domingo|amanhã|hoje|semana)|$)/i,
      /cliente\s+(.+?)(?:\s|$)/i,
    ];
    for (const pattern of clientPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        clientName = match[1].trim();
        break;
      }
    }

    // Extract priority
    let priority: PriorityLevel = 'medium';
    if (
      lowerText.includes('urgente') ||
      lowerText.includes('asap') ||
      lowerText.includes('logo') ||
      lowerText.includes('hoje')
    ) {
      priority = 'high';
    } else if (
      lowerText.includes('quando tiver tempo') ||
      lowerText.includes('sem pressa')
    ) {
      priority = 'low';
    }

    // Extract destination
    let destination: TaskDestination | undefined;
    if (lowerText.includes('notion')) {
      destination = 'notion';
    }

    // Determine completeness
    let completeness: CompletenessLevel = 'incomplete';
    let ambiguityReason: string | undefined;
    let clarificationNeeded: string | undefined;

    if (title && dueDateRelative) {
      completeness = 'complete';
    } else if (title) {
      completeness = 'ambiguous';
      const missing: string[] = [];
      if (!dueDateRelative) missing.push('data');
      ambiguityReason = `Faltam informações: ${missing.join(', ')}`;
      clarificationNeeded = missing.length > 0
        ? `Qual é ${missing.length === 1 ? 'o/a' : 'o/a'} ${missing.join(' e ')}?`
        : undefined;
    } else {
      completeness = 'incomplete';
      ambiguityReason = 'Não consegui extrair título da tarefa';
      clarificationNeeded = 'Qual é a tarefa que precisa fazer?';
    }

    const intent: TaskIntent = {
      title,
      dueDateRelative,
      clientName,
      priority,
      destination,
      completeness,
      ambiguityReason,
      clarificationNeeded,
      rawText: text,
    };

    // Calculate confidence
    let confidence = 0.5; // Fallback starts lower
    if (completeness === 'complete') confidence = 0.8;
    if (completeness === 'ambiguous') confidence = 0.6;

    const preview = this.generatePreview(intent);
    const requiresConfirmation = completeness !== 'complete';

    return {
      intent,
      confidence,
      preview,
      requiresConfirmation,
    };
  }

  /**
   * Detect if text is an UPDATE intent (e.g., "altere status de X para Y")
   */
  detectUpdateIntent(text: string): { isUpdate: boolean; taskName?: string; newStatus?: string } {
    const lower = text.toLowerCase();

    // Keywords that indicate UPDATE action
    const updateKeywords = ['altere', 'mude', 'atualize', 'change', 'update', 'modifique', 'troque'];
    const statusKeywords = ['status', 'situação', 'estado'];

    const isUpdate = updateKeywords.some(kw => lower.includes(kw)) &&
                     (statusKeywords.some(kw => lower.includes(kw)) ||
                      lower.includes('para ') ||
                      lower.includes('->'));

    if (!isUpdate) {
      return { isUpdate: false };
    }

    // Try to extract task name and new status
    // Patterns: "altere X para Y", "mude X para status Y", etc
    const patterns = [
      /(?:altere|mude|atualize|modifique)\s+(?:o status de\s+)?['\"]?([^'\"]+?)['\"]?\s+(?:para|de)\s+['\"]?([^'\"]+?)['\"]?$/i,
      /['\"]?([^'\"]+?)['\"]?\s+(?:para|->)\s+['\"]?([^'\"]+?)['\"]?$/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          isUpdate: true,
          taskName: match[1]?.trim(),
          newStatus: match[2]?.trim(),
        };
      }
    }

    return { isUpdate: true }; // No details extracted
  }
}

// Singleton instance
let taskIntentParser: TaskIntentParser | null = null;

export function getTaskIntentParser(): TaskIntentParser {
  if (!taskIntentParser) {
    taskIntentParser = new TaskIntentParser();
  }
  return taskIntentParser;
}
