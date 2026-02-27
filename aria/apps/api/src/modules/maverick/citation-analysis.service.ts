/**
 * Citation Analysis Service - Integra validação e detecção de alucinações
 *
 * Orquestra o fluxo completo:
 * 1. Extrai citações do texto
 * 2. Valida contra base de conhecimento
 * 3. Detecta alucinações
 * 4. Retorna análise completa
 */

import { CitationValidator, CitationValidationResult } from './citation-validator';
import { HallucinationDetector, HallucinationAnalysis } from './hallucination-detector';

export interface FullCitationAnalysis {
  text: string;
  validations: CitationValidationResult[];
  hallucinations: HallucinationAnalysis;
  summary: {
    totalCitations: number;
    validCitations: number;
    invalidCitations: number;
    validationRate: number;
    averageConfidence: number;
    riskLevel: 'safe' | 'caution' | 'critical';
  };
}

export class CitationAnalysisService {
  private validator: CitationValidator;
  private detector: HallucinationDetector;

  constructor() {
    this.validator = new CitationValidator();
    this.detector = new HallucinationDetector();
  }

  /**
   * Análise completa de um texto
   */
  analyzeText(
    text: string,
    indexedChunks: Array<{ id: string; source: string; content: string; metadata: any }>
  ): FullCitationAnalysis {
    // 1. Validar citações
    const validations = this.validator.validateCitations(text, indexedChunks);

    // 2. Detectar alucinações
    const hallucinations = this.detector.detectHallucinations(text, validations);

    // 3. Compilar resumo
    const stats = this.validator.getValidationStats(validations);

    return {
      text,
      validations,
      hallucinations,
      summary: {
        totalCitations: stats.totalCitations,
        validCitations: stats.validCitations,
        invalidCitations: stats.invalidCitations,
        validationRate: stats.validationRate,
        averageConfidence: stats.averageConfidence,
        riskLevel: hallucinations.riskLevel,
      },
    };
  }

  /**
   * Análise por parágrafo/seção
   */
  analyzeSections(
    sections: { title: string; content: string }[],
    indexedChunks: Array<{ id: string; source: string; content: string; metadata: any }>
  ): Map<string, FullCitationAnalysis> {
    const results = new Map<string, FullCitationAnalysis>();

    for (const section of sections) {
      const analysis = this.analyzeText(section.content, indexedChunks);
      results.set(section.title, analysis);
    }

    return results;
  }

  /**
   * Gera relatório de alucinações
   */
  generateHallucinationReport(): string {
    const stats = this.detector.getHallucinationStats();

    if (stats.totalAnalyzed === 0) {
      return '📊 Nenhuma análise realizada ainda.';
    }

    let report = `📊 RELATÓRIO DE ALUCINAÇÕES\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `Total Analisado: ${stats.totalAnalyzed}\n`;
    report += `Alucinações Detectadas: ${stats.hallucinationCount}\n`;
    report += `Taxa de Alucinação: ${stats.hallucinationRate.toFixed(1)}%\n\n`;

    report += `📈 Distribuição por Severidade:\n`;
    report += `  🔴 Crítica: ${stats.severityDistribution.critical}\n`;
    report += `  🟠 Alta: ${stats.severityDistribution.high}\n`;
    report += `  🟡 Média: ${stats.severityDistribution.medium}\n`;
    report += `  🟢 Baixa: ${stats.severityDistribution.low}\n\n`;

    if (stats.mostCommonReasons.length > 0) {
      report += `⚠️ Razões Mais Comuns:\n`;
      stats.mostCommonReasons.forEach((reason, idx) => {
        report += `  ${idx + 1}. ${reason}\n`;
      });
    }

    return report;
  }

  /**
   * Aplica filtro de risco ao resultado
   */
  filterByRiskLevel(
    analysis: FullCitationAnalysis,
    minRiskLevel: 'safe' | 'caution' | 'critical'
  ): boolean {
    const riskLevels = ['safe', 'caution', 'critical'];
    const currentLevel = riskLevels.indexOf(analysis.summary.riskLevel);
    const minLevel = riskLevels.indexOf(minRiskLevel);

    return currentLevel >= minLevel;
  }

  /**
   * Sugere ações de remediação
   */
  suggestRemediations(analysis: FullCitationAnalysis): string[] {
    const suggestions: string[] = [];

    if (analysis.summary.invalidCitations > 0) {
      suggestions.push(
        `❌ Remova ou verifique ${analysis.summary.invalidCitations} citação(ões) inválida(s).`
      );
    }

    if (analysis.summary.averageConfidence < 50) {
      suggestions.push('⚠️ Confidence média está baixa. Revise as fontes citadas.');
    }

    if (analysis.summary.validationRate < 70) {
      suggestions.push('📚 Menos de 70% das citações foram validadas. Referencie mais dados confiáveis.');
    }

    if (analysis.summary.riskLevel === 'critical') {
      suggestions.push('🚨 CRÍTICO: Este texto contém alucinações significativas. Reescreva antes de publicar.');
    }

    if (analysis.summary.riskLevel === 'caution') {
      suggestions.push('⚡ Este texto requer revisão cuidadosa antes de publicação.');
    }

    if (suggestions.length === 0) {
      suggestions.push('✅ Texto está em bom estado. Pronto para publicação.');
    }

    return suggestions;
  }

  /**
   * Limpa histórico de detecção
   */
  clearHistory(): void {
    this.detector.clearHistory();
  }
}
