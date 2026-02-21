import type { TaskIntent } from './TaskIntentParser';

export interface AmbiguityCheckResult {
  hasAmbiguity: boolean;
  missingFields: string[]; // Which fields are missing or ambiguous
  confirmationNeeded: boolean; // Whether user confirmation is required
  confirmationMessage?: string; // Message to show user for confirmation
  clarificationMessage?: string; // Message asking for clarification if needed
}

/**
 * AmbiguityResolver - Detect and handle ambiguous task intents
 * Generates confirmation messages for user validation before task creation
 */
export class AmbiguityResolver {
  /**
   * Check if a parsed intent has ambiguities that need user confirmation
   */
  checkAmbiguity(intent: TaskIntent): AmbiguityCheckResult {
    const missingFields: string[] = [];

    // Check for missing or ambiguous fields
    if (!intent.title) {
      missingFields.push('título (tarefa)');
    }

    if (!intent.dueDateRelative && !intent.dueDate) {
      missingFields.push('data/hora');
    }

    if (!intent.destination) {
      missingFields.push('destino (ClickUp/Notion/ambos)');
    }

    if (!intent.clientName && !intent.clientId) {
      // Client is optional but noted if missing
      if (intent.ambiguityReason?.includes('cliente')) {
        missingFields.push('cliente');
      }
    }

    // Check if completeness is marked as ambiguous or incomplete
    const needsConfirmation =
      intent.completeness !== 'complete' || missingFields.length > 0;

    return {
      hasAmbiguity: missingFields.length > 0,
      missingFields,
      confirmationNeeded: needsConfirmation,
      confirmationMessage: this.generateConfirmationMessage(intent),
      clarificationMessage: this.generateClarificationMessage(intent, missingFields),
    };
  }

  /**
   * Generate a confirmation message to show the user before creating the task
   */
  private generateConfirmationMessage(intent: TaskIntent): string {
    const parts: string[] = [];

    // Start with indication
    parts.push('📋 **Confirmação de Tarefa:**\n');

    // Title
    if (intent.title) {
      parts.push(`✅ **Tarefa:** ${intent.title}`);
    } else {
      parts.push(`❌ **Tarefa:** (não especificada)`);
    }

    // Date/Time
    if (intent.dueDateRelative || intent.dueDate) {
      const dateDisplay = intent.dueDateRelative || this.formatDate(intent.dueDate);
      parts.push(`✅ **Quando:** ${dateDisplay}`);
    } else {
      parts.push(`⚠️ **Quando:** (não especificado)`);
    }

    // Client
    if (intent.clientName) {
      parts.push(`✅ **Cliente:** ${intent.clientName}`);
    } else if (!intent.clientId) {
      parts.push(`⚠️ **Cliente:** (não especificado)`);
    }

    // Destination
    if (intent.destination) {
      const destDisplay = this.formatDestination(intent.destination);
      parts.push(`✅ **Onde:** ${destDisplay}`);
    } else {
      parts.push(`⚠️ **Onde:** (não especificado)`);
    }

    // Priority
    if (intent.priority) {
      const priorityDisplay = this.formatPriority(intent.priority);
      parts.push(`**Prioridade:** ${priorityDisplay}`);
    }

    parts.push('\n**Confirma essas informações?** (Responda: sim/não ou "corrige [campo]")');

    return parts.join('\n');
  }

  /**
   * Generate a clarification message for missing fields
   */
  private generateClarificationMessage(intent: TaskIntent, missingFields: string[]): string {
    if (missingFields.length === 0) {
      return '';
    }

    const parts: string[] = [];
    parts.push('❓ **Preciso de mais informações:**\n');

    for (const field of missingFields) {
      parts.push(`- ${field}`);
    }

    parts.push('\nPor favor, forneça os dados faltantes para que eu possa criar a tarefa.');

    return parts.join('\n');
  }

  /**
   * Validate user confirmation response
   */
  validateConfirmationResponse(response: string): {
    isValid: boolean;
    confirmed: boolean | null; // null if needs clarification
    clarification?: string; // If user wants to fix something
  } {
    const lowerResponse = response.toLowerCase().trim();

    // Affirmative responses
    if (['sim', 'yes', 's', 'ok', 'tá bom', 'certo', 'correto'].includes(lowerResponse)) {
      return {
        isValid: true,
        confirmed: true,
      };
    }

    // Negative responses
    if (['não', 'no', 'n', 'nope', 'nega'].includes(lowerResponse)) {
      return {
        isValid: true,
        confirmed: false,
      };
    }

    // Correction/clarification requests
    if (
      lowerResponse.includes('corrige') ||
      lowerResponse.includes('muda') ||
      lowerResponse.includes('altera') ||
      lowerResponse.includes('o título') ||
      lowerResponse.includes('a data') ||
      lowerResponse.includes('o cliente') ||
      lowerResponse.includes('o destino')
    ) {
      // Extract what needs to be corrected
      const correction = response.replace(/^(corrige|muda|altera)\s+/i, '');
      return {
        isValid: true,
        confirmed: null,
        clarification: correction,
      };
    }

    // Invalid response
    return {
      isValid: false,
      confirmed: null,
    };
  }

  /**
   * Generate a response when user says "no" or wants to correct
   */
  generateRejectionMessage(): string {
    return 'Entendi. Vamos tentar novamente.\n\n📝 **Qual é o comando corrigido?** (Descreva a tarefa novamente)';
  }

  /**
   * Generate a response when confirmation is accepted
   */
  generateAcceptanceMessage(): string {
    return '✅ Perfeito! Vou criar a tarefa agora...';
  }

  /**
   * Generate an error message for invalid response
   */
  generateInvalidResponseMessage(): string {
    return '❌ Desculpa, não entendi sua resposta. Pode confirmar com "sim" ou "não"?';
  }

  /**
   * Helper to format date for display
   */
  private formatDate(date: Date | undefined): string {
    if (!date) return 'não especificada';

    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(date);
  }

  /**
   * Helper to format destination for display
   */
  private formatDestination(destination: string): string {
    const map: Record<string, string> = {
      clickup: '📌 ClickUp',
      notion: '📄 Notion',
      both: '📌 ClickUp + 📄 Notion (ambos)',
    };

    return map[destination] || destination;
  }

  /**
   * Helper to format priority for display
   */
  private formatPriority(priority: string): string {
    const map: Record<string, string> = {
      low: '🟢 Baixa (quando tiver tempo)',
      medium: '🟡 Normal',
      high: '🟠 Alta (urgente)',
      urgent: '🔴 Crítica (ASAP)',
    };

    return map[priority] || priority;
  }
}

// Singleton instance
let ambiguityResolver: AmbiguityResolver | null = null;

export function getAmbiguityResolver(): AmbiguityResolver {
  if (!ambiguityResolver) {
    ambiguityResolver = new AmbiguityResolver();
  }
  return ambiguityResolver;
}
