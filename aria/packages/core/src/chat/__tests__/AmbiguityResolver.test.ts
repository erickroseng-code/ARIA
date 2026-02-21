import { describe, it, expect, beforeEach } from 'vitest';
import { AmbiguityResolver, getAmbiguityResolver, type AmbiguityCheckResult } from '../AmbiguityResolver';
import type { TaskIntent } from '../TaskIntentParser';

describe('AmbiguityResolver', () => {
  let resolver: AmbiguityResolver;

  beforeEach(() => {
    resolver = new AmbiguityResolver();
  });

  describe('checkAmbiguity - Complete Tasks', () => {
    it('should detect no ambiguity for complete task', () => {
      const intent: TaskIntent = {
        title: 'Ligar para cliente',
        dueDateRelative: 'amanhã',
        destination: 'clickup',
        clientName: 'Empresa XYZ',
        priority: 'medium',
        completeness: 'complete',
        rawText: 'ligar para cliente amanhã no clickup',
      };

      const result = resolver.checkAmbiguity(intent);

      expect(result.hasAmbiguity).toBeFalsy();
      expect(result.missingFields).toHaveLength(0);
      expect(result.confirmationNeeded).toBeFalsy();
    });

    it('should detect no ambiguity for complete task without client', () => {
      const intent: TaskIntent = {
        title: 'Preparar apresentação',
        dueDateRelative: 'sexta',
        destination: 'both',
        priority: 'high',
        completeness: 'complete',
        rawText: 'preparar apresentação para sexta',
      };

      const result = resolver.checkAmbiguity(intent);

      expect(result.hasAmbiguity).toBeFalsy();
      expect(result.confirmationNeeded).toBeFalsy();
    });
  });

  describe('checkAmbiguity - Ambiguous Tasks', () => {
    it('should detect missing title', () => {
      const intent: TaskIntent = {
        dueDateRelative: 'amanhã',
        destination: 'clickup',
        completeness: 'incomplete',
        rawText: 'amanhã',
      };

      const result = resolver.checkAmbiguity(intent);

      expect(result.hasAmbiguity).toBeTruthy();
      expect(result.missingFields).toContain('título (tarefa)');
      expect(result.confirmationNeeded).toBeTruthy();
    });

    it('should detect missing date', () => {
      const intent: TaskIntent = {
        title: 'Ligar para cliente',
        destination: 'clickup',
        completeness: 'ambiguous',
        ambiguityReason: 'Data não especificada',
        rawText: 'ligar para cliente',
      };

      const result = resolver.checkAmbiguity(intent);

      expect(result.hasAmbiguity).toBeTruthy();
      expect(result.missingFields).toContain('data/hora');
      expect(result.confirmationNeeded).toBeTruthy();
    });

    it('should detect missing destination', () => {
      const intent: TaskIntent = {
        title: 'Fazer proposta',
        dueDateRelative: 'amanhã',
        completeness: 'ambiguous',
        ambiguityReason: 'Destino não especificado',
        rawText: 'fazer proposta amanhã',
      };

      const result = resolver.checkAmbiguity(intent);

      expect(result.hasAmbiguity).toBeTruthy();
      expect(result.missingFields).toContain('destino (ClickUp/Notion/ambos)');
      expect(result.confirmationNeeded).toBeTruthy();
    });

    it('should detect multiple missing fields', () => {
      const intent: TaskIntent = {
        title: 'Enviar email',
        completeness: 'ambiguous',
        ambiguityReason: 'Faltam: data e destino',
        rawText: 'enviar email',
      };

      const result = resolver.checkAmbiguity(intent);

      expect(result.hasAmbiguity).toBeTruthy();
      expect(result.missingFields.length).toBeGreaterThan(1);
      expect(result.missingFields).toContain('data/hora');
      expect(result.missingFields).toContain('destino (ClickUp/Notion/ambos)');
    });
  });

  describe('generateConfirmationMessage', () => {
    it('should generate complete confirmation message', () => {
      const intent: TaskIntent = {
        title: 'Ligar para Empresa XYZ',
        dueDateRelative: 'sexta',
        clientName: 'Empresa XYZ',
        destination: 'clickup',
        priority: 'high',
        completeness: 'complete',
        rawText: 'ligar para Empresa XYZ sexta urgente',
      };

      const ambiguity = resolver.checkAmbiguity(intent);

      expect(ambiguity.confirmationMessage).toBeDefined();
      expect(ambiguity.confirmationMessage).toContain('Ligar para Empresa XYZ');
      expect(ambiguity.confirmationMessage).toContain('sexta');
      expect(ambiguity.confirmationMessage).toContain('Empresa XYZ');
      expect(ambiguity.confirmationMessage).toContain('Confirma');
    });

    it('should show warnings for missing fields in confirmation', () => {
      const intent: TaskIntent = {
        title: 'Tarefa sem cliente',
        dueDateRelative: 'amanhã',
        destination: 'notion',
        completeness: 'ambiguous',
        rawText: 'tarefa sem cliente amanhã',
      };

      const ambiguity = resolver.checkAmbiguity(intent);

      expect(ambiguity.confirmationMessage).toContain('Tarefa sem cliente');
      expect(ambiguity.confirmationMessage).toContain('⚠️');
    });

    it('should format destination names properly', () => {
      const intent: TaskIntent = {
        title: 'Test',
        dueDateRelative: 'hoje',
        destination: 'both',
        completeness: 'complete',
        rawText: 'test',
      };

      const ambiguity = resolver.checkAmbiguity(intent);

      expect(ambiguity.confirmationMessage).toContain('ClickUp');
      expect(ambiguity.confirmationMessage).toContain('Notion');
    });

    it('should format priority names properly', () => {
      const intent: TaskIntent = {
        title: 'Urgent Task',
        dueDateRelative: 'hoje',
        destination: 'clickup',
        priority: 'urgent',
        completeness: 'complete',
        rawText: 'urgent task',
      };

      const ambiguity = resolver.checkAmbiguity(intent);

      expect(ambiguity.confirmationMessage).toContain('Crítica');
      expect(ambiguity.confirmationMessage).toContain('ASAP');
    });
  });

  describe('generateClarificationMessage', () => {
    it('should generate clarification for missing fields', () => {
      const intent: TaskIntent = {
        title: 'Fazer algo',
        destination: 'clickup',
        completeness: 'ambiguous',
        rawText: 'fazer algo',
      };

      const ambiguity = resolver.checkAmbiguity(intent);

      expect(ambiguity.clarificationMessage).toBeDefined();
      expect(ambiguity.clarificationMessage).toContain('data/hora');
    });

    it('should be empty for complete task', () => {
      const intent: TaskIntent = {
        title: 'Complete task',
        dueDateRelative: 'amanhã',
        destination: 'clickup',
        completeness: 'complete',
        rawText: 'complete task',
      };

      const ambiguity = resolver.checkAmbiguity(intent);

      expect(ambiguity.clarificationMessage).toBe('');
    });
  });

  describe('validateConfirmationResponse', () => {
    it('should recognize affirmative responses', () => {
      const affirmatives = ['sim', 'Sim', 'SIM', 'yes', 's', 'ok', 'tá bom', 'certo'];

      affirmatives.forEach((response) => {
        const result = resolver.validateConfirmationResponse(response);
        expect(result.isValid).toBeTruthy();
        expect(result.confirmed).toBeTruthy();
      });
    });

    it('should recognize negative responses', () => {
      const negatives = ['não', 'Não', 'NÃO', 'no', 'n', 'nope'];

      negatives.forEach((response) => {
        const result = resolver.validateConfirmationResponse(response);
        expect(result.isValid).toBeTruthy();
        expect(result.confirmed).toBeFalsy();
      });
    });

    it('should recognize correction requests', () => {
      const corrections = [
        'corrige o título',
        'muda a data',
        'altera o cliente',
        'Corrige para segunda-feira',
      ];

      corrections.forEach((response) => {
        const result = resolver.validateConfirmationResponse(response);
        expect(result.isValid).toBeTruthy();
        expect(result.confirmed).toBeNull();
        expect(result.clarification).toBeDefined();
      });
    });

    it('should mark invalid responses as invalid', () => {
      const result = resolver.validateConfirmationResponse('talvez depois');

      expect(result.isValid).toBeFalsy();
      expect(result.confirmed).toBeNull();
    });

    it('should be case-insensitive', () => {
      const result1 = resolver.validateConfirmationResponse('SIM');
      const result2 = resolver.validateConfirmationResponse('Não');

      expect(result1.confirmed).toBeTruthy();
      expect(result2.confirmed).toBeFalsy();
    });

    it('should handle whitespace', () => {
      const result = resolver.validateConfirmationResponse('  sim  ');

      expect(result.isValid).toBeTruthy();
      expect(result.confirmed).toBeTruthy();
    });
  });

  describe('Message Generation', () => {
    it('should generate rejection message', () => {
      const message = resolver.generateRejectionMessage();

      expect(message).toContain('novamente');
      expect(message).toContain('corrigido');
    });

    it('should generate acceptance message', () => {
      const message = resolver.generateAcceptanceMessage();

      expect(message).toContain('Perfeito');
      expect(message).toContain('criar');
    });

    it('should generate invalid response message', () => {
      const message = resolver.generateInvalidResponseMessage();

      expect(message).toContain('não entendi');
      expect(message).toContain('sim');
      expect(message).toContain('não');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const resolver1 = getAmbiguityResolver();
      const resolver2 = getAmbiguityResolver();

      expect(resolver1).toBe(resolver2);
    });
  });

  describe('Integration - Full Ambiguity Flow', () => {
    it('should handle complete detection and message generation flow', () => {
      const intent: TaskIntent = {
        title: 'Ligar para cliente',
        dueDateRelative: 'segunda',
        completeness: 'ambiguous',
        rawText: 'ligar para cliente segunda',
      };

      const ambiguity = resolver.checkAmbiguity(intent);

      // Should detect missing destination
      expect(ambiguity.hasAmbiguity).toBeTruthy();
      expect(ambiguity.missingFields).toContain('destino (ClickUp/Notion/ambos)');

      // Should generate confirmation message
      expect(ambiguity.confirmationMessage).toBeDefined();
      expect(ambiguity.confirmationMessage).toContain('Ligar para cliente');

      // Should generate clarification message
      expect(ambiguity.clarificationMessage).toBeDefined();
      expect(ambiguity.clarificationMessage).toContain('destino');

      // Test user confirmation
      const confirmResponse = resolver.validateConfirmationResponse('sim');
      expect(confirmResponse.confirmed).toBeTruthy();
    });

    it('should handle correction flow', () => {
      const ambiguity: AmbiguityCheckResult = {
        hasAmbiguity: true,
        missingFields: ['destino (ClickUp/Notion/ambos)'],
        confirmationNeeded: true,
        confirmationMessage: 'Test confirmation',
      };

      // User wants to correct
      const correction = resolver.validateConfirmationResponse('corrige o destino para ClickUp');
      expect(correction.confirmed).toBeNull();
      expect(correction.clarification).toBeDefined();

      // Generate rejection message
      const rejectionMsg = resolver.generateRejectionMessage();
      expect(rejectionMsg).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle task with only required fields', () => {
      const intent: TaskIntent = {
        title: 'Minimal task',
        dueDateRelative: 'hoje',
        destination: 'clickup',
        completeness: 'complete',
        rawText: 'minimal task',
      };

      const ambiguity = resolver.checkAmbiguity(intent);

      expect(ambiguity.hasAmbiguity).toBeFalsy();
      expect(ambiguity.missingFields).toHaveLength(0);
    });

    it('should handle task with dueDate as Date object instead of string', () => {
      const intent: TaskIntent = {
        title: 'Task with Date object',
        dueDate: new Date('2026-02-25'),
        destination: 'notion',
        completeness: 'complete',
        rawText: 'task',
      };

      const ambiguity = resolver.checkAmbiguity(intent);

      expect(ambiguity.hasAmbiguity).toBeFalsy();
      expect(ambiguity.confirmationMessage).toContain('Task with Date object');
    });

    it('should handle empty/null priority', () => {
      const intent: TaskIntent = {
        title: 'Task without priority',
        dueDateRelative: 'amanhã',
        destination: 'clickup',
        completeness: 'complete',
        rawText: 'task',
      };

      const ambiguity = resolver.checkAmbiguity(intent);

      expect(ambiguity.confirmationMessage).toBeDefined();
      // Should not crash even without priority
      expect(ambiguity.confirmationMessage).toContain('Task without priority');
    });
  });
});
