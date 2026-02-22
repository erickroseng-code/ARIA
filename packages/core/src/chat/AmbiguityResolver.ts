import { TaskIntent } from './TaskIntentParser';

export interface AmbiguityQuestion {
  field: 'title' | 'date' | 'client' | 'destination' | 'priority';
  question: string;
  currentValue?: string;
  options?: string[];
  isRequired: boolean;
}

export class AmbiguityResolver {
  /**
   * Detect missing or ambiguous information in task intent
   */
  detectAmbiguities(intent: TaskIntent): AmbiguityQuestion[] {
    const questions: AmbiguityQuestion[] = [];

    // Missing title
    if (!intent.title || intent.title.trim().length === 0) {
      questions.push({
        field: 'title',
        question: 'Qual é o título da tarefa?',
        isRequired: true,
      });
    }

    // Missing or ambiguous date
    if (!intent.dueDateRelative && !intent.dueDate) {
      questions.push({
        field: 'date',
        question: 'Quando a tarefa deve ser concluída?',
        isRequired: false,
        options: ['Amanhã', 'Próxima semana', 'Sem prazo'],
      });
    }

    // Unclear client
    if (intent.completeness === 'ambiguous' && !intent.clientId && !intent.clientName) {
      questions.push({
        field: 'client',
        question: 'Para qual cliente? (deixe em branco se não aplicável)',
        isRequired: false,
      });
    }

    // Missing destination
    if (!intent.destination) {
      questions.push({
        field: 'destination',
        question: 'Onde devo criar a tarefa?',
        isRequired: true,
        options: ['ClickUp', 'Notion', 'Ambos'],
      });
    }

    return questions;
  }

  /**
   * Generate confirmation message with extracted info
   */
  generateConfirmation(intent: TaskIntent): string {
    let message = '✅ Vou criar:\n\n';

    // Build confirmation details
    const details: string[] = [];

    if (intent.title) {
      details.push(`📝 *Tarefa*: ${intent.title}`);
    }

    if (intent.clientName) {
      details.push(`🏢 *Cliente*: ${intent.clientName}`);
    }

    if (intent.dueDateRelative || intent.dueDate) {
      const dateStr = intent.dueDateRelative || intent.dueDate?.toLocaleDateString('pt-BR');
      details.push(`📅 *Vencimento*: ${dateStr}`);
    } else {
      details.push('📅 *Vencimento*: Sem prazo');
    }

    if (intent.destination) {
      details.push(`📌 *Local*: ${intent.destination}`);
    }

    if (intent.priority && intent.priority !== 'medium') {
      details.push(`⚡ *Prioridade*: ${intent.priority}`);
    }

    message += details.join('\n');
    message += '\n\nConfirma? (sim/não)';

    return message;
  }

  /**
   * Generate clarification question for ambiguous input
   */
  generateClarificationQuestion(intent: TaskIntent): string {
    const reasons = [];

    if (!intent.title || intent.title.trim().length === 0) {
      reasons.push('Não consegui identificar o título da tarefa');
    }

    if (!intent.dueDateRelative && !intent.dueDate) {
      reasons.push('A data não foi especificada');
    }

    if (!intent.destination) {
      reasons.push('O destino (ClickUp/Notion) não foi informado');
    }

    if (reasons.length === 0) {
      return 'Informações da tarefa confirmadas. Deseja prosseder?';
    }

    let message = '❓ Alguns detalhes estão incompletos:\n\n';
    message += reasons.map((r) => `• ${r}`).join('\n');
    message += '\n\nPoderia esclarecer?';

    return message;
  }

  /**
   * Build a resolution workflow for step-by-step clarification
   */
  buildResolutionWorkflow(intent: TaskIntent): {
    step: number;
    currentQuestion: AmbiguityQuestion | null;
    remainingQuestions: AmbiguityQuestion[];
  } {
    const questions = this.detectAmbiguities(intent);

    if (questions.length === 0) {
      return {
        step: 0,
        currentQuestion: null,
        remainingQuestions: [],
      };
    }

    return {
      step: 1,
      currentQuestion: questions[0],
      remainingQuestions: questions.slice(1),
    };
  }

  /**
   * Apply user clarifications to intent
   */
  applyClarification(
    intent: TaskIntent,
    field: string,
    value: string
  ): TaskIntent {
    const updated = { ...intent };

    switch (field) {
      case 'title':
        updated.title = value;
        break;
      case 'date':
        updated.dueDateRelative = value === 'Sem prazo' ? undefined : value;
        break;
      case 'client':
        updated.clientName = value || undefined;
        break;
      case 'destination':
        const destMap: Record<string, 'clickup' | 'notion' | 'both'> = {
          clickup: 'clickup',
          notion: 'notion',
          ambos: 'both',
        };
        updated.destination = destMap[value.toLowerCase()] as
          | 'clickup'
          | 'notion'
          | 'both'
          | undefined;
        break;
      case 'priority':
        updated.priority = value.toLowerCase() as
          | 'low'
          | 'medium'
          | 'high'
          | 'urgent'
          | undefined;
        break;
    }

    // Recalculate completeness
    if (
      updated.title &&
      (updated.dueDateRelative || updated.dueDate) &&
      updated.destination
    ) {
      updated.completeness = 'complete';
    } else if (updated.title && updated.destination) {
      updated.completeness = 'ambiguous';
    } else if (updated.title) {
      updated.completeness = 'incomplete';
    }

    return updated;
  }

  /**
   * Check if intent is ready for task creation
   */
  isReadyForCreation(intent: TaskIntent): boolean {
    return (
      intent.title &&
      intent.title.trim().length > 0 &&
      intent.destination !== undefined &&
      intent.completeness === 'complete'
    );
  }

  /**
   * Get user-friendly message about current intent status
   */
  getStatusMessage(intent: TaskIntent): string {
    switch (intent.completeness) {
      case 'complete':
        return '✅ Tarefa completa - pronto para criar';
      case 'ambiguous':
        return `⚠️ Alguns detalhes faltando: ${intent.ambiguityReason}`;
      case 'incomplete':
        return `❌ Informações insuficientes: ${intent.ambiguityReason}`;
      default:
        return 'Status desconhecido';
    }
  }
}
