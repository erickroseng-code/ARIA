import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskIntentParser } from '../TaskIntentParser';

describe('TaskIntentParser', () => {
  let parser: TaskIntentParser;

  beforeEach(() => {
    parser = new TaskIntentParser('test-api-key');
  });

  describe('parseTaskIntent', () => {
    it('should throw error for empty input', async () => {
      await expect(parser.parseTaskIntent('')).rejects.toThrow(
        'Input must be a non-empty string'
      );
    });

    it('should throw error for input exceeding 1000 chars', async () => {
      const longText = 'a'.repeat(1001);
      await expect(parser.parseTaskIntent(longText)).rejects.toThrow(
        'Input text exceeds 1000 characters'
      );
    });

    it('should fallback to pattern matching on API error', async () => {
      // Mock API error by using fallback path
      const result = await parser.parseTaskIntent('cria tarefa ligar para cliente amanhã');
      expect(result.intent.title).toBe('ligar para cliente');
      expect(result.intent.dueDateRelative).toBe('amanhã');
      expect(result.intent.completeness).toBe('complete');
    });
  });

  describe('fallback pattern matching', () => {
    it('should extract title from "cria tarefa X"', async () => {
      const result = await parser.parseTaskIntent('cria tarefa ligar para cliente');
      expect(result.intent.title).toBe('ligar para cliente');
    });

    it('should extract client name', async () => {
      const result = await parser.parseTaskIntent('cria tarefa para Empresa XYZ');
      expect(result.intent.clientName).toBe('Empresa XYZ');
    });

    it('should detect relative dates - amanhã', async () => {
      const result = await parser.parseTaskIntent('cria tarefa amanhã');
      expect(result.intent.dueDateRelative).toBe('amanhã');
    });

    it('should detect relative dates - próxima segunda', async () => {
      const result = await parser.parseTaskIntent('cria tarefa próxima segunda');
      expect(result.intent.dueDateRelative).toBe('próxima segunda');
    });

    it('should detect destination - ClickUp', async () => {
      const result = await parser.parseTaskIntent('cria no clickup');
      expect(result.intent.destination).toBe('clickup');
    });

    it('should detect destination - Notion', async () => {
      const result = await parser.parseTaskIntent('cria em notion');
      expect(result.intent.destination).toBe('notion');
    });

    it('should extract high priority from keywords', async () => {
      const result = await parser.parseTaskIntent('cria tarefa urgente');
      expect(result.intent.priority).toBe('high');
    });

    it('should extract low priority', async () => {
      const result = await parser.parseTaskIntent('cria quando tiver tempo');
      expect(result.intent.priority).toBe('low');
    });

    it('should set completeness to complete with title and date', async () => {
      const result = await parser.parseTaskIntent('cria tarefa ligar amanhã');
      expect(result.intent.completeness).toBe('complete');
      expect(result.requiresConfirmation).toBe(false);
    });

    it('should set completeness to ambiguous with title only', async () => {
      const result = await parser.parseTaskIntent('cria tarefa ligar');
      expect(result.intent.completeness).toBe('ambiguous');
      expect(result.requiresConfirmation).toBe(true);
    });

    it('should require confirmation when destination not specified', async () => {
      const result = await parser.parseTaskIntent('cria tarefa ligar amanhã');
      expect(result.requiresConfirmation).toBe(true);
    });

    it('should generate preview message', async () => {
      const result = await parser.parseTaskIntent('cria tarefa ligar para Empresa X amanhã');
      expect(result.preview).toContain('ligar');
      expect(result.preview).toContain('Empresa X');
      expect(result.preview).toContain('amanhã');
    });

    it('should calculate confidence score', async () => {
      const result = await parser.parseTaskIntent('cria tarefa completa para cliente amanhã no clickup');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should handle complex input with all fields', async () => {
      const result = await parser.parseTaskIntent(
        'cria tarefa urgente para Empresa ABC amanhã no notion'
      );
      expect(result.intent.title).toBeTruthy();
      expect(result.intent.clientName).toBe('Empresa ABC');
      expect(result.intent.dueDateRelative).toBe('amanhã');
      expect(result.intent.destination).toBe('notion');
      expect(result.intent.priority).toBe('high');
    });
  });

  describe('generatePreview', () => {
    it('should generate preview with all fields', async () => {
      const result = await parser.parseTaskIntent(
        'cria tarefa fazer algo para cliente amanhã'
      );
      const preview = result.preview;
      expect(preview).toMatch(/fazer algo/);
      expect(preview).toMatch(/cliente/);
      expect(preview).toMatch(/amanhã/);
    });

    it('should not include priority if medium', async () => {
      const result = await parser.parseTaskIntent('cria tarefa fazer algo');
      expect(result.preview).not.toMatch(/medium/);
    });
  });

  describe('calculateConfidence', () => {
    it('should have higher confidence for complete information', async () => {
      const complete = await parser.parseTaskIntent('cria tarefa completa para cliente amanhã no notion');
      const incomplete = await parser.parseTaskIntent('cria');

      expect(complete.confidence).toBeGreaterThan(incomplete.confidence);
    });

    it('should reduce confidence for incomplete data', async () => {
      const result = await parser.parseTaskIntent('cria');
      expect(result.confidence).toBeLessThan(0.7);
    });
  });
});
