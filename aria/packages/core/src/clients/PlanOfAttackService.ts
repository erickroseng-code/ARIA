import { markdownToNotionBlocks, formatDateBR } from '@aria/integrations';
import type { NotionClient } from '@aria/integrations';
import { ClientProfileService, HistoryService } from '@aria/integrations';
import type { GeneratedAnalysis } from '@aria/shared';
import { MetadataExtractor } from '../ai/MetadataExtractor';
import { contextStore } from '../chat/ContextStore';
import { AppError } from '../errors/AppError';

export class PlanOfAttackService {
  private clientProfileService: ClientProfileService;
  private historyService: HistoryService;

  constructor(private notionClient: NotionClient) {
    this.clientProfileService = new ClientProfileService(notionClient);
    this.historyService = new HistoryService(notionClient);
  }

  async createPlanPage(
    clientPageId: string,
    analysis: GeneratedAnalysis
  ): Promise<string> {
    if (!clientPageId) {
      throw new AppError('Invalid client page ID', 'NOTION_001', { statusCode: 400 });
    }

    const date = formatDateBR();
    const title = `🎯 Plano de Ataque — ${analysis.clientName} — ${date}`;
    const blocks: any[] = [];

    // 1. Header with source info (Task 6.5)
    blocks.push({
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: `📋 Fontes: ${analysis.sourceDocuments.length} documentos analisados`,
            },
          },
        ],
      },
    });

    blocks.push({ type: 'divider', divider: {} });

    // 2. General context heading if this is a multi-document plan
    if (analysis.sourceDocuments.length > 1) {
      blocks.push({
        type: 'heading_1',
        heading_1: {
          rich_text: [{ type: 'text', text: { content: '# Contexto Geral' } }],
        },
      });
    }

    // 3. Individual document sections (Task 6.2)
    for (const section of analysis.sections) {
      // Document section heading: "📄 Setor Comercial"
      blocks.push({
        type: 'heading_2',
        heading_2: {
          rich_text: [
            { type: 'text', text: { content: `📄 ${section.label}` } },
          ],
        },
      });

      // Convert section content (Markdown) to Notion blocks
      // Remove leading ## or # headers from Markdown to avoid duplicate headings
      const cleanContent = section.content.replace(/^#+\s+[^\n]*\n?/gm, '').trim();
      const sectionBlocks = markdownToNotionBlocks(cleanContent);
      blocks.push(...sectionBlocks);

      // Divider between sections
      blocks.push({ type: 'divider', divider: {} });
    }

    // 4. Integrated Analysis section (Task 6.3)
    blocks.push({
      type: 'heading_1',
      heading_1: {
        rich_text: [
          { type: 'text', text: { content: '🔗 Análise Integrada' } },
        ],
      },
    });

    // Yellow callout with document summary
    const docLabel = analysis.sourceDocuments.join(', ');
    blocks.push({
      type: 'callout',
      callout: {
        icon: { type: 'emoji', emoji: '💡' },
        color: 'yellow_background',
        rich_text: [
          {
            type: 'text',
            text: {
              content: `Com base em ${analysis.sourceDocuments.length} documentos: ${docLabel}`,
            },
          },
        ],
      },
    });

    // Convert integrated analysis content to Notion blocks
    // Remove leading ## or # headers from Markdown to avoid duplicate headings
    const cleanIntegratedAnalysis = analysis.integratedAnalysis.replace(/^#+\s+[^\n]*\n?/gm, '').trim();
    const integratedBlocks = markdownToNotionBlocks(cleanIntegratedAnalysis);
    blocks.push(...integratedBlocks);

    blocks.push({ type: 'divider', divider: {} });

    // 5. Checklists section (Task 6.4 — maintained from Story 2.4)
    blocks.push({
      type: 'heading_1',
      heading_1: {
        rich_text: [
          { type: 'text', text: { content: '✅ Checklists de Ações' } },
        ],
      },
    });

    for (const item of analysis.practicalChecklist) {
      blocks.push({
        type: 'to_do',
        to_do: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: `[${item.priority}] ${item.action}${item.sector ? ` (${item.sector})` : ''}`,
              },
            },
          ],
          checked: false,
        },
      });
    }

    try {
      const pageId = await this.notionClient.createPage(clientPageId, title, blocks);
      const notionUrl = this.formatNotionUrl(pageId);

      // Extract client metadata from integrated analysis
      const clientMetadata = await MetadataExtractor.extractClientMetadata(
        analysis.integratedAnalysis
      );

      // Auto-fill client properties
      let fillResult: { updated: string[]; conflicted: any[]; pageId: string } = {
        updated: [],
        conflicted: [],
        pageId: clientPageId,
      };
      let shouldWarnConflicts = false;

      try {
        fillResult = await this.clientProfileService.fillProperties(
          clientPageId,
          clientMetadata
        );
        shouldWarnConflicts = fillResult.conflicted.length > 0;

        // Store pending conflicts in context if any
        if (shouldWarnConflicts) {
          const sessionId = 'default'; // TODO: get from context
          contextStore.setPendingConflicts(sessionId, {
            pageId: clientPageId,
            metadata: clientMetadata as Record<string, unknown>,
            conflicts: fillResult.conflicted,
          });
        }
      } catch (fillError) {
        console.error('Error filling properties:', fillError);
        // Non-blocking — continue with plan creation
      }

      // Record history entry with all source documents
      try {
        await this.historyService.appendEntry(clientPageId, {
          type: 'PLANO_DE_ATAQUE',
          date: new Date(),
          documents: analysis.sourceDocuments,
          pageLink: notionUrl,
        });
      } catch (historyError) {
        console.warn('Failed to append to history:', historyError);
        // Non-blocking — don't fail the main operation
      }

      return pageId;
    } catch (error) {
      throw new AppError(
        'Failed to create Notion page',
        'NOTION_001',
        { statusCode: 500, cause: error }
      );
    }
  }

  formatNotionUrl(pageId: string): string {
    // Remove dashes from UUID and format as Notion URL
    return `https://notion.so/${pageId.replace(/-/g, '')}`;
  }
}
