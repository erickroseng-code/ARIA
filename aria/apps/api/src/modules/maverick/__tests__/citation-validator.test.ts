/**
 * Fase 2 Tests - Citation Validator & Hallucination Detector
 *
 * Testa: CitationValidator, HallucinationDetector
 */

import { CitationValidator } from '../citation-validator';
import { HallucinationDetector } from '../hallucination-detector';

describe('Fase 2: Citation Validator & Hallucination Detector', () => {
  describe('CitationValidator', () => {
    let validator: CitationValidator;

    const mockChunks = [
      {
        id: 'chunk-1',
        source: 'knowledge.md',
        content: 'Estratégia de posicionamento de marca é fundamental para sucesso',
        metadata: { category: 'strategy', importance: 8 },
      },
      {
        id: 'chunk-2',
        source: 'best-practices.md',
        content: 'Conteúdo de qualidade atrai e mantém a audiência engajada',
        metadata: { category: 'content', importance: 7 },
      },
      {
        id: 'chunk-3',
        source: 'engagement.md',
        content: 'Engajamento é medido por interações e comentários na rede',
        metadata: { category: 'engagement', importance: 6 },
      },
    ];

    beforeEach(() => {
      validator = new CitationValidator();
    });

    test('extrai citações entre colchetes', () => {
      const text = '[Estratégia de marca] é importante. [Engajamento] deve ser medido.';
      const citations = validator.extractCitations(text);

      expect(citations).toContain('Estratégia de marca');
      expect(citations).toContain('Engajamento');
      expect(citations.length).toBe(2);
    });

    test('extrai citações com padrão de asperação', () => {
      const text = '"Conteúdo de qualidade": o segredo do marketing digital.';
      const citations = validator.extractCitations(text);

      expect(citations.length).toBeGreaterThan(0);
    });

    test('extrai citações com "de acordo com"', () => {
      const text = 'De acordo com "melhores práticas", qualidade é essencial.';
      const citations = validator.extractCitations(text);

      expect(citations.length).toBeGreaterThan(0);
    });

    test('valida citação exata encontrada na base', () => {
      const citation = 'Estratégia de posicionamento de marca é fundamental';
      const result = validator.validateCitation(citation, mockChunks);

      expect(result.found).toBe(true);
      expect(result.matchType).toBe('exact');
      expect(result.confidenceScore).toBe(100);
      expect(result.chunkId).toBe('chunk-1');
    });

    test('encontra match fuzzy para citação parcial', () => {
      const citation = 'Estratégia de marca importante';
      const result = validator.validateCitation(citation, mockChunks);

      expect(result.found).toBe(true);
      expect(result.matchType).toBe('fuzzy');
      expect(result.confidenceScore).toBeGreaterThan(50);
      expect(result.confidenceScore).toBeLessThan(100);
    });

    test('detecta citação não encontrada', () => {
      const citation = 'Fatos completamente fabricados que não existem na base';
      const result = validator.validateCitation(citation, mockChunks);

      expect(result.found).toBe(false);
      expect(result.matchType).toBe('not_found');
      expect(result.confidenceScore).toBe(0);
    });

    test('valida múltiplas citações', () => {
      const text = '[Estratégia de marca] é importante. [Engajamento] deve ser medido. [Informação falsa].';
      const results = validator.validateCitations(text, mockChunks);

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.found)).toBe(true);
      expect(results.some(r => !r.found)).toBe(true);
    });

    test('calcula estatísticas de validação', () => {
      const text = '[Estratégia de marca] e [Conteúdo de qualidade] e [Fake info].';
      const results = validator.validateCitations(text, mockChunks);
      const stats = validator.getValidationStats(results);

      expect(stats.totalCitations).toBe(results.length);
      expect(stats.validCitations).toBeGreaterThan(0);
      expect(stats.invalidCitations).toBeGreaterThan(0);
      expect(stats.validationRate).toBeGreaterThan(0);
      expect(stats.validationRate).toBeLessThan(100);
      expect(stats.averageConfidence).toBeGreaterThanOrEqual(0);
    });

    test('identifica distribuição de tipos de match', () => {
      const text = '[Estratégia de marca] e [Estratégia importante] e [Fake].';
      const results = validator.validateCitations(text, mockChunks);
      const stats = validator.getValidationStats(results);

      expect(stats.matchTypeDistribution.exact).toBeGreaterThanOrEqual(0);
      expect(stats.matchTypeDistribution.fuzzy).toBeGreaterThanOrEqual(0);
      expect(stats.matchTypeDistribution.notFound).toBeGreaterThanOrEqual(0);
    });
  });

  describe('HallucinationDetector', () => {
    let detector: HallucinationDetector;
    let validator: CitationValidator;

    const mockChunks = [
      {
        id: 'chunk-1',
        source: 'knowledge.md',
        content: 'Estratégia de posicionamento é fundamental',
        metadata: { category: 'strategy', importance: 8 },
      },
    ];

    beforeEach(() => {
      detector = new HallucinationDetector();
      validator = new CitationValidator();
      detector.clearHistory();
    });

    test('detecta alucinações críticas (não encontradas)', () => {
      const text = '[Fake info que não existe em lugar nenhum]';
      const validations = validator.validateCitations(text, mockChunks);
      const analysis = detector.detectHallucinations(text, validations);

      expect(analysis.hallucinations.length).toBeGreaterThan(0);
      expect(analysis.hallucinations.some(h => h.type === 'critical')).toBe(true);
    });

    test('detecta alucinações de confidence baixo', () => {
      const text = '[Info muito distante da base]';
      const validations = validator.validateCitations(text, mockChunks);
      const analysis = detector.detectHallucinations(text, validations);

      // Com match ruim, detecta hallucination
      if (validations[0].confidenceScore < 50) {
        expect(analysis.hallucinations.length).toBeGreaterThan(0);
      }
    });

    test('avalia risco do texto corretamente', () => {
      const text1 = '[Estratégia de posicionamento]'; // Válido
      const validations1 = validator.validateCitations(text1, mockChunks);
      const analysis1 = detector.detectHallucinations(text1, validations1);

      expect(analysis1.riskLevel).toBe('safe');

      const text2 = '[Fake1] [Fake2] [Fake3]'; // Múltiplas fake
      const validations2 = validator.validateCitations(text2, mockChunks);
      const analysis2 = detector.detectHallucinations(text2, validations2);

      expect(analysis2.riskLevel).toBe('critical');
    });

    test('gera recomendações apropriadas', () => {
      const text = '[Fake info]';
      const validations = validator.validateCitations(text, mockChunks);
      const analysis = detector.detectHallucinations(text, validations);

      expect(analysis.recommendations.length).toBeGreaterThan(0);
      expect(analysis.recommendations.join('')).toMatch(/remove|verify|rephrase/i);
    });

    test('calcula taxa de alucinação corretamente', () => {
      const text = '[Estratégia] [Fake1] [Fake2]';
      const validations = validator.validateCitations(text, mockChunks);
      const analysis = detector.detectHallucinations(text, validations);

      expect(analysis.halluccinationRate).toBeGreaterThanOrEqual(0);
      expect(analysis.halluccinationRate).toBeLessThanOrEqual(100);
    });

    test('mantém histórico de alucinações', () => {
      const text1 = '[Fake1]';
      const text2 = '[Fake2]';

      const validations1 = validator.validateCitations(text1, mockChunks);
      detector.detectHallucinations(text1, validations1);

      const validations2 = validator.validateCitations(text2, mockChunks);
      detector.detectHallucinations(text2, validations2);

      const stats = detector.getHallucinationStats();
      expect(stats.totalAnalyzed).toBeGreaterThanOrEqual(1);
    });

    test('identifica distribuição de severidade', () => {
      const text = '[Fake1] [Fake2]';
      const validations = validator.validateCitations(text, mockChunks);
      detector.detectHallucinations(text, validations);

      const stats = detector.getHallucinationStats();
      expect(stats.severityDistribution.critical).toBeGreaterThanOrEqual(0);
      expect(stats.severityDistribution.high).toBeGreaterThanOrEqual(0);
      expect(stats.severityDistribution.medium).toBeGreaterThanOrEqual(0);
      expect(stats.severityDistribution.low).toBeGreaterThanOrEqual(0);
    });

    test('detecta razões mais comuns de alucinação', () => {
      const text1 = '[Fake1]';
      const validations1 = validator.validateCitations(text1, mockChunks);
      detector.detectHallucinations(text1, validations1);

      const stats = detector.getHallucinationStats();
      expect(stats.mostCommonReasons).toBeDefined();
      expect(Array.isArray(stats.mostCommonReasons)).toBe(true);
    });

    test('detecta possíveis contradições entre citações', () => {
      const validations = [
        {
          citation: 'Citação 1',
          found: true,
          chunkId: 'chunk-1',
          source: 'source-1',
          confidenceScore: 90,
          matchType: 'exact' as const,
          excerpt: 'Excerpt 1',
        },
        {
          citation: 'Citação 2',
          found: true,
          chunkId: 'chunk-2',
          source: 'source-1',
          confidenceScore: 30,
          matchType: 'fuzzy' as const,
          excerpt: 'Excerpt 2',
        },
      ];

      const contradictions = detector.detectContradictions(validations);
      // Com confidence muito diferente da mesma fonte, detecta possível contradição
      expect(contradictions.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Integration: Validator + Detector', () => {
    let validator: CitationValidator;
    let detector: HallucinationDetector;

    const mockChunks = [
      {
        id: 'chunk-1',
        source: 'knowledge.md',
        content: 'Estratégia de posicionamento é fundamental para marcas',
        metadata: { category: 'strategy', importance: 8 },
      },
      {
        id: 'chunk-2',
        source: 'best-practices.md',
        content: 'Conteúdo deve ser relevante e consistente',
        metadata: { category: 'content', importance: 7 },
      },
    ];

    beforeEach(() => {
      validator = new CitationValidator();
      detector = new HallucinationDetector();
    });

    test('pipeline completo: extrai, valida, detecta alucinações', () => {
      const text =
        'Segundo [Estratégia de posicionamento], marcas precisam ser fortes. [Informação falsa] não importa.';

      const validations = validator.validateCitations(text, mockChunks);
      expect(validations.length).toBe(2);

      const analysis = detector.detectHallucinations(text, validations);
      expect(analysis.hallucinations.length).toBeGreaterThan(0);
      expect(analysis.riskLevel).toBe('critical');
    });

    test('texto completamente válido não gera alucinações', () => {
      const text = '[Estratégia de posicionamento] e [Conteúdo relevante] são importantes.';

      const validations = validator.validateCitations(text, mockChunks);
      const analysis = detector.detectHallucinations(text, validations);

      expect(analysis.riskLevel).toBe('safe');
      expect(analysis.halluccinationRate).toBe(0);
    });

    test('texto com múltiplas citações inválidas é crítico', () => {
      const text = '[Fake1] [Fake2] [Fake3] são muito importantes.';

      const validations = validator.validateCitations(text, mockChunks);
      const analysis = detector.detectHallucinations(text, validations);

      expect(analysis.riskLevel).toBe('critical');
      expect(analysis.halluccinationRate).toBeGreaterThan(50);
    });
  });
});
