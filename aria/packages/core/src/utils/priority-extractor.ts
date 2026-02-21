export type PriorityLevel = 'low' | 'medium' | 'high' | 'urgent';

export interface PriorityExtractionResult {
  priority: PriorityLevel;
  reason?: string; // Why this priority was assigned
  confidence: number; // 0-1, how confident the extraction is
}

/**
 * PriorityExtractor - Extract priority from natural language
 * Analyzes keywords and context to determine task priority
 */
export class PriorityExtractor {
  /**
   * Extract priority from text
   * Returns the detected priority level and confidence score
   */
  extractPriority(text: string): PriorityExtractionResult {
    if (!text || typeof text !== 'string') {
      return {
        priority: 'medium',
        reason: 'No text provided, defaulting to medium',
        confidence: 0,
      };
    }

    const lowerText = text.toLowerCase();

    // Check for CRITICAL urgent indicators (these alone mean "urgent")
    const criticalUrgentPatterns = [
      /\basap\b|asap|crítico|crítica|critical|emergência|emergency|imediatamente|immediately|já/i,
    ];

    let hasCriticalUrgent = false;
    for (const pattern of criticalUrgentPatterns) {
      if (pattern.test(text)) {
        hasCriticalUrgent = true;
        break;
      }
    }

    if (hasCriticalUrgent) {
      return {
        priority: 'urgent',
        reason: 'Critical urgent indicator found (e.g., "ASAP", "crítico", "imediatamente")',
        confidence: 0.95,
      };
    }

    // Check for general urgent/high priority indicators
    const urgentPatterns = [
      /urgente|urgent|rápido|rápida|logo|now|hoje|today/i,
      /esta ?noite|tonight|esta ?semana|this week|próximas horas/i,
    ];

    let urgentMatches = 0;
    for (const pattern of urgentPatterns) {
      if (pattern.test(text)) {
        urgentMatches++;
      }
    }

    // Check for low priority indicators
    const lowPatterns = [
      /quando tiver tempo|whenever|no rush|sem pressa|não é pressa/i,
      /próximo\s+mês|next month|futuramente|eventually|sem urgência/i,
      /pode ser depois|can wait|pode esperar|deixa pra depois/i,
    ];

    let lowMatches = 0;
    for (const pattern of lowPatterns) {
      if (pattern.test(text)) {
        lowMatches++;
      }
    }

    // Determine priority based on matches
    if (urgentMatches >= 2) {
      return {
        priority: 'urgent',
        reason: 'Multiple urgent indicators found (e.g., "urgente", "hoje")',
        confidence: Math.min(1, 0.9 + urgentMatches * 0.05),
      };
    }

    if (urgentMatches === 1) {
      return {
        priority: 'high',
        reason: 'Urgent indicator found in text',
        confidence: 0.85,
      };
    }

    if (lowMatches >= 1) {
      return {
        priority: 'low',
        reason: 'Low priority indicators found (e.g., "quando tiver tempo", "sem pressa")',
        confidence: Math.min(1, 0.8 + lowMatches * 0.05),
      };
    }

    // Check for medium priority patterns
    const mediumPatterns = [
      /próxima\s+semana|next week|próximos dias|soon|em breve/i,
      /importante|important|relevante|relevant/i,
    ];

    for (const pattern of mediumPatterns) {
      if (pattern.test(text)) {
        return {
          priority: 'high',
          reason: 'Medium-to-high priority indicators (e.g., "próxima semana", "importante")',
          confidence: 0.7,
        };
      }
    }

    // Default to medium priority
    return {
      priority: 'medium',
      reason: 'No specific priority indicators, using default',
      confidence: 0.5,
    };
  }

  /**
   * Override priority if user explicitly specifies it
   * Useful for allowing user to set priority in confirmation step
   */
  overridePriority(userInput: string): PriorityLevel | null {
    const lower = userInput.toLowerCase().trim();

    // Map user inputs to priority levels
    const mapping: Record<string, PriorityLevel> = {
      'baixa': 'low',
      'low': 'low',
      'normal': 'medium',
      'medium': 'medium',
      'média': 'medium',
      'alta': 'high',
      'high': 'high',
      'urgente': 'urgent',
      'urgent': 'urgent',
      'crítica': 'urgent',
      'critical': 'urgent',
      'asap': 'urgent',
    };

    return mapping[lower] || null;
  }

  /**
   * Get all priority levels for user selection
   */
  getPriorityOptions(): { level: PriorityLevel; label: string; emoji: string }[] {
    return [
      {
        level: 'low',
        label: 'Baixa (quando tiver tempo)',
        emoji: '🟢',
      },
      {
        level: 'medium',
        label: 'Normal',
        emoji: '🟡',
      },
      {
        level: 'high',
        label: 'Alta (urgente)',
        emoji: '🟠',
      },
      {
        level: 'urgent',
        label: 'Crítica (ASAP)',
        emoji: '🔴',
      },
    ];
  }

  /**
   * Format priority for display
   */
  formatPriority(priority: PriorityLevel): string {
    const map: Record<PriorityLevel, string> = {
      low: '🟢 Baixa',
      medium: '🟡 Normal',
      high: '🟠 Alta',
      urgent: '🔴 Crítica',
    };

    return map[priority];
  }
}

// Singleton instance
let priorityExtractor: PriorityExtractor | null = null;

export function getPriorityExtractor(): PriorityExtractor {
  if (!priorityExtractor) {
    priorityExtractor = new PriorityExtractor();
  }
  return priorityExtractor;
}
