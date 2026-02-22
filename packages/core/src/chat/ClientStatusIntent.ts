/**
 * ClientStatusIntent: Recognize and parse client status commands
 * Supports variations: "status do cliente X", "resumo da Empresa X", "quanto andou X"
 */

export interface StatusIntent {
  type: 'status';
  clientName: string;
  confidence: number;
}

const STATUS_PATTERNS = [
  /status\s+d[oa]\s+(.+?)(?:\?|$)/i,
  /resumo\s+d[oa]\s+(.+?)(?:\?|$)/i,
  /quanto\s+andou\s+(.+?)(?:\?|$)/i,
  /como\s+está\s+(.+?)(?:\?|$)/i,
  /progresso\s+d[oa]\s+(.+?)(?:\?|$)/i,
  /snapshot\s+(?:de\s+)?(.+?)(?:\?|$)/i,
];

export class ClientStatusIntent {
  /**
   * Detect if text contains a status command
   */
  detect(text: string): StatusIntent | null {
    const normalizedText = text.toLowerCase().trim();

    // Try each pattern
    for (const pattern of STATUS_PATTERNS) {
      const match = normalizedText.match(pattern);
      if (match && match[1]) {
        const clientName = match[1].trim();
        if (clientName.length > 0 && clientName.length < 100) {
          return {
            type: 'status',
            clientName,
            confidence: 0.9,
          };
        }
      }
    }

    return null;
  }

  /**
   * Format response message
   */
  formatResponse(clientName: string, statusMessage: string): string {
    return statusMessage;
  }

  /**
   * Format "not found" message with suggestions
   */
  formatNotFound(clientName: string, suggestions: string[]): string {
    let message = `❌ Cliente "${clientName}" não encontrado.\n\n`;

    if (suggestions.length > 0) {
      message += `📍 Clientes similares:\n`;
      suggestions.forEach((suggestion, idx) => {
        message += `${idx + 1}. ${suggestion}\n`;
      });
      message += `\nQual você quis dizer?`;
    } else {
      message += `Nenhum cliente encontrado com esse nome.`;
    }

    return message;
  }
}
