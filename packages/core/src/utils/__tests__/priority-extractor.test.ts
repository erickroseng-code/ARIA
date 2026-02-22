import { describe, it, expect, beforeEach } from 'vitest';
import { PriorityExtractor } from '../priority-extractor';

describe('PriorityExtractor', () => {
  let extractor: PriorityExtractor;

  beforeEach(() => {
    extractor = new PriorityExtractor();
  });

  describe('extractPriority', () => {
    it('should extract urgent priority', () => {
      expect(extractor.extractPriority('cria tarefa urgente')).toBe('urgent');
      expect(extractor.extractPriority('asap')).toBe('urgent');
      expect(extractor.extractPriority('crítico')).toBe('urgent');
    });

    it('should extract high priority', () => {
      expect(extractor.extractPriority('hoje')).toBe('high');
      expect(extractor.extractPriority('importante')).toBe('high');
    });

    it('should extract low priority', () => {
      expect(extractor.extractPriority('quando tiver tempo')).toBe('low');
      expect(extractor.extractPriority('sem pressa')).toBe('low');
    });

    it('should default to medium priority', () => {
      expect(extractor.extractPriority('tarefa normal')).toBe('medium');
    });

    it('should be case insensitive', () => {
      expect(extractor.extractPriority('URGENTE')).toBe('urgent');
    });
  });

  describe('getPriorityLabel', () => {
    it('should return correct labels', () => {
      expect(extractor.getPriorityLabel('low')).toContain('Baixa');
      expect(extractor.getPriorityLabel('medium')).toContain('Média');
      expect(extractor.getPriorityLabel('high')).toContain('Alta');
      expect(extractor.getPriorityLabel('urgent')).toContain('Urgente');
    });
  });

  describe('getPriorityScore', () => {
    it('should map priorities to scores', () => {
      expect(extractor.getPriorityScore('low')).toBe(1);
      expect(extractor.getPriorityScore('medium')).toBe(2);
      expect(extractor.getPriorityScore('high')).toBe(3);
      expect(extractor.getPriorityScore('urgent')).toBe(4);
    });
  });
});
