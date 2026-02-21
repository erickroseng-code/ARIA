import { describe, it, expect } from 'vitest';
import {
  getDocumentGuidance,
  getLimitReachedMessage,
  getDocumentsListMessage,
  getReadyToGenerateMessage,
} from '../document.guidance';

describe('document.guidance', () => {
  describe('getDocumentGuidance', () => {
    it('should provide first document guidance', () => {
      const message = getDocumentGuidance({
        documentCount: 1,
        totalLimit: 5,
        label: 'Setor Comercial',
        fileName: 'setor-comercial.pdf',
      });

      expect(message).toContain('Ótimo! Primeiro documento enviado');
      expect(message).toContain('Setor Comercial');
      expect(message).toContain('diferentes setores');
      expect(message).toContain('até 5 documentos');
    });

    it('should provide guidance for document 2', () => {
      const message = getDocumentGuidance({
        documentCount: 2,
        totalLimit: 5,
        label: 'Marketing Plan',
        fileName: 'marketing.docx',
      });

      expect(message).toContain('Documento 2 adicionado');
      expect(message).toContain('2/5 documentos');
      expect(message).toContain('Marketing Plan');
      expect(message).toContain('3 documentos');
    });

    it('should provide guidance for document 3', () => {
      const message = getDocumentGuidance({
        documentCount: 3,
        totalLimit: 5,
        label: 'RH Strategy',
        fileName: 'rh.pdf',
      });

      expect(message).toContain('Documento 3 adicionado');
      expect(message).toContain('3/5 documentos');
      expect(message).toContain('2 documentos');
    });

    it('should indicate last document available for document 4', () => {
      const message = getDocumentGuidance({
        documentCount: 4,
        totalLimit: 5,
        label: 'Financial Report',
        fileName: 'finance.pdf',
      });

      expect(message).toContain('Documento 4 adicionado');
      expect(message).toContain('4/5 documentos');
      expect(message).toContain('Último documento');
    });

    it('should provide completion message for document 5', () => {
      const message = getDocumentGuidance({
        documentCount: 5,
        totalLimit: 5,
        label: 'Operations Doc',
        fileName: 'ops.docx',
      });

      expect(message).toContain('PRONTO! 5 Documentos Recebidos');
      expect(message).toContain('Operations Doc');
      expect(message).toContain('Análise está pronta');
      expect(message).toContain('/pronto');
    });
  });

  describe('getLimitReachedMessage', () => {
    it('should display limit reached message', () => {
      const message = getLimitReachedMessage();

      expect(message).toContain('LIMITE DE 5 DOCUMENTOS ATINGIDO');
      expect(message).toContain('/pronto');
      expect(message).toContain('/cancelar');
      expect(message).toContain('/docs');
    });

    it('should include action options', () => {
      const message = getLimitReachedMessage();

      expect(message).toContain('Gerar Plano de Ataque');
      expect(message).toContain('Limpar documentos');
      expect(message).toContain('Revisar documentos');
    });
  });

  describe('getDocumentsListMessage', () => {
    it('should display list of documents', () => {
      const docs = [
        { label: 'Comercial', fileName: 'setor-comercial.pdf' },
        { label: 'Marketing', fileName: 'marketing.docx' },
        { label: 'RH', fileName: 'rh.pdf' },
      ];

      const message = getDocumentsListMessage(docs);

      expect(message).toContain('Documentos Acumulados (3/5)');
      expect(message).toContain('1. *Comercial*');
      expect(message).toContain('2. *Marketing*');
      expect(message).toContain('3. *RH*');
      expect(message).toContain('setor-comercial.pdf');
      expect(message).toContain('marketing.docx');
    });

    it('should include action options', () => {
      const docs = [{ label: 'Test', fileName: 'test.pdf' }];
      const message = getDocumentsListMessage(docs);

      expect(message).toContain('/pronto');
      expect(message).toContain('/cancelar');
      expect(message).toContain('Enviar mais documentos');
    });

    it('should handle single document', () => {
      const docs = [{ label: 'Single Doc', fileName: 'single.pdf' }];
      const message = getDocumentsListMessage(docs);

      expect(message).toContain('(1/5)');
      expect(message).toContain('Single Doc');
    });

    it('should handle max documents', () => {
      const docs = Array.from({ length: 5 }, (_, i) => ({
        label: `Doc ${i + 1}`,
        fileName: `doc${i + 1}.pdf`,
      }));

      const message = getDocumentsListMessage(docs);

      expect(message).toContain('(5/5)');
      for (let i = 1; i <= 5; i++) {
        expect(message).toContain(`${i}. *Doc ${i}*`);
      }
    });
  });

  describe('getReadyToGenerateMessage', () => {
    it('should display ready to generate message', () => {
      const docs = [
        { label: 'Comercial' },
        { label: 'Marketing' },
        { label: 'RH' },
      ];

      const message = getReadyToGenerateMessage(docs);

      expect(message).toContain('Documentos Prontos para Análise');
      expect(message).toContain('1. Comercial');
      expect(message).toContain('2. Marketing');
      expect(message).toContain('3. RH');
      expect(message).toContain('Gerando Plano de Ataque');
    });

    it('should include waiting indicator', () => {
      const docs = [{ label: 'Test' }];
      const message = getReadyToGenerateMessage(docs);

      expect(message).toContain('⏳ Isso pode levar alguns segundos');
    });

    it('should work with single document', () => {
      const docs = [{ label: 'Single Doc' }];
      const message = getReadyToGenerateMessage(docs);

      expect(message).toContain('1. Single Doc');
      expect(message).toContain('Gerando Plano');
    });

    it('should work with all 5 documents', () => {
      const docs = Array.from({ length: 5 }, (_, i) => ({
        label: `Doc ${i + 1}`,
      }));

      const message = getReadyToGenerateMessage(docs);

      for (let i = 1; i <= 5; i++) {
        expect(message).toContain(`${i}. Doc ${i}`);
      }
    });
  });

  describe('Message formatting', () => {
    it('should use markdown formatting', () => {
      const message = getDocumentGuidance({
        documentCount: 1,
        totalLimit: 5,
        label: 'Test Doc',
        fileName: 'test.pdf',
      });

      // Should contain markdown formatting
      expect(message).toMatch(/\*.*?\*/); // Bold
      expect(message).toMatch(/_.*?_/); // Italic
    });

    it('should include emojis for visual clarity', () => {
      const message = getDocumentGuidance({
        documentCount: 1,
        totalLimit: 5,
        label: 'Test',
        fileName: 'test.pdf',
      });

      expect(message).toMatch(/[\u{1F3AF}\u{1F4CC}\u{1F4C8}\u{23ED}\u{2705}\u{1F504}]/u);
    });

    it('should have proper line breaks', () => {
      const message = getDocumentGuidance({
        documentCount: 2,
        totalLimit: 5,
        label: 'Test',
        fileName: 'test.pdf',
      });

      expect(message).toContain('\n');
    });
  });

  describe('Label handling', () => {
    it('should escape markdown in labels', () => {
      const message = getDocumentGuidance({
        documentCount: 1,
        totalLimit: 5,
        label: 'Test_Label*With*Markdown',
        fileName: 'test.pdf',
      });

      expect(message).toContain('Test_Label*With*Markdown');
    });

    it('should display label correctly for each message type', () => {
      const label = 'Special-Document';

      const msg1 = getDocumentGuidance({
        documentCount: 1,
        totalLimit: 5,
        label,
        fileName: 'test.pdf',
      });

      expect(msg1).toContain(label);
    });
  });
});
