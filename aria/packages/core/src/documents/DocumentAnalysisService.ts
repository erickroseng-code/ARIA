import Anthropic from '@anthropic-ai/sdk';
import { ANALYSIS_SYSTEM_PROMPT, buildUserMessage } from './prompts/analysis.prompt';
import type { ProcessedDocument, ClientMetadata, GeneratedAnalysis, AnalysisSection, ChecklistItem, PendingDocument } from '@aria/shared';
import { AppError } from '../errors/AppError';
import { MetadataExtractor } from '../ai/MetadataExtractor';

export class DocumentAnalysisService {
  constructor(private claude: Anthropic) {}

  async *analyzeDocuments(
    docs: ProcessedDocument[],
    clientName: string
  ): AsyncGenerator<string> {
    if (docs.length === 0) {
      throw new AppError(
        'No documents to analyze',
        'DOC_005',
        { statusCode: 400 }
      );
    }

    const stream = await this.claude.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: buildUserMessage(docs, clientName) }
      ],
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        yield chunk.delta.text;
      }
    }
  }

  async buildAnalysis(
    docs: ProcessedDocument[],
    clientName: string
  ): Promise<string> {
    let fullText = '';
    for await (const chunk of this.analyzeDocuments(docs, clientName)) {
      fullText += chunk;
    }
    return fullText;
  }

  async detectSectorType(text: string): Promise<string> {
    // Classificação rápida com haiku
    const result = await this.claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 50,
      system: 'Responda em uma palavra: qual setor empresarial este texto representa? Ex: comercial, marketing, rh, financeiro, operacoes, ti, juridico',
      messages: [{ role: 'user', content: text.slice(0, 500) }],
    });

    return result.content[0] && result.content[0].type === 'text'
      ? result.content[0].text.trim().toLowerCase()
      : 'geral';
  }

  async buildAnalysisWithMetadata(
    docs: ProcessedDocument[],
    clientName: string
  ): Promise<{ analysis: string; clientMetadata: ClientMetadata }> {
    const analysis = await this.buildAnalysis(docs, clientName);
    const clientMetadata = await MetadataExtractor.extractClientMetadata(analysis);
    return { analysis, clientMetadata };
  }

  /**
   * Task 7: Analyze documents and return structured GeneratedAnalysis with per-document sections
   * @param docs PendingDocument array with labels for each document
   * @param clientName Client name for context
   * @returns GeneratedAnalysis with sections for each document, integrated analysis, and checklist
   */
  async analyzeDocumentsWithStructure(
    docs: PendingDocument[],
    clientName: string
  ): Promise<GeneratedAnalysis> {
    if (docs.length === 0) {
      throw new AppError(
        'No documents to analyze',
        'DOC_005',
        { statusCode: 400 }
      );
    }

    // Build the full analysis
    const fullAnalysis = await this.buildAnalysis(docs as ProcessedDocument[], clientName);

    // Parse the analysis to extract sections and integrated analysis
    const sections = this.parseSectionsFromAnalysis(fullAnalysis, docs);
    const integratedAnalysis = this.parseIntegratedAnalysis(fullAnalysis);
    const checklist = this.parseChecklist(fullAnalysis);

    return {
      clientName,
      sections,
      integratedAnalysis,
      practicalChecklist: checklist,
      generatedAt: new Date(),
      sourceDocuments: docs.map(doc => doc.label), // Use labels, not filenames
    };
  }

  /**
   * Parse individual document sections from the full analysis
   * Expects sections in format: ## RESUMO — [Nome do Setor]
   */
  private parseSectionsFromAnalysis(analysis: string, docs: PendingDocument[]): AnalysisSection[] {
    const sections: AnalysisSection[] = [];

    // Pattern to find sections for each document
    // Looking for "### 📊 Resumo — [Sector Name]" or "## RESUMO — [Sector Name]"
    const sectionPattern = /###?\s*📊\s*Resumo\s*—\s*([^\n]+)|###?\s*Resumo\s*—\s*([^\n]+)/g;
    const matches = Array.from(analysis.matchAll(sectionPattern));

    // Create a section for each document
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      if (!doc) continue;

      let sectorType = 'geral';
      let content = '';

      // Try to find the corresponding section in the analysis
      if (i < matches.length && matches[i]) {
        const match = matches[i];
        if (!match) continue;

        const sectorName = (match[1] ?? match[2]) as string | undefined;
        if (sectorName && typeof sectorName === 'string') {
          sectorType = sectorName.trim().toLowerCase().replace(/\s+/g, '_');
        }

        // Extract content until the next section or end of individual analyses
        const sectionStart = match.index ?? 0;
        const nextMatch = i < matches.length - 1 ? matches[i + 1] : null;
        const nextSectionStart = nextMatch?.index ?? analysis.indexOf('## 🔗 Análise Integrada');
        const endIndex = nextSectionStart >= 0 ? nextSectionStart : analysis.length;

        const matchLength = (match[0]?.length) ?? 0;
        content = analysis.substring(sectionStart + matchLength, endIndex).trim();
      } else {
        // If no section found in analysis, use a generic summary
        content = `Documento "${doc.label}" foi processado e incluído na análise integrada.`;
      }

      sections.push({
        label: doc.label,
        sectorType,
        content,
      });
    }

    return sections;
  }

  /**
   * Extract integrated analysis section
   * Looks for "## 🔗 Análise Integrada" or "## Análise Integrada"
   */
  private parseIntegratedAnalysis(analysis: string): string {
    const integratedPattern = /##\s*🔗?\s*Análise Integrada\n([\s\S]*?)(?=##\s*✅|$)/;
    const match = analysis.match(integratedPattern);

    if (match && match[1]) {
      return match[1].trim();
    }

    // Fallback: if not found, return the whole analysis
    return analysis;
  }

  /**
   * Extract checklist items
   * Looks for "## ✅ Checklist de Ações Práticas" section
   */
  private parseChecklist(analysis: string): ChecklistItem[] {
    const checklistItems: ChecklistItem[] = [];

    // Pattern to find sections with priority
    const prioritySections = [
      { pattern: /###?\s*🔴\s*Alta\s*Prioridade\n([\s\S]*?)(?=###?\s*|$)/g, priority: 'alta' as const },
      { pattern: /###?\s*🟡\s*M[éê]dia\s*Prioridade\n([\s\S]*?)(?=###?\s*|$)/g, priority: 'média' as const },
      { pattern: /###?\s*🟢\s*Baixa\s*Prioridade\n([\s\S]*?)(?=###?\s*|$)/g, priority: 'baixa' as const },
    ];

    for (const { pattern, priority } of prioritySections) {
      let match;
      while ((match = pattern.exec(analysis)) !== null) {
        const itemsText = match[1];
        if (!itemsText) continue;

        const itemPattern = /[-\*]\s*\[\s*\]\s*(.+?)(?=[-\*\n]|$)/g;
        let itemMatch;

        while ((itemMatch = itemPattern.exec(itemsText)) !== null) {
          const rawAction = itemMatch[1];
          if (!rawAction) continue;

          const actionText = rawAction.trim();
          // Extract sector if mentioned in parentheses
          const sectorMatch = actionText.match(/\((\w+)\)$/);
          const action = actionText.replace(/\s*\(\w+\)\s*$/, '');
          const sector = sectorMatch ? sectorMatch[1] : undefined;

          checklistItems.push({
            action,
            priority,
            ...(sector && { sector }),
          });
        }
      }
    }

    // If no items found, try simpler pattern
    if (checklistItems.length === 0) {
      const simplePattern = /[-\*]\s*\[\s*\]\s*(.+)/g;
      let simpleMatch;

      while ((simpleMatch = simplePattern.exec(analysis)) !== null) {
        const rawAction = simpleMatch[1];
        if (!rawAction) continue;

        checklistItems.push({
          action: rawAction.trim(),
          priority: 'média',
        });
      }
    }

    return checklistItems;
  }
}
