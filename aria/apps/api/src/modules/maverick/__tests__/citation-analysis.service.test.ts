/**
 * Citation Analysis Service Tests
 */

import { CitationAnalysisService } from '../citation-analysis.service';
import { describe, test, expect, beforeEach } from 'vitest';

describe('CitationAnalysisService', () => {
  let service: CitationAnalysisService;

  const mockChunks = [
    {
      id: 'chunk-1',
      source: 'guide.md',
      content: 'Estratégia de posicionamento de marca é crucial para sucesso',
      metadata: { category: 'strategy', importance: 9 },
    },
    {
      id: 'chunk-2',
      source: 'best-practices.md',
      content: 'Conteúdo de qualidade atrai clientes e constrói relacionamento',
      metadata: { category: 'content', importance: 8 },
    },
    {
      id: 'chunk-3',
      source: 'metrics.md',
      content: 'Engajamento é medido por comentários, compartilhamentos e reactions',
      metadata: { category: 'engagement', importance: 7 },
    },
  ];

  beforeEach(() => {
    service = new CitationAnalysisService();
  });

  describe('analyzeText', () => {
    test('analisa texto com citações válidas', () => {
      const text = '[Estratégia de posicionamento de marca] e [Conteúdo de qualidade] são importantes.';
      const analysis = service.analyzeText(text, mockChunks);

      expect(analysis.text).toBe(text);
      expect(analysis.validations.length).toBeGreaterThan(0);
      expect(analysis.summary.totalCitations).toBeGreaterThan(0);
      expect(analysis.summary.validCitations).toBeGreaterThan(0);
    });

    test('detecta alucinações em texto', () => {
      const text = '[Estratégia importante] e [Informação completamente falsa].';
      const analysis = service.analyzeText(text, mockChunks);

      expect(analysis.hallucinations.hallucinations.length).toBeGreaterThan(0);
      expect(analysis.summary.riskLevel).not.toBe('safe');
    });

    test('calcula sumário correto', () => {
      const text = '[Estratégia de posicionamento de marca]';
      const analysis = service.analyzeText(text, mockChunks);

      expect(analysis.summary.totalCitations).toBe(analysis.validations.length);
      expect(analysis.summary.validationRate).toBeGreaterThanOrEqual(0);
      expect(analysis.summary.validationRate).toBeLessThanOrEqual(100);
      expect(analysis.summary.averageConfidence).toBeGreaterThanOrEqual(0);
    });

    test('risco é safe quando válido', () => {
      const text = '[Estratégia de posicionamento de marca] é importante.';
      const analysis = service.analyzeText(text, mockChunks);

      expect(analysis.summary.riskLevel).toBe('safe');
    });

    test('risco é critical quando há alucinações', () => {
      const text = '[Fake1] [Fake2] [Fake3]';
      const analysis = service.analyzeText(text, mockChunks);

      expect(analysis.summary.riskLevel).toBe('critical');
    });
  });

  describe('analyzeSections', () => {
    test('analisa múltiplas seções', () => {
      const sections = [
        {
          title: 'Introdução',
          content: '[Estratégia de posicionamento de marca] é fundamental.',
        },
        {
          title: 'Desenvolvimento',
          content: '[Conteúdo de qualidade] atrai clientes.',
        },
        {
          title: 'Conclusão',
          content: '[Fake info] é importante.',
        },
      ];

      const results = service.analyzeSections(sections, mockChunks);

      expect(results.size).toBe(3);
      expect(results.has('Introdução')).toBe(true);
      expect(results.get('Introdução')?.summary.riskLevel).toBe('safe');
      expect(results.get('Conclusão')?.summary.riskLevel).toBe('critical');
    });
  });

  describe('filterByRiskLevel', () => {
    test('filtra por nível de risco', () => {
      const text1 = '[Estratégia de posicionamento]';
      const analysis1 = service.analyzeText(text1, mockChunks);

      expect(service.filterByRiskLevel(analysis1, 'safe')).toBe(true);
      expect(service.filterByRiskLevel(analysis1, 'critical')).toBe(false);
    });

    test('filtra múltiplos níveis', () => {
      const text = '[Fake1]';
      const analysis = service.analyzeText(text, mockChunks);

      const passesAnyCaution = service.filterByRiskLevel(analysis, 'caution');
      const passesCritical = service.filterByRiskLevel(analysis, 'critical');

      expect(typeof passesAnyCaution).toBe('boolean');
      expect(typeof passesCritical).toBe('boolean');
    });
  });

  describe('suggestRemediations', () => {
    test('sugere ações para texto inválido', () => {
      const text = '[Fake info]';
      const analysis = service.analyzeText(text, mockChunks);
      const suggestions = service.suggestRemediations(analysis);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('❌') || s.includes('⚠️') || s.includes('🚨'))).toBe(
        true
      );
    });

    test('sugere publicação para texto válido', () => {
      const text = '[Estratégia de posicionamento de marca] é essencial.';
      const analysis = service.analyzeText(text, mockChunks);
      const suggestions = service.suggestRemediations(analysis);

      expect(suggestions.some(s => s.includes('✅'))).toBe(true);
    });

    test('sugere verificação para confidence baixo', () => {
      const text = '[Info parcial da base]';
      const analysis = service.analyzeText(text, mockChunks);
      const suggestions = service.suggestRemediations(analysis);

      // Se confidence < 50, deve sugerir revisão
      if (analysis.summary.averageConfidence < 50) {
        expect(suggestions.some(s => s.toLowerCase().includes('confidence'))).toBe(true);
      }
    });
  });

  describe('generateHallucinationReport', () => {
    test('gera relatório quando há histórico', () => {
      const text1 = '[Estratégia]';
      const text2 = '[Fake]';

      service.analyzeText(text1, mockChunks);
      service.analyzeText(text2, mockChunks);

      const report = service.generateHallucinationReport();

      expect(typeof report).toBe('string');
      expect(report).toMatch(/RELATÓRIO DE ALUCINAÇÕES|Nenhuma análise/i);
    });

    test('relatório contém estatísticas', () => {
      const text = '[Fake1] [Fake2]';
      service.analyzeText(text, mockChunks);

      const report = service.generateHallucinationReport();

      expect(report).toMatch(/Total Analisado|Taxa de Alucinação|Distribuição/);
    });
  });

  describe('clearHistory', () => {
    test('limpa histórico', () => {
      service.analyzeText('[Fake]', mockChunks);
      let report = service.generateHallucinationReport();
      expect(report).not.toMatch(/Nenhuma análise/);

      service.clearHistory();
      report = service.generateHallucinationReport();
      expect(report).toMatch(/Nenhuma análise/);
    });
  });
});
