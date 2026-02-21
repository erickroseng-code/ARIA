import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskIntentParser, getTaskIntentParser } from '../TaskIntentParser';

describe('TaskIntentParser', () => {
  let parser: TaskIntentParser;
  let mockClaude: any;
  let mockMessagesCreate: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMessagesCreate = vi.fn();
    mockClaude = {
      messages: {
        create: mockMessagesCreate,
      },
    };
    parser = new TaskIntentParser(mockClaude);
  });

  describe('parseTaskIntent - Complete Tasks', () => {
    it('should parse complete task with title, date, and destination', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              title: 'Ligar para cliente',
              dueDateRelative: 'amanhã',
              clientName: null,
              priority: 'medium',
              destination: 'clickup',
              completeness: 'complete',
              ambiguityReason: null,
              clarificationNeeded: null,
            }),
          },
        ],
      });

      const result = await parser.parseTaskIntent('cria tarefa ligar pra cliente amanhã no clickup');

      expect(result.intent.title).toBe('Ligar para cliente');
      expect(result.intent.dueDateRelative).toBe('amanhã');
      expect(result.intent.destination).toBe('clickup');
      expect(result.intent.completeness).toBe('complete');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.requiresConfirmation).toBeFalsy();
    });

    it('should extract priority from keywords', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              title: 'Tarefa urgente',
              dueDateRelative: 'hoje',
              clientName: null,
              priority: 'high',
              destination: 'notion',
              completeness: 'complete',
              ambiguityReason: null,
              clarificationNeeded: null,
            }),
          },
        ],
      });

      const result = await parser.parseTaskIntent('urgente! fazer coisa hoje no notion');

      expect(result.intent.priority).toBe('high');
      expect(result.preview).toContain('🟠');
    });

    it('should extract client name', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              title: 'Enviar proposta',
              dueDateRelative: 'sexta',
              clientName: 'Empresa XYZ',
              priority: 'medium',
              destination: 'both',
              completeness: 'complete',
              ambiguityReason: null,
              clarificationNeeded: null,
            }),
          },
        ],
      });

      const result = await parser.parseTaskIntent('enviar proposta pra Empresa XYZ sexta em ambos');

      expect(result.intent.clientName).toBe('Empresa XYZ');
      expect(result.preview).toContain('Empresa XYZ');
    });
  });

  describe('parseTaskIntent - Ambiguous Tasks', () => {
    it('should detect missing destination', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              title: 'Fazer proposta',
              dueDateRelative: 'amanhã',
              clientName: null,
              priority: 'medium',
              destination: null,
              completeness: 'ambiguous',
              ambiguityReason: 'Faltam informações: destino',
              clarificationNeeded: 'Criar no ClickUp, Notion ou ambos?',
            }),
          },
        ],
      });

      const result = await parser.parseTaskIntent('fazer proposta amanhã');

      expect(result.intent.completeness).toBe('ambiguous');
      expect(result.requiresConfirmation).toBeTruthy();
      expect(result.intent.clarificationNeeded).toBeTruthy();
      expect(result.confidence).toBeLessThan(0.8);
    });

    it('should detect missing date', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              title: 'Ligar para cliente',
              dueDateRelative: null,
              clientName: null,
              priority: 'medium',
              destination: 'clickup',
              completeness: 'ambiguous',
              ambiguityReason: 'Data não especificada',
              clarificationNeeded: 'Quando precisa fazer isso?',
            }),
          },
        ],
      });

      const result = await parser.parseTaskIntent('ligar pra cliente no clickup');

      expect(result.intent.dueDateRelative).toBeUndefined();
      expect(result.intent.completeness).toBe('ambiguous');
      expect(result.intent.clarificationNeeded).toContain('Quando');
    });
  });

  describe('parseTaskIntent - Incomplete Tasks', () => {
    it('should detect missing title', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              title: null,
              dueDateRelative: 'amanhã',
              clientName: null,
              priority: 'medium',
              destination: null,
              completeness: 'incomplete',
              ambiguityReason: 'Sem título de tarefa',
              clarificationNeeded: 'Qual é a tarefa?',
            }),
          },
        ],
      });

      const result = await parser.parseTaskIntent('amanhã');

      expect(result.intent.title).toBeUndefined();
      expect(result.intent.completeness).toBe('incomplete');
      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  describe('parseTaskIntent - Date Parsing', () => {
    it('should handle relative dates', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              title: 'Tarefa teste',
              dueDateRelative: 'próxima segunda',
              clientName: null,
              priority: 'medium',
              destination: 'clickup',
              completeness: 'complete',
              ambiguityReason: null,
              clarificationNeeded: null,
            }),
          },
        ],
      });

      const result = await parser.parseTaskIntent('fazer tarefa próxima segunda no clickup');

      expect(result.intent.dueDateRelative).toBe('próxima segunda');
      expect(result.preview).toContain('próxima segunda');
    });

    it('should handle time-based dates', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              title: 'Reunião',
              dueDateRelative: '14:00',
              clientName: null,
              priority: 'high',
              destination: 'both',
              completeness: 'complete',
              ambiguityReason: null,
              clarificationNeeded: null,
            }),
          },
        ],
      });

      const result = await parser.parseTaskIntent('reunião às 14:00 em ambos');

      expect(result.intent.dueDateRelative).toBe('14:00');
    });
  });

  describe('parseTaskIntent - Priority Extraction', () => {
    it('should detect low priority', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              title: 'Tarefa normal',
              dueDateRelative: 'quando tiver tempo',
              clientName: null,
              priority: 'low',
              destination: 'clickup',
              completeness: 'complete',
              ambiguityReason: null,
              clarificationNeeded: null,
            }),
          },
        ],
      });

      const result = await parser.parseTaskIntent('fazer coisa quando tiver tempo no clickup');

      expect(result.intent.priority).toBe('low');
      expect(result.preview).toContain('🟢');
    });

    it('should detect urgent priority', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              title: 'URGENTE',
              dueDateRelative: 'hoje',
              clientName: null,
              priority: 'urgent',
              destination: 'both',
              completeness: 'complete',
              ambiguityReason: null,
              clarificationNeeded: null,
            }),
          },
        ],
      });

      const result = await parser.parseTaskIntent('ASAP! fazer tudo hoje em ambos');

      expect(result.intent.priority).toBe('urgent');
      expect(result.preview).toContain('🔴');
    });
  });

  describe('parseTaskIntent - Input Validation', () => {
    it('should reject empty input', async () => {
      const result = await parser.parseTaskIntent('');

      expect(result.intent.completeness).toBe('incomplete');
      expect(result.confidence).toBe(0);
      expect(result.preview).toContain('Invalid input');
    });

    it('should reject input exceeding 1000 characters', async () => {
      const longText = 'a'.repeat(1001);
      const result = await parser.parseTaskIntent(longText);

      expect(result.intent.completeness).toBe('incomplete');
      expect(result.confidence).toBe(0);
      expect(result.preview).toContain('Invalid input');
    });

    it('should reject suspicious patterns (injection prevention)', async () => {
      const result = await parser.parseTaskIntent('tarefa {{malicious}}');

      expect(result.intent.completeness).toBe('incomplete');
      expect(result.confidence).toBe(0);
      expect(result.preview).toContain('Invalid input');
    });
  });

  describe('parseTaskIntent - Fallback Parsing', () => {
    it('should fallback to pattern matching on Claude API error', async () => {
      mockMessagesCreate.mockRejectedValueOnce(new Error('API Error'));

      const result = await parser.parseTaskIntent('fazer relatório para Empresa XYZ amanhã');

      expect(result.intent.title).toBeDefined();
      expect(result.confidence).toBeLessThan(0.8);
      expect(result.intent.completeness).toBeTruthy();
    });

    it('should fallback on invalid JSON response', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: 'Invalid JSON {broken',
          },
        ],
      });

      const result = await parser.parseTaskIntent('fazer coisa no clickup');

      expect(result.intent.completeness).toBeTruthy();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('fallback should extract basic info from patterns', async () => {
      mockMessagesCreate.mockRejectedValueOnce(new Error('API Error'));

      const result = await parser.parseTaskIntent('cria tarefa ligar pra João segunda');

      expect(result.intent.title).toBeDefined();
      expect(result.intent.dueDateRelative).toBeDefined();
      expect(result.intent.completeness).toBeTruthy();
    });
  });

  describe('Preview Generation', () => {
    it('should generate complete preview', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              title: 'Ligar para cliente',
              dueDateRelative: 'sexta',
              clientName: 'Empresa X',
              priority: 'high',
              destination: 'clickup',
              completeness: 'complete',
              ambiguityReason: null,
              clarificationNeeded: null,
            }),
          },
        ],
      });

      const result = await parser.parseTaskIntent('ligar para Empresa X sexta urgente no clickup');

      expect(result.preview).toContain('Ligar para cliente');
      expect(result.preview).toContain('sexta');
      expect(result.preview).toContain('Empresa X');
      expect(result.preview).toContain('🟠'); // high priority emoji
    });

    it('should include clarification for ambiguous tasks', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              title: 'Fazer proposta',
              dueDateRelative: null,
              clientName: null,
              priority: 'medium',
              destination: null,
              completeness: 'ambiguous',
              ambiguityReason: 'Faltam: data e destino',
              clarificationNeeded: 'Qual é a data e o destino?',
            }),
          },
        ],
      });

      const result = await parser.parseTaskIntent('fazer proposta');

      expect(result.preview).toContain('❓');
      expect(result.preview).toContain('Qual é');
    });
  });
});
