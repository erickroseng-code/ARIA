import { describe, it, expect } from 'vitest';
import { AmbiguityResolver } from '../AmbiguityResolver';
import { TaskIntent } from '../TaskIntentParser';

describe('AmbiguityResolver', () => {
  let resolver: AmbiguityResolver;

  beforeEach(() => {
    resolver = new AmbiguityResolver();
  });

  describe('detectAmbiguities', () => {
    it('should detect missing title', () => {
      const intent: TaskIntent = {
        title: '',
        completeness: 'incomplete',
      };
      const ambiguities = resolver.detectAmbiguities(intent);
      expect(ambiguities).toContainEqual(
        expect.objectContaining({ field: 'title', isRequired: true })
      );
    });

    it('should detect missing date', () => {
      const intent: TaskIntent = {
        title: 'Fazer algo',
        completeness: 'ambiguous',
      };
      const ambiguities = resolver.detectAmbiguities(intent);
      expect(ambiguities).toContainEqual(
        expect.objectContaining({ field: 'date' })
      );
    });

    it('should detect missing destination', () => {
      const intent: TaskIntent = {
        title: 'Fazer algo',
        dueDateRelative: 'amanhã',
        completeness: 'ambiguous',
      };
      const ambiguities = resolver.detectAmbiguities(intent);
      expect(ambiguities).toContainEqual(
        expect.objectContaining({ field: 'destination', isRequired: true })
      );
    });

    it('should return empty array for complete intent', () => {
      const intent: TaskIntent = {
        title: 'Fazer algo',
        dueDateRelative: 'amanhã',
        destination: 'clickup',
        completeness: 'complete',
      };
      const ambiguities = resolver.detectAmbiguities(intent);
      expect(ambiguities).toHaveLength(0);
    });
  });

  describe('generateConfirmation', () => {
    it('should include title', () => {
      const intent: TaskIntent = {
        title: 'Ligar para cliente',
        completeness: 'complete',
      };
      const message = resolver.generateConfirmation(intent);
      expect(message).toContain('Ligar para cliente');
    });

    it('should include client name', () => {
      const intent: TaskIntent = {
        title: 'Fazer algo',
        clientName: 'Empresa XYZ',
        completeness: 'complete',
      };
      const message = resolver.generateConfirmation(intent);
      expect(message).toContain('Empresa XYZ');
    });

    it('should include relative date', () => {
      const intent: TaskIntent = {
        title: 'Fazer algo',
        dueDateRelative: 'amanhã',
        completeness: 'complete',
      };
      const message = resolver.generateConfirmation(intent);
      expect(message).toContain('amanhã');
    });

    it('should include destination', () => {
      const intent: TaskIntent = {
        title: 'Fazer algo',
        destination: 'notion',
        completeness: 'complete',
      };
      const message = resolver.generateConfirmation(intent);
      expect(message).toContain('notion');
    });

    it('should include priority if not medium', () => {
      const intent: TaskIntent = {
        title: 'Fazer algo',
        priority: 'high',
        completeness: 'complete',
      };
      const message = resolver.generateConfirmation(intent);
      expect(message).toContain('high');
    });

    it('should not include priority if medium', () => {
      const intent: TaskIntent = {
        title: 'Fazer algo',
        priority: 'medium',
        completeness: 'complete',
      };
      const message = resolver.generateConfirmation(intent);
      expect(message).not.toContain('medium');
    });

    it('should end with confirmation request', () => {
      const intent: TaskIntent = {
        title: 'Fazer algo',
        completeness: 'complete',
      };
      const message = resolver.generateConfirmation(intent);
      expect(message).toMatch(/Confirma\?/i);
    });
  });

  describe('applyClarification', () => {
    it('should apply title clarification', () => {
      const intent: TaskIntent = {
        title: '',
        completeness: 'incomplete',
      };
      const updated = resolver.applyClarification(intent, 'title', 'Nova tarefa');
      expect(updated.title).toBe('Nova tarefa');
    });

    it('should apply date clarification', () => {
      const intent: TaskIntent = {
        title: 'Tarefa',
        completeness: 'incomplete',
      };
      const updated = resolver.applyClarification(intent, 'date', 'Amanhã');
      expect(updated.dueDateRelative).toBe('Amanhã');
    });

    it('should handle "Sem prazo" option', () => {
      const intent: TaskIntent = {
        title: 'Tarefa',
        completeness: 'incomplete',
      };
      const updated = resolver.applyClarification(intent, 'date', 'Sem prazo');
      expect(updated.dueDateRelative).toBeUndefined();
    });

    it('should apply destination clarification', () => {
      const intent: TaskIntent = {
        title: 'Tarefa',
        completeness: 'incomplete',
      };
      const updated = resolver.applyClarification(intent, 'destination', 'ClickUp');
      expect(updated.destination).toBe('clickup');
    });

    it('should apply client clarification', () => {
      const intent: TaskIntent = {
        title: 'Tarefa',
        completeness: 'incomplete',
      };
      const updated = resolver.applyClarification(intent, 'client', 'Empresa ABC');
      expect(updated.clientName).toBe('Empresa ABC');
    });

    it('should recalculate completeness after clarification', () => {
      let intent: TaskIntent = {
        title: 'Tarefa',
        completeness: 'incomplete',
      };
      intent = resolver.applyClarification(intent, 'date', 'Amanhã');
      intent = resolver.applyClarification(intent, 'destination', 'ClickUp');
      expect(intent.completeness).toBe('complete');
    });
  });

  describe('isReadyForCreation', () => {
    it('should return true for complete intent', () => {
      const intent: TaskIntent = {
        title: 'Fazer algo',
        destination: 'clickup',
        completeness: 'complete',
      };
      expect(resolver.isReadyForCreation(intent)).toBe(true);
    });

    it('should return false if missing title', () => {
      const intent: TaskIntent = {
        title: '',
        destination: 'clickup',
        completeness: 'complete',
      };
      expect(resolver.isReadyForCreation(intent)).toBe(false);
    });

    it('should return false if missing destination', () => {
      const intent: TaskIntent = {
        title: 'Fazer algo',
        completeness: 'ambiguous',
      };
      expect(resolver.isReadyForCreation(intent)).toBe(false);
    });

    it('should return false if completeness is incomplete', () => {
      const intent: TaskIntent = {
        title: 'Fazer algo',
        destination: 'clickup',
        completeness: 'incomplete',
      };
      expect(resolver.isReadyForCreation(intent)).toBe(false);
    });
  });

  describe('buildResolutionWorkflow', () => {
    it('should return no questions for complete intent', () => {
      const intent: TaskIntent = {
        title: 'Fazer algo',
        dueDateRelative: 'amanhã',
        destination: 'clickup',
        completeness: 'complete',
      };
      const workflow = resolver.buildResolutionWorkflow(intent);
      expect(workflow.step).toBe(0);
      expect(workflow.currentQuestion).toBeNull();
      expect(workflow.remainingQuestions).toHaveLength(0);
    });

    it('should return first question for incomplete intent', () => {
      const intent: TaskIntent = {
        title: '',
        completeness: 'incomplete',
      };
      const workflow = resolver.buildResolutionWorkflow(intent);
      expect(workflow.step).toBe(1);
      expect(workflow.currentQuestion).not.toBeNull();
      expect(workflow.currentQuestion?.field).toBe('title');
    });

    it('should track remaining questions', () => {
      const intent: TaskIntent = {
        title: '',
        completeness: 'incomplete',
      };
      const workflow = resolver.buildResolutionWorkflow(intent);
      expect(workflow.remainingQuestions.length).toBeGreaterThan(0);
    });
  });

  describe('getStatusMessage', () => {
    it('should return success message for complete', () => {
      const intent: TaskIntent = {
        title: 'Fazer algo',
        completeness: 'complete',
      };
      const message = resolver.getStatusMessage(intent);
      expect(message).toMatch(/completa|pronto/i);
    });

    it('should return warning for ambiguous', () => {
      const intent: TaskIntent = {
        title: 'Fazer algo',
        completeness: 'ambiguous',
        ambiguityReason: 'Data não especificada',
      };
      const message = resolver.getStatusMessage(intent);
      expect(message).toMatch(/ambiguity|faltando|incompleto/i);
    });

    it('should return error for incomplete', () => {
      const intent: TaskIntent = {
        title: '',
        completeness: 'incomplete',
        ambiguityReason: 'Título não identificado',
      };
      const message = resolver.getStatusMessage(intent);
      expect(message).toMatch(/insuficiente|incompleto/i);
    });
  });
});
