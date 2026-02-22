import { describe, it, expect, beforeEach } from 'vitest';
import { ClientStatusIntent } from '../ClientStatusIntent';

describe('ClientStatusIntent', () => {
  let detector: ClientStatusIntent;

  beforeEach(() => {
    detector = new ClientStatusIntent();
  });

  describe('detect', () => {
    it('should detect "status do cliente X"', () => {
      const result = detector.detect('status do cliente Empresa ABC');
      expect(result).not.toBeNull();
      expect(result?.clientName).toBe('empresa abc');
      expect(result?.type).toBe('status');
    });

    it('should detect "status da Empresa X"', () => {
      const result = detector.detect('status da Empresa XYZ');
      expect(result).not.toBeNull();
      expect(result?.clientName).toBe('empresa xyz');
    });

    it('should detect "resumo de X"', () => {
      const result = detector.detect('resumo de Tech Solutions');
      expect(result).not.toBeNull();
      expect(result?.clientName).toBe('tech solutions');
    });

    it('should detect "quanto andou X"', () => {
      const result = detector.detect('quanto andou Empresa ABC?');
      expect(result).not.toBeNull();
      expect(result?.clientName).toBe('empresa abc');
    });

    it('should detect "como está X"', () => {
      const result = detector.detect('como está Digital Agency');
      expect(result).not.toBeNull();
      expect(result?.clientName).toBe('digital agency');
    });

    it('should detect "progresso da X"', () => {
      const result = detector.detect('progresso da Empresa Marketing');
      expect(result).not.toBeNull();
      expect(result?.clientName).toBe('empresa marketing');
    });

    it('should handle case insensitivity', () => {
      const result = detector.detect('STATUS DO CLIENTE EMPRESA ABC');
      expect(result).not.toBeNull();
    });

    it('should return null for non-status commands', () => {
      const result = detector.detect('cria tarefa para cliente');
      expect(result).toBeNull();
    });

    it('should extract client name correctly', () => {
      const result = detector.detect('status do cliente Acme Corporation Inc');
      expect(result?.clientName).toBe('acme corporation inc');
    });

    it('should handle trailing punctuation', () => {
      const result = detector.detect('status do cliente Empresa ABC?');
      expect(result?.clientName).toBe('empresa abc');
    });

    it('should ignore if client name too long', () => {
      const longName = 'A'.repeat(101);
      const result = detector.detect(`status do cliente ${longName}`);
      expect(result).toBeNull();
    });

    it('should have high confidence', () => {
      const result = detector.detect('status do cliente Empresa');
      expect(result?.confidence).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('formatNotFound', () => {
    it('should format not found message', () => {
      const message = detector.formatNotFound('Unknown Corp', [
        'Empresa ABC',
        'Tech Corp',
        'Digital Agency',
      ]);

      expect(message).toContain('Unknown Corp');
      expect(message).toContain('não encontrado');
      expect(message).toContain('Empresa ABC');
    });

    it('should handle no suggestions', () => {
      const message = detector.formatNotFound('Unknown Corp', []);
      expect(message).toContain('não encontrado');
      expect(message).not.toContain('similares');
    });
  });

  describe('formatResponse', () => {
    it('should return status message', () => {
      const statusMsg = '📊 Status de Empresa\n...';
      const result = detector.formatResponse('Empresa ABC', statusMsg);
      expect(result).toBe(statusMsg);
    });
  });
});
