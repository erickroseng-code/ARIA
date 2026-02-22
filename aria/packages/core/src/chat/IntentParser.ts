import Anthropic from '@anthropic-ai/sdk';

export interface ParsedCommand {
  intent:
    | 'CLIENT_LOOKUP'
    | 'CHAT'
    | 'TASK_CREATE'
    | 'STATUS_CHECK'
    | 'PLAN_OF_ATTACK_CREATE'
    | 'PROPERTY_UPDATE_ALL'
    | 'DOCUMENT_LABEL'
    | 'CALENDAR'
    | 'OTHER';
  confidence: number;
  action?: 'generate' | 'confirm' | 'create' | 'query' | 'cancel'; // For PLAN_OF_ATTACK_CREATE: 'generate' or 'confirm'; For CALENDAR: 'create', 'query', 'cancel'
  entities: {
    clientName?: string;
    taskTitle?: string;
    status?: string;
    documentLabel?: string; // For DOCUMENT_LABEL: new label for document
    label?: string; // Alias for documentLabel (for simpler access)
    documentIndex?: number; // For DOCUMENT_LABEL: which document (0-based, -1 for last)
    eventTitle?: string; // For CALENDAR: event title
    eventDate?: string; // For CALENDAR: date (relative or absolute)
    eventTime?: string; // For CALENDAR: time (e.g., "14:00", "2:30 PM")
    eventDuration?: number; // For CALENDAR: duration in minutes (default 60)
  };
  requiresConfirmation: boolean;
}

export class IntentParser {
  private claude: Anthropic;

  constructor() {
    this.claude = new Anthropic();
  }

  async parse(message: string): Promise<ParsedCommand> {
    try {
      const prompt = `Analyze the following user message and extract the intent and entities.

User message: "${message}"

Respond with a JSON object with the following structure:
{
  "intent": "CLIENT_LOOKUP" | "CHAT" | "TASK_CREATE" | "STATUS_CHECK" | "PLAN_OF_ATTACK_CREATE" | "PROPERTY_UPDATE_ALL" | "DOCUMENT_LABEL" | "CALENDAR" | "OTHER",
  "confidence": 0.0 to 1.0,
  "action": "generate" | "confirm" | "create" | "query" | "cancel" | null (generate/confirm for PLAN_OF_ATTACK_CREATE, create/query/cancel for CALENDAR),
  "entities": {
    "clientName": "string or null",
    "taskTitle": "string or null",
    "status": "string or null",
    "documentLabel": "string or null (for DOCUMENT_LABEL)",
    "documentIndex": "number or null (for DOCUMENT_LABEL, 0-based or -1 for last)",
    "eventTitle": "string or null (for CALENDAR)",
    "eventDate": "string or null (for CALENDAR, relative or absolute)",
    "eventTime": "string or null (for CALENDAR, e.g. '14:00')",
    "eventDuration": "number or null (for CALENDAR, minutes)"
  },
  "requiresConfirmation": boolean
}

Examples:
- "cliente: Empresa X" → intent: "CLIENT_LOOKUP", clientName: "Empresa X"
- "cliente Empresa X" → intent: "CLIENT_LOOKUP", clientName: "Empresa X"
- "abrir cliente X" → intent: "CLIENT_LOOKUP", clientName: "X"
- "criar tarefa X" → intent: "TASK_CREATE", taskTitle: "X"
- "qual é o status?" → intent: "STATUS_CHECK"
- "pronto" → intent: "PLAN_OF_ATTACK_CREATE", action: "generate"
- "gerar plano" → intent: "PLAN_OF_ATTACK_CREATE", action: "generate"
- "criar plano de ataque" → intent: "PLAN_OF_ATTACK_CREATE", action: "generate"
- "confirma" → intent: "PLAN_OF_ATTACK_CREATE", action: "confirm"
- "confirmar" → intent: "PLAN_OF_ATTACK_CREATE", action: "confirm"
- "pode criar" → intent: "PLAN_OF_ATTACK_CREATE", action: "confirm"
- "cria no notion" → intent: "PLAN_OF_ATTACK_CREATE", action: "confirm"
- "ok cria" → intent: "PLAN_OF_ATTACK_CREATE", action: "confirm"
- "atualizar tudo" → intent: "PROPERTY_UPDATE_ALL"
- "sobrescrever campos" → intent: "PROPERTY_UPDATE_ALL"
- "confirma atualização" → intent: "PROPERTY_UPDATE_ALL"
- "atualizar mesmo assim" → intent: "PROPERTY_UPDATE_ALL"
- "rótulo Novo Nome" → intent: "DOCUMENT_LABEL", documentLabel: "Novo Nome", documentIndex: -1
- "renomear para Relatório Financeiro" → intent: "DOCUMENT_LABEL", documentLabel: "Relatório Financeiro", documentIndex: -1
- "doc 1 é Comercial" → intent: "DOCUMENT_LABEL", documentLabel: "Comercial", documentIndex: 0
- "mudar nome do segundo para Marketing" → intent: "DOCUMENT_LABEL", documentLabel: "Marketing", documentIndex: 1
- "agenda reunião com Empresa X na quinta às 14h" → intent: "CALENDAR", action: "create", eventTitle: "Reunião com Empresa X", eventDate: "quinta", eventTime: "14:00"
- "o que tenho hoje?" → intent: "CALENDAR", action: "query", eventDate: "hoje"
- "quais reuniões tenho essa semana?" → intent: "CALENDAR", action: "query", eventDate: "semana que vem"
- "cancela reunião com Empresa X" → intent: "CALENDAR", action: "cancel", eventTitle: "Empresa X"
- "schedule meeting tomorrow at 3pm" → intent: "CALENDAR", action: "create", eventTitle: "meeting", eventDate: "tomorrow", eventTime: "15:00"
- "Oi, tudo bem?" → intent: "CHAT"

Respond ONLY with the JSON object, no additional text.`;

      const response = await this.claude.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const firstContent = response.content?.[0];
      let content = '{}';
      if (firstContent && 'type' in firstContent && firstContent.type === 'text' && 'text' in firstContent) {
        const textBlock = firstContent as unknown as { text: string };
        content = textBlock.text;
      }

      try {
        const parsed = JSON.parse(content);
        const result: ParsedCommand = {
          intent: parsed.intent || 'OTHER',
          confidence: Math.min(1, Math.max(0, parsed.confidence || 0)),
          entities: {
            clientName: parsed.entities?.clientName || undefined,
            taskTitle: parsed.entities?.taskTitle || undefined,
            status: parsed.entities?.status || undefined,
            documentLabel: parsed.entities?.documentLabel || undefined,
            documentIndex: parsed.entities?.documentIndex !== undefined ? parsed.entities.documentIndex : undefined,
            eventTitle: parsed.entities?.eventTitle || undefined,
            eventDate: parsed.entities?.eventDate || undefined,
            eventTime: parsed.entities?.eventTime || undefined,
            eventDuration: parsed.entities?.eventDuration || undefined,
          },
          requiresConfirmation: parsed.requiresConfirmation || false,
        };
        if (parsed.action) {
          result.action = parsed.action as 'generate' | 'confirm' | 'create' | 'query' | 'cancel';
        }
        return result;
      } catch {
        // Fallback: simple pattern matching if Claude response fails
        return this.fallbackParse(message);
      }
    } catch (error) {
      console.error('Error parsing intent:', error);
      return this.fallbackParse(message);
    }
  }

  private fallbackParse(message: string): ParsedCommand {
    const lowerMsg = message.toLowerCase();

    // CLIENT_LOOKUP patterns
    if (
      lowerMsg.includes('cliente:') ||
      lowerMsg.includes('cliente ') ||
      lowerMsg.includes('abrir cliente') ||
      lowerMsg.includes('trabalhar com')
    ) {
      const match = message.match(
        /cliente\s*[:＃]?\s*(.+?)(?:\.|$)/i
      );
      const clientName = match && match[1] ? match[1].trim() : 'Unknown';

      return {
        intent: 'CLIENT_LOOKUP',
        confidence: 0.8,
        entities: { clientName },
        requiresConfirmation: false,
      };
    }

    // TASK_CREATE patterns
    if (lowerMsg.includes('criar tarefa') || lowerMsg.includes('nova tarefa')) {
      return {
        intent: 'TASK_CREATE',
        confidence: 0.8,
        entities: {},
        requiresConfirmation: true,
      };
    }

    // STATUS_CHECK patterns
    if (
      lowerMsg.includes('status') ||
      lowerMsg.includes('qual é') ||
      lowerMsg.includes('como está')
    ) {
      return {
        intent: 'STATUS_CHECK',
        confidence: 0.7,
        entities: {},
        requiresConfirmation: false,
      };
    }

    // PROPERTY_UPDATE_ALL patterns (check before PLAN_OF_ATTACK_CREATE to avoid "confirma atualização" being caught by "confirma")
    if (
      lowerMsg.includes('atualizar tudo') ||
      lowerMsg.includes('sobrescrever') ||
      lowerMsg.includes('atualizar mesmo assim') ||
      lowerMsg.includes('confirma atualização')
    ) {
      return {
        intent: 'PROPERTY_UPDATE_ALL',
        confidence: 0.9,
        entities: {},
        requiresConfirmation: false,
      };
    }

    // PLAN_OF_ATTACK_CREATE patterns - distinguish between generate and confirm actions
    if (
      lowerMsg.includes('confirmar') ||
      lowerMsg.includes('confirma') ||
      lowerMsg.includes('sim') ||
      lowerMsg.includes('pode criar') ||
      lowerMsg.includes('cria no notion') ||
      lowerMsg.includes('ok cria') ||
      lowerMsg.includes('yes') ||
      lowerMsg.includes('vai')
    ) {
      return {
        intent: 'PLAN_OF_ATTACK_CREATE',
        confidence: 0.95,
        action: 'confirm',
        entities: {},
        requiresConfirmation: false,
      };
    }

    if (
      lowerMsg.includes('pronto') ||
      lowerMsg.includes('gerar plano') ||
      lowerMsg.includes('criar plano') ||
      lowerMsg.includes('plano de ataque') ||
      lowerMsg.includes('pode gerar') ||
      lowerMsg.includes('gera aí') ||
      lowerMsg.includes('análise')
    ) {
      return {
        intent: 'PLAN_OF_ATTACK_CREATE',
        confidence: 0.95,
        action: 'generate',
        entities: {},
        requiresConfirmation: false,
      };
    }

    // CALENDAR patterns (agenda, schedule, reunião, cancelar, o que tenho, etc)
    if (
      lowerMsg.includes('agenda') ||
      lowerMsg.includes('schedule') ||
      lowerMsg.includes('reunião') ||
      lowerMsg.includes('meeting') ||
      lowerMsg.includes('o que tenho') ||
      lowerMsg.includes('que tenho') ||
      lowerMsg.includes('minha agenda') ||
      lowerMsg.includes('cancelar reunião') ||
      lowerMsg.includes('cancel') ||
      lowerMsg.includes('agendar')
    ) {
      let eventTitle = '';
      let eventDate = '';
      let eventTime = '';
      let action: 'create' | 'query' | 'cancel' = 'create';

      // Determine action
      if (lowerMsg.includes('cancelar') || lowerMsg.includes('cancel')) {
        action = 'cancel';
      } else if (
        lowerMsg.includes('o que tenho') ||
        lowerMsg.includes('que tenho') ||
        lowerMsg.includes('quais reuniões')
      ) {
        action = 'query';
      }

      // Extract event title (text after "reunião com" or "meeting")
      let titleMatch = message.match(/reunião\s+(?:com\s+)?(.+?)(?:\s+(?:na|no|em|no dia|on)|\.|$)/i);
      if (!titleMatch) {
        titleMatch = message.match(/meeting\s+(.+?)(?:\s+(?:on|at)|\.|$)/i);
      }
      if (!titleMatch && action === 'cancel') {
        titleMatch = message.match(/(?:cancelar|cancel)\s+(?:reunião|meeting)?\s+(?:com\s+)?(.+?)(?:\.|$)/i);
      }
      if (titleMatch && titleMatch[1]) {
        eventTitle = titleMatch[1].trim();
      }

      // Extract date (relative: "hoje", "amanhã", "quinta", "próxima segunda", etc)
      let dateMatch = message.match(
        /(?:na|no|em|no dia|on|today|tomorrow|amanhã|hoje)\s+(.+?)(?:\s+(?:às|at)|\.|$)/i
      );
      if (!dateMatch) {
        dateMatch = message.match(/(?:hoje|amanhã|essa\s+semana|semana\s+que\s+vem|próxima|segunda|terça|quarta|quinta|sexta|tomorrow|next)/i);
        if (dateMatch) {
          eventDate = dateMatch[0];
        }
      }
      if (dateMatch && dateMatch[1]) {
        eventDate = dateMatch[1].trim();
      }

      // Extract time (e.g., "14h", "14:00", "2:30 PM", "3 PM")
      let timeMatch = message.match(/(?:às|at)\s+(\d{1,2}):?(\d{2})?\s*(?:h|pm|am)?/i);
      if (timeMatch) {
        const hour = timeMatch[1];
        const minute = timeMatch[2] || '00';
        eventTime = `${hour}:${minute}`;
      }

      return {
        intent: 'CALENDAR',
        confidence: 0.85,
        action,
        entities: {
          eventTitle: eventTitle || undefined,
          eventDate: eventDate || undefined,
          eventTime: eventTime || undefined,
        },
        requiresConfirmation: action === 'create',
      };
    }

    // DOCUMENT_LABEL patterns (rótulo, renomear, chama de, etc)
    if (
      lowerMsg.includes('rótulo') ||
      lowerMsg.includes('renomear') ||
      lowerMsg.includes('mudar nome') ||
      lowerMsg.includes('chama de') ||
      lowerMsg.includes('chame') ||
      lowerMsg.includes('rotula') ||
      lowerMsg.includes('nome:') ||
      lowerMsg.includes('setor:') ||
      (lowerMsg.includes('é') && (lowerMsg.includes('doc') || lowerMsg.includes('documento') || lowerMsg.includes('primeiro') || lowerMsg.includes('segundo') || lowerMsg.includes('terceiro') || lowerMsg.includes('quarto') || lowerMsg.includes('quinto') || lowerMsg.includes('isso')))
    ) {
      // Try to extract label (text after "é", "para", "de", ":", etc)
      let documentLabel = '';
      let documentIndex = -1; // Default to last document

      // Extract label from patterns - try in order of specificity
      let labelMatch = message.match(/rótulo\s+(.+?)(?:\.|$)/i);
      if (!labelMatch) {
        labelMatch = message.match(/renomear\s+para\s+(.+?)(?:\.|$)/i);
      }
      if (!labelMatch) {
        labelMatch = message.match(/mudar\s+nome\s+para\s+(.+?)(?:\.|$)/i);
      }
      if (!labelMatch) {
        labelMatch = message.match(/chama\s+de\s+(.+?)(?:\.|$)/i);
      }
      if (!labelMatch) {
        labelMatch = message.match(/chame\s+(?:esse\s+)?de\s+(.+?)(?:\.|$)/i);
      }
      if (!labelMatch) {
        labelMatch = message.match(/rotula\s+como\s+(.+?)(?:\.|$)/i);
      }
      if (!labelMatch) {
        labelMatch = message.match(/nome:\s*(.+?)(?:\.|$)/i);
      }
      if (!labelMatch) {
        labelMatch = message.match(/setor:\s*(.+?)(?:\.|$)/i);
      }
      if (!labelMatch) {
        labelMatch = message.match(/isso\s+é\s+(?:o\s+)?(?:setor\s+)?(.+?)(?:\.|$)/i);
      }
      if (!labelMatch) {
        labelMatch = message.match(/documento\s+é\s+(?:de\s+)?(.+?)(?:\.|$)/i);
      }
      if (!labelMatch) {
        labelMatch = message.match(/(?:é|é\s+de|para)\s+(.+?)(?:\.|$)/i);
      }
      if (labelMatch && labelMatch[1]) {
        documentLabel = labelMatch[1].trim();
      }

      // Extract document index if mentioned
      const indexMatch = message.match(/doc\s+(\d)/i);
      if (indexMatch && indexMatch[1]) {
        documentIndex = parseInt(indexMatch[1], 10) - 1; // Convert to 0-based
      }

      const entities: { documentLabel?: string; label?: string; documentIndex?: number } = {
        documentIndex: documentIndex >= 0 ? documentIndex : -1,
      };
      if (documentLabel) {
        entities.documentLabel = documentLabel;
        entities.label = documentLabel; // Alias for easier access
      }
      return {
        intent: 'DOCUMENT_LABEL',
        confidence: 0.8,
        entities,
        requiresConfirmation: false,
      };
    }

    // Default to CHAT
    return {
      intent: 'CHAT',
      confidence: 1.0,
      entities: {},
      requiresConfirmation: false,
    };
  }
}

// Singleton instance
let intentParser: IntentParser | null = null;

export function getIntentParser(): IntentParser {
  if (!intentParser) {
    intentParser = new IntentParser();
  }
  return intentParser;
}
