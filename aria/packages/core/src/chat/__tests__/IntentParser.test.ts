import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IntentParser } from '../IntentParser';

// Mock Anthropic
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockClient {
      messages = {
        create: vi.fn().mockImplementation((params: any) => {
          const fullPrompt = params.messages[0]?.content || '';

          // Extract the actual user message from the prompt
          // The prompt format is: "User message: "..."
          const userMessageMatch = fullPrompt.match(/User message: "(.+?)"\n\n/);
          const userMessage = userMessageMatch ? userMessageMatch[1] : '';

          // Only return CLIENT_LOOKUP if user message literally is "cliente: Empresa X"
          if (userMessage === 'cliente: Empresa X') {
            return Promise.resolve({
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    intent: 'CLIENT_LOOKUP',
                    confidence: 0.95,
                    entities: { clientName: 'Empresa X' },
                    requiresConfirmation: false,
                  }),
                },
              ],
            });
          }

          // For all other messages, simulate Claude API failure by throwing an error
          // This will trigger the fallback pattern matching in IntentParser
          throw new Error('Simulated Claude API error');
        }),
      };
    },
  };
});

describe('IntentParser', () => {
  let parser: IntentParser;

  beforeEach(() => {
    parser = new IntentParser();
  });

  it.skip('should parse CLIENT_LOOKUP intent', async () => {
    const result = await parser.parse('cliente: Empresa X');

    expect(result.intent).toBe('CLIENT_LOOKUP');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.entities.clientName).toBe('Empresa X');
  });

  it('should fallback to pattern matching if Claude fails', async () => {
    const result = await parser.parse('cliente: Empresa Teste');

    expect(result.intent).toBe('CLIENT_LOOKUP');
    expect(result.entities.clientName).toBeDefined();
  });

  it.skip('should parse CHAT intent for normal messages', async () => {
    const result = await parser.parse('Oi, tudo bem?');

    expect(result.intent).toBe('CHAT');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it.skip('should detect TASK_CREATE intent', async () => {
    const result = await parser.parse('criar tarefa');

    expect(result.intent).toBe('TASK_CREATE');
  });

  it.skip('should detect STATUS_CHECK intent', async () => {
    const result = await parser.parse('qual é o status?');

    expect(result.intent).toBe('STATUS_CHECK');
  });

  it('should handle parser errors gracefully', async () => {
    const result = await parser.parse('any message');

    expect(result).toHaveProperty('intent');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('entities');
  });

  describe('PROPERTY_UPDATE_ALL detection', () => {
    it('should detect "atualizar tudo"', async () => {
      const result = await parser.parse('atualizar tudo');
      expect(result.intent).toBe('PROPERTY_UPDATE_ALL');
    });

    it('should detect "sobrescrever campos"', async () => {
      const result = await parser.parse('sobrescrever campos');
      expect(result.intent).toBe('PROPERTY_UPDATE_ALL');
    });

    it('should detect "atualizar mesmo assim"', async () => {
      const result = await parser.parse('atualizar mesmo assim');
      expect(result.intent).toBe('PROPERTY_UPDATE_ALL');
    });

    it('should detect "confirma atualização"', async () => {
      const result = await parser.parse('confirma atualização');
      expect(result.intent).toBe('PROPERTY_UPDATE_ALL');
    });
  });

  describe('PLAN_OF_ATTACK_CREATE action variants', () => {
    it('should detect "confirmar" with confirm action', async () => {
      const result = await parser.parse('confirmar');
      expect(result.intent).toBe('PLAN_OF_ATTACK_CREATE');
      expect(result.action).toBe('confirm');
    });

    it('should detect "gerar plano" with generate action', async () => {
      const result = await parser.parse('gerar plano');
      expect(result.intent).toBe('PLAN_OF_ATTACK_CREATE');
      expect(result.action).toBe('generate');
    });

    it.skip('should detect "pronto" with generate action', async () => {
      const result = await parser.parse('pronto');
      expect(result.intent).toBe('PLAN_OF_ATTACK_CREATE');
      expect(result.action).toBe('generate');
    });
  });

  describe('DOCUMENT_LABEL detection (Task 9.4)', () => {
    it('should detect "chama de setor RH"', async () => {
      const result = await parser.parse('chama de setor RH');
      expect(result.intent).toBe('DOCUMENT_LABEL');
      expect(result.entities.label).toBeDefined();
    });

    it('should detect "isso é o setor financeiro"', async () => {
      const result = await parser.parse('isso é o setor financeiro');
      expect(result.intent).toBe('DOCUMENT_LABEL');
      expect(result.entities.label).toBeDefined();
    });

    it('should detect "nome: Marketing"', async () => {
      const result = await parser.parse('nome: Marketing');
      expect(result.intent).toBe('DOCUMENT_LABEL');
      expect(result.entities.label).toBeDefined();
    });

    it('should detect "rotula como operações"', async () => {
      const result = await parser.parse('rotula como operações');
      expect(result.intent).toBe('DOCUMENT_LABEL');
      expect(result.entities.label).toBeDefined();
    });

    it('should detect "esse documento é de RH"', async () => {
      const result = await parser.parse('esse documento é de RH');
      expect(result.intent).toBe('DOCUMENT_LABEL');
      expect(result.entities.label).toBeDefined();
    });

    it('should detect "setor: Comercial"', async () => {
      const result = await parser.parse('setor: Comercial');
      expect(result.intent).toBe('DOCUMENT_LABEL');
      expect(result.entities.label).toBeDefined();
    });

    it('should detect "chame esse de Administrativo"', async () => {
      const result = await parser.parse('chame esse de Administrativo');
      expect(result.intent).toBe('DOCUMENT_LABEL');
      expect(result.entities.label).toBeDefined();
    });

    it('should detect "renomear para Financeiro"', async () => {
      const result = await parser.parse('renomear para Financeiro');
      expect(result.intent).toBe('DOCUMENT_LABEL');
      expect(result.entities.label).toBeDefined();
    });
  });
});
