import { describe, it, expect, beforeEach } from 'vitest';
import { PriorityExtractor, getPriorityExtractor, type PriorityExtractionResult } from '../priority-extractor';

describe('PriorityExtractor', () => {
  let extractor: PriorityExtractor;

  beforeEach(() => {
    extractor = new PriorityExtractor();
  });

  describe('extractPriority - Urgent Level', () => {
    it('should detect urgent from "ASAP"', () => {
      const result = extractor.extractPriority('ASAP! Fazer isso agora');

      expect(result.priority).toBe('urgent');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should detect urgent from multiple urgent indicators', () => {
      const result = extractor.extractPriority('Urgente ASAP hoje mesmo!!');

      expect(result.priority).toBe('urgent');
      expect(result.confidence).toBeGreaterThan(0.85);
    });

    it('should detect urgent from "crítico"', () => {
      const result = extractor.extractPriority('Tarefa crítica');

      expect(result.priority).toBe('urgent');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should detect urgent from "immediately"', () => {
      const result = extractor.extractPriority('Fazer imediatamente');

      expect(result.priority).toBe('urgent');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should detect urgent from "emergência"', () => {
      const result = extractor.extractPriority('Emergência! Ligar agora');

      expect(result.priority).toBe('urgent');
      expect(result.confidence).toBeGreaterThan(0.9);
    });
  });

  describe('extractPriority - High Priority', () => {
    it('should detect high from single urgent indicator', () => {
      const result = extractor.extractPriority('Tarefa urgente');

      expect(result.priority).toBe('high');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should detect high from "hoje" (today)', () => {
      const result = extractor.extractPriority('Fazer hoje');

      expect(result.priority).toBe('high');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should detect high from "importante"', () => {
      const result = extractor.extractPriority('Tarefa importante');

      expect(result.priority).toBe('high');
    });

    it('should detect high from "próxima semana"', () => {
      const result = extractor.extractPriority('Fazer próxima semana');

      expect(result.priority).toBe('high');
    });

    it('should detect high from "rápido"', () => {
      const result = extractor.extractPriority('Preciso rápido');

      expect(result.priority).toBe('high');
    });
  });

  describe('extractPriority - Low Priority', () => {
    it('should detect low from "quando tiver tempo"', () => {
      const result = extractor.extractPriority('Fazer quando tiver tempo');

      expect(result.priority).toBe('low');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should detect low from "sem pressa"', () => {
      const result = extractor.extractPriority('Isso sem pressa');

      expect(result.priority).toBe('low');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should detect low from "próximo mês"', () => {
      const result = extractor.extractPriority('Fazer próximo mês');

      expect(result.priority).toBe('low');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should detect low from "pode esperar"', () => {
      const result = extractor.extractPriority('Isso pode esperar');

      expect(result.priority).toBe('low');
    });

    it('should detect low from "no rush"', () => {
      const result = extractor.extractPriority('Sem urgência, no rush');

      expect(result.priority).toBe('low');
    });

    it('should detect low from "deixa pra depois"', () => {
      const result = extractor.extractPriority('Deixa pra depois');

      expect(result.priority).toBe('low');
    });
  });

  describe('extractPriority - Medium/Default Priority', () => {
    it('should return medium for neutral text', () => {
      const result = extractor.extractPriority('Fazer uma tarefa');

      expect(result.priority).toBe('medium');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should return medium for simple task description', () => {
      const result = extractor.extractPriority('Enviar email para João');

      expect(result.priority).toBe('medium');
    });

    it('should return medium with low confidence for generic text', () => {
      const result = extractor.extractPriority('Qualquer coisa');

      expect(result.priority).toBe('medium');
      expect(result.confidence).toBeLessThanOrEqual(0.5);
    });
  });

  describe('extractPriority - Edge Cases', () => {
    it('should handle empty string', () => {
      const result = extractor.extractPriority('');

      expect(result.priority).toBe('medium');
      expect(result.confidence).toBe(0);
    });

    it('should handle null input', () => {
      const result = extractor.extractPriority(null as any);

      expect(result.priority).toBe('medium');
      expect(result.confidence).toBe(0);
    });

    it('should handle case-insensitive matching', () => {
      const result1 = extractor.extractPriority('ASAP');
      const result2 = extractor.extractPriority('asap');
      const result3 = extractor.extractPriority('Asap');

      expect(result1.priority).toBe(result2.priority);
      expect(result2.priority).toBe(result3.priority);
      expect(result1.priority).toBe('urgent');
    });

    it('should ignore partial matches', () => {
      const result = extractor.extractPriority('Discussão sobre urgentia');

      // Should not match "urgente" in "urgentia"
      expect(result.priority).not.toBe('urgent');
    });
  });

  describe('overridePriority', () => {
    it('should override to low', () => {
      const result = extractor.overridePriority('baixa');

      expect(result).toBe('low');
    });

    it('should override to medium', () => {
      const result1 = extractor.overridePriority('normal');
      const result2 = extractor.overridePriority('média');

      expect(result1).toBe('medium');
      expect(result2).toBe('medium');
    });

    it('should override to high', () => {
      const result = extractor.overridePriority('alta');

      expect(result).toBe('high');
    });

    it('should override to urgent', () => {
      const result1 = extractor.overridePriority('urgente');
      const result2 = extractor.overridePriority('crítica');

      expect(result1).toBe('urgent');
      expect(result2).toBe('urgent');
    });

    it('should return null for unrecognized input', () => {
      const result = extractor.overridePriority('invalid priority');

      expect(result).toBeNull();
    });

    it('should be case-insensitive', () => {
      const result1 = extractor.overridePriority('ALTA');
      const result2 = extractor.overridePriority('Alta');
      const result3 = extractor.overridePriority('alta');

      expect(result1).toBe('high');
      expect(result2).toBe('high');
      expect(result3).toBe('high');
    });

    it('should handle whitespace', () => {
      const result = extractor.overridePriority('  urgente  ');

      expect(result).toBe('urgent');
    });
  });

  describe('getPriorityOptions', () => {
    it('should return all four priority levels', () => {
      const options = extractor.getPriorityOptions();

      expect(options).toHaveLength(4);
      expect(options.map((o) => o.level)).toEqual(['low', 'medium', 'high', 'urgent']);
    });

    it('should include labels for each option', () => {
      const options = extractor.getPriorityOptions();

      options.forEach((option) => {
        expect(option.label).toBeDefined();
        expect(option.label.length).toBeGreaterThan(0);
      });
    });

    it('should include emojis for each option', () => {
      const options = extractor.getPriorityOptions();

      options.forEach((option) => {
        expect(option.emoji).toBeDefined();
        expect(['🟢', '🟡', '🟠', '🔴']).toContain(option.emoji);
      });
    });
  });

  describe('formatPriority', () => {
    it('should format low priority', () => {
      const result = extractor.formatPriority('low');

      expect(result).toContain('🟢');
      expect(result).toContain('Baixa');
    });

    it('should format medium priority', () => {
      const result = extractor.formatPriority('medium');

      expect(result).toContain('🟡');
      expect(result).toContain('Normal');
    });

    it('should format high priority', () => {
      const result = extractor.formatPriority('high');

      expect(result).toContain('🟠');
      expect(result).toContain('Alta');
    });

    it('should format urgent priority', () => {
      const result = extractor.formatPriority('urgent');

      expect(result).toContain('🔴');
      expect(result).toContain('Crítica');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const extractor1 = getPriorityExtractor();
      const extractor2 = getPriorityExtractor();

      expect(extractor1).toBe(extractor2);
    });
  });

  describe('Integration - Real Examples', () => {
    it('should handle realistic urgent task', () => {
      const result = extractor.extractPriority(
        'Ligar para cliente ASAP - chamada de emergência urgente!'
      );

      expect(result.priority).toBe('urgent');
      expect(result.confidence).toBeGreaterThan(0.85);
      expect(result.reason).toBeDefined();
    });

    it('should handle realistic low priority task', () => {
      const result = extractor.extractPriority(
        'Quando tiver tempo, pode organizar a documentação. Sem pressa.'
      );

      expect(result.priority).toBe('low');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should handle realistic medium priority task', () => {
      const result = extractor.extractPriority('Preparar relatório para a próxima semana');

      expect(result.priority).toBe('high'); // "próxima semana" triggers high
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it('should allow user override in confirmation flow', () => {
      // Auto-detection
      const auto = extractor.extractPriority('Fazer algo');
      expect(auto.priority).toBe('medium');

      // User override
      const override = extractor.overridePriority('alta');
      expect(override).toBe('high');

      // Format for display
      const formatted = extractor.formatPriority(override!);
      expect(formatted).toContain('Alta');
    });
  });
});
