/**
 * DateParser: Parse relative and absolute dates from natural language
 * Supports: "amanhã", "sexta", "próxima segunda", "em 2 dias", times like "14:00"
 */

export interface ParsedDate {
  date: Date;
  isRelative: boolean;
  originalText: string;
  hasTime: boolean;
  time?: string;
}

export class DateParser {
  private readonly daysOfWeek: Record<string, number> = {
    domingo: 0,
    segunda: 1,
    terça: 2,
    quarta: 3,
    quinta: 4,
    sexta: 5,
    sábado: 6,
  };

  private readonly dayAbbreviations: Record<string, number> = {
    dom: 0,
    seg: 1,
    ter: 2,
    qua: 3,
    qui: 4,
    sex: 5,
    sab: 6,
  };

  private readonly monthNames: Record<string, number> = {
    janeiro: 1,
    fevereiro: 2,
    março: 3,
    abril: 4,
    maio: 5,
    junho: 6,
    julho: 7,
    agosto: 8,
    setembro: 9,
    outubro: 10,
    novembro: 11,
    dezembro: 12,
  };

  /**
   * Parse a relative date string
   * Supports: "amanhã", "sexta", "próxima segunda", "em 2 dias", "14:00"
   */
  parse(text: string): ParsedDate | null {
    const normalizedText = text.toLowerCase().trim();

    // Try to extract time first (HH:MM or similar)
    const timeMatch = normalizedText.match(/(\d{1,2}):(\d{2})/);
    const time = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : undefined;

    // Remove time from text for date parsing
    const textWithoutTime = normalizedText.replace(/\d{1,2}:\d{2}/g, '').trim();

    // Try different parsing strategies
    let result =
      this.parseAmanha(textWithoutTime) ||
      this.parseHoje(textWithoutTime) ||
      this.parseDayOfWeek(textWithoutTime) ||
      this.parseNextWeek(textWithoutTime) ||
      this.parseInDays(textWithoutTime) ||
      this.parseAbsoluteDate(textWithoutTime);

    if (result) {
      // Apply time if found
      if (time) {
        const [hours, minutes] = time.split(':').map(Number);
        result.date.setHours(hours, minutes, 0, 0);
        result.hasTime = true;
        result.time = time;
      }
      return result;
    }

    return null;
  }

  /**
   * Parse "amanhã" (tomorrow)
   */
  private parseAmanha(text: string): ParsedDate | null {
    if (!text.match(/\bamanhã\b/i)) {
      return null;
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    return {
      date: tomorrow,
      isRelative: true,
      originalText: 'amanhã',
      hasTime: false,
    };
  }

  /**
   * Parse "hoje" (today)
   */
  private parseHoje(text: string): ParsedDate | null {
    if (!text.match(/\bhoje\b/i)) {
      return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      date: today,
      isRelative: true,
      originalText: 'hoje',
      hasTime: false,
    };
  }

  /**
   * Parse day of week: "sexta", "segunda", etc.
   * Assumes next occurrence of that day
   */
  private parseDayOfWeek(text: string): ParsedDate | null {
    for (const [day, dayNum] of Object.entries(this.daysOfWeek)) {
      if (text.includes(day)) {
        const target = new Date();
        target.setHours(0, 0, 0, 0);

        const currentDay = target.getDay();
        let daysToAdd = dayNum - currentDay;

        // If the day has already passed this week, go to next week
        if (daysToAdd <= 0) {
          daysToAdd += 7;
        }

        target.setDate(target.getDate() + daysToAdd);

        return {
          date: target,
          isRelative: true,
          originalText: day,
          hasTime: false,
        };
      }
    }

    return null;
  }

  /**
   * Parse "próxima segunda", "próxima sexta", etc.
   */
  private parseNextWeek(text: string): ParsedDate | null {
    if (!text.match(/\bpróxima?\s+(segunda|terça|quarta|quinta|sexta|sábado|domingo)/i)) {
      return null;
    }

    for (const [day, dayNum] of Object.entries(this.daysOfWeek)) {
      if (text.includes(day)) {
        const target = new Date();
        target.setHours(0, 0, 0, 0);

        const currentDay = target.getDay();
        let daysToAdd = dayNum - currentDay;

        // Always add at least 7 days to ensure "próxima"
        if (daysToAdd < 1) {
          daysToAdd += 7;
        } else if (daysToAdd === 0) {
          daysToAdd = 7;
        } else {
          daysToAdd += 7;
        }

        target.setDate(target.getDate() + daysToAdd);

        return {
          date: target,
          isRelative: true,
          originalText: `próxima ${day}`,
          hasTime: false,
        };
      }
    }

    return null;
  }

  /**
   * Parse "em 2 dias", "em uma semana", etc.
   */
  private parseInDays(text: string): ParsedDate | null {
    const daysMatch = text.match(/em\s+(\d+)\s+dias/i);
    if (daysMatch) {
      const days = parseInt(daysMatch[1], 10);
      const target = new Date();
      target.setDate(target.getDate() + days);
      target.setHours(0, 0, 0, 0);

      return {
        date: target,
        isRelative: true,
        originalText: `em ${days} dias`,
        hasTime: false,
      };
    }

    // "em uma semana"
    if (text.match(/em\s+uma\s+semana/i)) {
      const target = new Date();
      target.setDate(target.getDate() + 7);
      target.setHours(0, 0, 0, 0);

      return {
        date: target,
        isRelative: true,
        originalText: 'em uma semana',
        hasTime: false,
      };
    }

    // "em um mês"
    if (text.match(/em\s+um\s+mês/i)) {
      const target = new Date();
      target.setMonth(target.getMonth() + 1);
      target.setHours(0, 0, 0, 0);

      return {
        date: target,
        isRelative: true,
        originalText: 'em um mês',
        hasTime: false,
      };
    }

    return null;
  }

  /**
   * Parse absolute dates: "15 de março", "25/12/2025", etc.
   */
  private parseAbsoluteDate(text: string): ParsedDate | null {
    // "15 de março" or "15 de março de 2025"
    const ptBrMatch = text.match(/(\d{1,2})\s+de\s+(\w+)(?:\s+de\s+(\d{4}))?/i);
    if (ptBrMatch) {
      const day = parseInt(ptBrMatch[1], 10);
      const monthName = ptBrMatch[2].toLowerCase();
      const year = ptBrMatch[3] ? parseInt(ptBrMatch[3], 10) : new Date().getFullYear();

      const month = this.monthNames[monthName];
      if (month) {
        const target = new Date(year, month - 1, day);
        target.setHours(0, 0, 0, 0);

        return {
          date: target,
          isRelative: false,
          originalText: ptBrMatch[0],
          hasTime: false,
        };
      }
    }

    // "25/12/2025" or "25/12"
    const slashMatch = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
    if (slashMatch) {
      const day = parseInt(slashMatch[1], 10);
      const month = parseInt(slashMatch[2], 10);
      const year = slashMatch[3] ? parseInt(slashMatch[3], 10) : new Date().getFullYear();

      const target = new Date(year, month - 1, day);
      target.setHours(0, 0, 0, 0);

      if (target.getMonth() === month - 1) {
        // Validate month
        return {
          date: target,
          isRelative: false,
          originalText: slashMatch[0],
          hasTime: false,
        };
      }
    }

    return null;
  }
}
