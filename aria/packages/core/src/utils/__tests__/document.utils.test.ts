import { describe, it, expect } from 'vitest';
import { extractLabelFromFilename, getDefaultDocumentLabel, getFinalDocumentLabel } from '../document.utils';

describe('document.utils', () => {
  describe('extractLabelFromFilename', () => {
    it('should convert kebab-case to Title Case', () => {
      expect(extractLabelFromFilename('setor-comercial.pdf')).toBe('Setor Comercial');
    });

    it('should convert snake_case to Title Case', () => {
      expect(extractLabelFromFilename('relatorio_marketing.docx')).toBe('Relatorio Marketing');
    });

    it('should remove file extension', () => {
      expect(extractLabelFromFilename('documento.pdf')).toBe('Documento');
    });

    it('should remove date patterns like _2026', () => {
      expect(extractLabelFromFilename('relatorio_mkt_2026.docx')).toBe('Relatorio Mkt');
    });

    it('should remove date patterns like -2026-02-20', () => {
      expect(extractLabelFromFilename('analysis-2026-02-20.pdf')).toBe('Analysis');
    });

    it('should capitalize each word correctly', () => {
      expect(extractLabelFromFilename('setor-comercial-analise.pdf')).toBe('Setor Comercial Analise');
    });

    it('should handle mixed separators', () => {
      expect(extractLabelFromFilename('setor_comercial-2026.pdf')).toBe('Setor Comercial');
    });

    it('should return empty string for filename without name', () => {
      expect(extractLabelFromFilename('.pdf')).toBe('');
    });

    it('should return empty string for empty filename', () => {
      expect(extractLabelFromFilename('')).toBe('');
    });

    it('should return empty string for whitespace-only filename', () => {
      expect(extractLabelFromFilename('   ')).toBe('');
    });

    it('should handle multiple consecutive separators', () => {
      expect(extractLabelFromFilename('setor---comercial___2026.pdf')).toBe('Setor Comercial');
    });

    it('should trim whitespace', () => {
      expect(extractLabelFromFilename('  setor-comercial  .pdf')).toBe('Setor Comercial');
    });
  });

  describe('getDefaultDocumentLabel', () => {
    it('should return "Documento 1" for index 0', () => {
      expect(getDefaultDocumentLabel(0)).toBe('Documento 1');
    });

    it('should return "Documento 2" for index 1', () => {
      expect(getDefaultDocumentLabel(1)).toBe('Documento 2');
    });

    it('should return "Documento 5" for index 4', () => {
      expect(getDefaultDocumentLabel(4)).toBe('Documento 5');
    });
  });

  describe('getFinalDocumentLabel', () => {
    it('should use extracted label if available', () => {
      expect(getFinalDocumentLabel('setor-comercial.pdf', 0)).toBe('Setor Comercial');
    });

    it('should use default label if extraction returns empty', () => {
      expect(getFinalDocumentLabel('.pdf', 0)).toBe('Documento 1');
    });

    it('should use default label for empty filename', () => {
      expect(getFinalDocumentLabel('', 2)).toBe('Documento 3');
    });

    it('should prefer extracted over default', () => {
      expect(getFinalDocumentLabel('my-document.docx', 5)).toBe('My Document');
    });
  });
});
