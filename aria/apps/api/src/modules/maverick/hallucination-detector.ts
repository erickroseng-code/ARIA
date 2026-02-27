/**
 * Hallucination Detector - Detecta citações inválidas (alucinações do LLM)
 *
 * Uma alucinação ocorre quando o LLM cita informações que:
 * 1. Não existem na base de conhecimento
 * 2. Têm muito baixo confidence score
 * 3. Contradizem informações conhecidas
 */

import { CitationValidationResult } from './citation-validator';

export interface HallucinationFlag {
  type: 'critical' | 'high' | 'medium' | 'low';
  citation: string;
  reason: string;
  confidenceScore: number;
  suggestedAction: 'remove' | 'verify' | 'rephrase' | 'flag';
}

export interface HallucinationAnalysis {
  text: string;
  hallucinations: HallucinationFlag[];
  halluccinationRate: number; // % de citações que são alucinações
  riskLevel: 'safe' | 'caution' | 'critical'; // Nível de risco do texto
  recommendations: string[];
}

export interface HallucinationStats {
  totalAnalyzed: number;
  hallucinationCount: number;
  hallucinationRate: number;
  severityDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  mostCommonReasons: string[];
}

export class HallucinationDetector {
  private hallucinationHistory: HallucinationFlag[] = [];

  /**
   * Detecta alucinações em um texto baseado em validações de citação
   */
  detectHallucinations(
    text: string,
    validationResults: CitationValidationResult[]
  ): HallucinationAnalysis {
    const hallucinations = validationResults
      .filter(r => !r.found || r.confidenceScore < 50)
      .map(r => this.flagAsHallucination(r));

    this.hallucinationHistory.push(...hallucinations);

    return {
      text,
      hallucinations,
      halluccinationRate: validationResults.length > 0
        ? (hallucinations.length / validationResults.length) * 100
        : 0,
      riskLevel: this.assessRiskLevel(hallucinations),
      recommendations: this.generateRecommendations(hallucinations, text),
    };
  }

  /**
   * Marca uma citação como possível alucinação
   */
  private flagAsHallucination(result: CitationValidationResult): HallucinationFlag {
    if (!result.found) {
      return {
        type: 'critical',
        citation: result.citation,
        reason: 'Citação não encontrada na base de conhecimento',
        confidenceScore: 0,
        suggestedAction: 'remove',
      };
    }

    if (result.confidenceScore < 30) {
      return {
        type: 'critical',
        citation: result.citation,
        reason: `Confidence muito baixo (${result.confidenceScore}%) - possível distorção da informação`,
        confidenceScore: result.confidenceScore,
        suggestedAction: 'remove',
      };
    }

    if (result.confidenceScore < 50) {
      return {
        type: 'high',
        citation: result.citation,
        reason: `Confidence baixo (${result.confidenceScore}%) - informação pode estar imprecisa`,
        confidenceScore: result.confidenceScore,
        suggestedAction: 'verify',
      };
    }

    if (result.confidenceScore < 70) {
      return {
        type: 'medium',
        citation: result.citation,
        reason: `Confidence moderado (${result.confidenceScore}%) - recomenda-se verificação`,
        confidenceScore: result.confidenceScore,
        suggestedAction: 'rephrase',
      };
    }

    return {
      type: 'low',
      citation: result.citation,
      reason: `Match fuzzy (${result.confidenceScore}%) - verificação recomendada`,
      confidenceScore: result.confidenceScore,
      suggestedAction: 'flag',
    };
  }

  /**
   * Avalia nível de risco do texto
   */
  private assessRiskLevel(hallucinations: HallucinationFlag[]): 'safe' | 'caution' | 'critical' {
    if (hallucinations.length === 0) {
      return 'safe';
    }

    const criticalCount = hallucinations.filter(h => h.type === 'critical').length;
    const highCount = hallucinations.filter(h => h.type === 'high').length;

    if (criticalCount > 0) {
      return 'critical';
    }

    if (highCount > 0 || hallucinations.length > 3) {
      return 'caution';
    }

    return 'safe';
  }

  /**
   * Gera recomendações para correção
   */
  private generateRecommendations(
    hallucinations: HallucinationFlag[],
    text: string
  ): string[] {
    const recommendations: string[] = [];

    const criticalCount = hallucinations.filter(h => h.type === 'critical').length;
    const highCount = hallucinations.filter(h => h.type === 'high').length;

    if (criticalCount > 0) {
      recommendations.push(
        `⚠️ CRÍTICO: ${criticalCount} citação(ões) não encontrada(s) na base. Remova ou reescreva.`
      );
    }

    if (highCount > 0) {
      recommendations.push(
        `⚠️ ALTO: ${highCount} citação(ões) com confidence baixo. Verifique contra a base.`
      );
    }

    if (hallucinations.length > 0) {
      recommendations.push(
        '💡 Revise o texto removendo ou reformulando citações questionáveis.'
      );
    }

    if (hallucinations.length === 0) {
      recommendations.push('✅ Texto livre de alucinações detectadas.');
    }

    return recommendations;
  }

  /**
   * Calcula estatísticas de alucinações ao longo do tempo
   */
  getHallucinationStats(): HallucinationStats {
    const totalAnalyzed = this.hallucinationHistory.length;

    if (totalAnalyzed === 0) {
      return {
        totalAnalyzed: 0,
        hallucinationCount: 0,
        hallucinationRate: 0,
        severityDistribution: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        },
        mostCommonReasons: [],
      };
    }

    const severityDistribution = {
      critical: this.hallucinationHistory.filter(h => h.type === 'critical').length,
      high: this.hallucinationHistory.filter(h => h.type === 'high').length,
      medium: this.hallucinationHistory.filter(h => h.type === 'medium').length,
      low: this.hallucinationHistory.filter(h => h.type === 'low').length,
    };

    // Encontra razões mais comuns
    const reasonMap = new Map<string, number>();
    this.hallucinationHistory.forEach(h => {
      reasonMap.set(h.reason, (reasonMap.get(h.reason) || 0) + 1);
    });

    const mostCommonReasons = Array.from(reasonMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason]) => reason);

    return {
      totalAnalyzed,
      hallucinationCount: this.hallucinationHistory.length,
      hallucinationRate: (this.hallucinationHistory.length / totalAnalyzed) * 100,
      severityDistribution,
      mostCommonReasons,
    };
  }

  /**
   * Limpa histórico
   */
  clearHistory(): void {
    this.hallucinationHistory = [];
  }

  /**
   * Detecta contradições entre citações
   */
  detectContradictions(
    validationResults: CitationValidationResult[]
  ): Map<string, CitationValidationResult[]> {
    const contradictions = new Map<string, CitationValidationResult[]>();

    // Agrupa por fonte
    const bySource = new Map<string, CitationValidationResult[]>();
    validationResults
      .filter(r => r.found && r.source)
      .forEach(r => {
        const key = r.source || 'unknown';
        if (!bySource.has(key)) {
          bySource.set(key, []);
        }
        bySource.get(key)!.push(r);
      });

    // Procura citações conflitantes da mesma fonte
    bySource.forEach((citations, source) => {
      if (citations.length > 1) {
        // Se tem múltiplas citações da mesma fonte, pode haver contexto conflitante
        const confidenceDiff = Math.max(...citations.map(c => c.confidenceScore)) -
          Math.min(...citations.map(c => c.confidenceScore));

        if (confidenceDiff > 30) {
          contradictions.set(`${source} (conflito de confiança)`, citations);
        }
      }
    });

    return contradictions;
  }
}
