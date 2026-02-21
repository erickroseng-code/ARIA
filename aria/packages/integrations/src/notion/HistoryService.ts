import type { HistoryEntry } from '@aria/shared';
import type { NotionBlock } from './notion.types';
import { NotionClient } from './notion.client';

export class HistoryService {
  constructor(private notion: NotionClient) {}

  async appendEntry(clientPageId: string, entry: HistoryEntry): Promise<void> {
    try {
      // Get children blocks of the client page
      const blocks = await (this.notion as any).client.blocks.children.list({
        block_id: clientPageId,
      });

      // Find the "Histórico" heading
      let historyHeadingId: string | undefined;
      const results = blocks.results as unknown[] | undefined;

      if (results) {
        for (const block of results) {
          const b = block as Record<string, unknown>;
          const type = b['type'] as string | undefined;

          if (type === 'heading_2') {
            const h2 = b['heading_2'] as Record<string, unknown> | undefined;
            const richText = h2?.['rich_text'] as unknown[] | undefined;
            const text = richText
              ?.map((item) => (item as Record<string, unknown>)?.['plain_text'])
              .join('')
              ?? '';

            if (text.includes('Histórico') || text.includes('📋')) {
              historyHeadingId = b['id'] as string;
              break;
            }
          }
        }
      }

      // Create history entry blocks
      const entryBlocks = this.createHistoryEntryBlocks(entry);

      if (historyHeadingId) {
        // Append after existing "Histórico" heading
        await (this.notion as any).client.blocks.children.append({
          block_id: historyHeadingId,
          children: entryBlocks as any,
        });
      } else {
        // Create new "Histórico" section at the end
        const historyHeading: NotionBlock = {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [
              {
                type: 'text',
                text: { content: '📋 Histórico' },
              },
            ],
          },
        };

        const allBlocks = [historyHeading, ...entryBlocks];
        await (this.notion as any).client.blocks.children.append({
          block_id: clientPageId,
          children: allBlocks as any,
        });
      }
    } catch (error) {
      console.error('Error appending history entry:', error);
      // Non-critical operation, don't throw
    }
  }

  private createHistoryEntryBlocks(entry: HistoryEntry): NotionBlock[] {
    const blocks: NotionBlock[] = [];

    // Add divider before entry
    blocks.push({
      object: 'block',
      type: 'divider',
      divider: {},
    } as unknown as NotionBlock);

    // Format the entry text
    const dateStr = entry.date.toLocaleDateString('pt-BR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const docList = entry.documents.join(', ');
    let entryText = `${this.getTypeEmoji(entry.type)} ${entry.type} — ${dateStr}\n`;
    entryText += `Documentos: ${docList}`;

    if (entry.pageLink) {
      entryText += `\nVer Plano →`;
    }

    if (entry.notes) {
      entryText += `\nNotas: ${entry.notes}`;
    }

    const richText: any[] = [
      {
        type: 'text',
        text: { content: entryText },
      },
    ];

    if (entry.pageLink) {
      richText.push({
        type: 'text',
        text: { content: 'Ver Plano →', link: { url: entry.pageLink } },
      });
    }

    blocks.push({
      object: 'block',
      type: 'callout',
      callout: {
        icon: { type: 'emoji', emoji: '📋' },
        color: 'blue_background',
        rich_text: richText,
      },
    } as unknown as NotionBlock);

    return blocks;
  }

  private getTypeEmoji(type: string): string {
    switch (type) {
      case 'PLANO_DE_ATAQUE':
        return '⚔️';
      case 'DOCUMENTO_PROCESSADO':
        return '📄';
      case 'REUNIAO':
        return '📞';
      default:
        return '📋';
    }
  }
}
