/**
 * PriorityExtractor: Extract task priority from keywords and context
 */

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export class PriorityExtractor {
  private readonly urgentKeywords = [
    'urgente',
    'asap',
    'logo',
    'imediatamente',
    'prioridade',
    'crítico',
    'emergência',
  ];

  private readonly highKeywords = ['hoje', 'agora', 'importante', 'prioritário', 'amanhã'];

  private readonly lowKeywords = [
    'quando tiver tempo',
    'sem pressa',
    'não é urgente',
    'depois',
    'eventualmente',
  ];

  /**
   * Extract priority from text
   */
  extractPriority(text: string): Priority {
    const normalizedText = text.toLowerCase();

    // Check for urgent keywords
    if (this.urgentKeywords.some((keyword) => normalizedText.includes(keyword))) {
      return 'urgent';
    }

    // Check for high priority keywords
    if (this.highKeywords.some((keyword) => normalizedText.includes(keyword))) {
      return 'high';
    }

    // Check for low priority keywords
    if (this.lowKeywords.some((keyword) => normalizedText.includes(keyword))) {
      return 'low';
    }

    // Default to medium
    return 'medium';
  }

  /**
   * Get priority from extracted keywords or null
   */
  getPriorityFromKeywords(keywords: string[]): Priority | null {
    const text = keywords.join(' ').toLowerCase();

    if (this.urgentKeywords.some((kw) => text.includes(kw))) {
      return 'urgent';
    }

    if (this.highKeywords.some((kw) => text.includes(kw))) {
      return 'high';
    }

    if (this.lowKeywords.some((kw) => text.includes(kw))) {
      return 'low';
    }

    return null;
  }

  /**
   * Get human-readable priority label
   */
  getPriorityLabel(priority: Priority): string {
    const labels: Record<Priority, string> = {
      low: '🟢 Baixa',
      medium: '🟡 Média',
      high: '🟠 Alta',
      urgent: '🔴 Urgente',
    };
    return labels[priority];
  }

  /**
   * Map priority to numeric score (1-4)
   */
  getPriorityScore(priority: Priority): number {
    const scores: Record<Priority, number> = {
      low: 1,
      medium: 2,
      high: 3,
      urgent: 4,
    };
    return scores[priority];
  }
}
