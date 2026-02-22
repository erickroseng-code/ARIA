import { describe, it, expect, beforeEach } from 'vitest';
import { DateParser } from '../date-parser';

describe('DateParser', () => {
  let parser: DateParser;

  beforeEach(() => {
    parser = new DateParser();
  });

  describe('parseAmanha', () => {
    it('should parse "amanhã" as tomorrow', () => {
      const result = parser.parse('amanhã');
      expect(result).not.toBeNull();
      expect(result?.isRelative).toBe(true);
      expect(result?.originalText).toBe('amanhã');

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(result?.date.toDateString()).toBe(tomorrow.toDateString());
    });

    it('should parse "AMANHÃ" (uppercase)', () => {
      const result = parser.parse('AMANHÃ');
      expect(result).not.toBeNull();
      expect(result?.originalText).toBe('amanhã');
    });
  });

  describe('parseHoje', () => {
    it('should parse "hoje" as today', () => {
      const result = parser.parse('hoje');
      expect(result).not.toBeNull();
      expect(result?.isRelative).toBe(true);

      const today = new Date();
      expect(result?.date.toDateString()).toBe(today.toDateString());
    });
  });

  describe('parseDayOfWeek', () => {
    it('should parse day of week - "segunda"', () => {
      const result = parser.parse('segunda');
      expect(result).not.toBeNull();
      expect(result?.date.getDay()).toBe(1); // Monday
    });

    it('should parse day of week - "sexta"', () => {
      const result = parser.parse('sexta');
      expect(result).not.toBeNull();
      expect(result?.date.getDay()).toBe(5); // Friday
    });

    it('should parse all days of week', () => {
      const days = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
      days.forEach((day, index) => {
        const result = parser.parse(day);
        expect(result).not.toBeNull();
        if (result) {
          expect(result.date.getDay()).toBe(index);
        }
      });
    });

    it('should return next occurrence of day if today is that day', () => {
      const today = new Date();
      const dayName = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][
        today.getDay()
      ];

      const result = parser.parse(dayName);
      expect(result).not.toBeNull();
      expect(result?.date.getTime()).toBeGreaterThan(today.getTime());
    });
  });

  describe('parseNextWeek', () => {
    it('should parse "próxima segunda"', () => {
      const result = parser.parse('próxima segunda');
      expect(result).not.toBeNull();
      expect(result?.originalText).toBe('próxima segunda');
      expect(result?.date.getDay()).toBe(1);
    });

    it('should parse "próxima sexta"', () => {
      const result = parser.parse('próxima sexta');
      expect(result).not.toBeNull();
      expect(result?.date.getDay()).toBe(5);
    });

    it('should be at least 7 days in future', () => {
      const result = parser.parse('próxima segunda');
      const today = new Date();
      const daysInFuture = (result!.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysInFuture).toBeGreaterThanOrEqual(6); // At least 7 days
    });

    it('should parse with "próximo" instead of "próxima"', () => {
      const result = parser.parse('próximo domingo');
      expect(result).not.toBeNull();
      expect(result?.date.getDay()).toBe(0);
    });
  });

  describe('parseInDays', () => {
    it('should parse "em 2 dias"', () => {
      const result = parser.parse('em 2 dias');
      expect(result).not.toBeNull();
      expect(result?.originalText).toBe('em 2 dias');

      const target = new Date();
      target.setDate(target.getDate() + 2);
      expect(result?.date.toDateString()).toBe(target.toDateString());
    });

    it('should parse "em 5 dias"', () => {
      const result = parser.parse('em 5 dias');
      expect(result).not.toBeNull();

      const target = new Date();
      target.setDate(target.getDate() + 5);
      expect(result?.date.toDateString()).toBe(target.toDateString());
    });

    it('should parse "em uma semana"', () => {
      const result = parser.parse('em uma semana');
      expect(result).not.toBeNull();

      const target = new Date();
      target.setDate(target.getDate() + 7);
      expect(result?.date.toDateString()).toBe(target.toDateString());
    });

    it('should parse "em um mês"', () => {
      const result = parser.parse('em um mês');
      expect(result).not.toBeNull();

      const target = new Date();
      target.setMonth(target.getMonth() + 1);
      expect(result?.date.toDateString()).toBe(target.toDateString());
    });
  });

  describe('parseAbsoluteDate', () => {
    it('should parse "15 de março"', () => {
      const result = parser.parse('15 de março');
      expect(result).not.toBeNull();
      expect(result?.isRelative).toBe(false);
      expect(result?.date.getDate()).toBe(15);
      expect(result?.date.getMonth()).toBe(2); // March (0-indexed)
    });

    it('should parse "25 de dezembro de 2025"', () => {
      const result = parser.parse('25 de dezembro de 2025');
      expect(result).not.toBeNull();
      expect(result?.date.getDate()).toBe(25);
      expect(result?.date.getMonth()).toBe(11); // December
      expect(result?.date.getFullYear()).toBe(2025);
    });

    it('should parse date with slash format "25/12/2025"', () => {
      const result = parser.parse('25/12/2025');
      expect(result).not.toBeNull();
      expect(result?.date.getDate()).toBe(25);
      expect(result?.date.getMonth()).toBe(11); // December
      expect(result?.date.getFullYear()).toBe(2025);
    });

    it('should parse date with slash format without year "25/12"', () => {
      const result = parser.parse('25/12');
      expect(result).not.toBeNull();
      expect(result?.date.getDate()).toBe(25);
      expect(result?.date.getMonth()).toBe(11); // December
    });
  });

  describe('parseTime', () => {
    it('should extract time "14:00"', () => {
      const result = parser.parse('amanhã 14:00');
      expect(result).not.toBeNull();
      expect(result?.hasTime).toBe(true);
      expect(result?.time).toBe('14:00');
      expect(result?.date.getHours()).toBe(14);
      expect(result?.date.getMinutes()).toBe(0);
    });

    it('should extract time "09:30"', () => {
      const result = parser.parse('sexta 09:30');
      expect(result).not.toBeNull();
      expect(result?.time).toBe('09:30');
      expect(result?.date.getHours()).toBe(9);
      expect(result?.date.getMinutes()).toBe(30);
    });

    it('should work with relative dates and time', () => {
      const result = parser.parse('amanhã 18:45');
      expect(result).not.toBeNull();
      expect(result?.originalText).toBe('amanhã');
      expect(result?.date.getHours()).toBe(18);
      expect(result?.date.getMinutes()).toBe(45);
    });

    it('should work with absolute dates and time', () => {
      const result = parser.parse('15 de março 10:00');
      expect(result).not.toBeNull();
      expect(result?.date.getDate()).toBe(15);
      expect(result?.date.getHours()).toBe(10);
    });
  });

  describe('invalid inputs', () => {
    it('should return null for unrecognizable date', () => {
      const result = parser.parse('data aleatória');
      expect(result).toBeNull();
    });

    it('should return null for invalid month', () => {
      const result = parser.parse('32 de janeiro'); // 32nd doesn't exist
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle text with extra spaces', () => {
      const result = parser.parse('   amanhã   ');
      expect(result).not.toBeNull();
      expect(result?.originalText).toBe('amanhã');
    });

    it('should handle mixed case', () => {
      const result = parser.parse('AmAnHã');
      expect(result).not.toBeNull();
    });

    it('should handle compound phrases', () => {
      const result = parser.parse('próxima segunda 14:30');
      expect(result).not.toBeNull();
      expect(result?.date.getDay()).toBe(1);
      expect(result?.date.getHours()).toBe(14);
    });
  });
});
