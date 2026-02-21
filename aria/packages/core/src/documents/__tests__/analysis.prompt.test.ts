import { describe, it, expect } from 'vitest';
import { buildUserMessage } from '../prompts/analysis.prompt';

describe('Analysis Prompt Module', () => {
  describe('buildUserMessage', () => {
    it('should format single document correctly', () => {
      const doc = {
        id: 'doc1',
        originalName: 'comercial.pdf',
        mimeType: 'application/pdf' as const,
        extractedText: 'Vendas cresceram 15%',
        uploadedAt: new Date(),
      };

      const message = buildUserMessage([doc], 'Empresa A');

      expect(message).toContain('Cliente: Empresa A');
      expect(message).toContain('DOCUMENTO 1: comercial.pdf');
      expect(message).toContain('Vendas cresceram 15%');
    });

    it('should format multiple documents with separators', () => {
      const docs = [
        {
          id: 'doc1',
          originalName: 'comercial.pdf',
          mimeType: 'application/pdf' as const,
          extractedText: 'Content 1',
          uploadedAt: new Date(),
        },
        {
          id: 'doc2',
          originalName: 'marketing.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' as const,
          extractedText: 'Content 2',
          uploadedAt: new Date(),
        },
        {
          id: 'doc3',
          originalName: 'rh.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' as const,
          extractedText: 'Content 3',
          uploadedAt: new Date(),
        },
      ];

      const message = buildUserMessage(docs, 'Test Company');

      expect(message).toContain('DOCUMENTO 1: comercial.pdf');
      expect(message).toContain('DOCUMENTO 2: marketing.docx');
      expect(message).toContain('DOCUMENTO 3: rh.docx');
      expect(message).toContain('Content 1');
      expect(message).toContain('Content 2');
      expect(message).toContain('Content 3');

      // Check for separators
      const separatorCount = (message.match(/---/g) || []).length;
      expect(separatorCount).toBeGreaterThanOrEqual(2);
    });

    it('should include client name in message', () => {
      const doc = {
        id: 'doc1',
        originalName: 'test.pdf',
        mimeType: 'application/pdf' as const,
        extractedText: 'Test',
        uploadedAt: new Date(),
      };

      const message = buildUserMessage([doc], 'Acme Corporation');

      expect(message).toContain('Cliente: Acme Corporation');
    });

    it('should preserve document extraction text exactly', () => {
      const extractedText = `Ponto 1
- Subponto 1.1
- Subponto 1.2
Ponto 2`;

      const doc = {
        id: 'doc1',
        originalName: 'test.pdf',
        mimeType: 'application/pdf' as const,
        extractedText,
        uploadedAt: new Date(),
      };

      const message = buildUserMessage([doc], 'Test');

      expect(message).toContain(extractedText);
    });
  });
});
