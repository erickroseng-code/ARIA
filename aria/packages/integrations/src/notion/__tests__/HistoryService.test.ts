import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HistoryService } from '../HistoryService';
import type { HistoryEntry } from '@aria/shared';

// Mock NotionClient
const mockNotionClient = {
  client: {
    blocks: {
      children: {
        list: vi.fn(),
        append: vi.fn(),
      },
    },
  },
};

describe('HistoryService', () => {
  let service: HistoryService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new HistoryService(mockNotionClient as any);
  });

  describe('appendEntry', () => {
    it('should append entry after existing "Histórico" heading', async () => {
      const mockBlocks = {
        results: [
          {
            type: 'heading_2',
            id: 'heading-123',
            heading_2: {
              rich_text: [{ plain_text: '📋 Histórico' }],
            },
          },
        ],
      };

      mockNotionClient.client.blocks.children.list.mockResolvedValue(mockBlocks);

      const entry: HistoryEntry = {
        type: 'PLANO_DE_ATAQUE',
        date: new Date('2026-02-20'),
        documents: ['doc1.pdf', 'doc2.docx'],
        pageLink: 'https://notion.so/page123',
      };

      await service.appendEntry('page123', entry);

      expect(mockNotionClient.client.blocks.children.list).toHaveBeenCalledWith({
        block_id: 'page123',
      });

      expect(mockNotionClient.client.blocks.children.append).toHaveBeenCalledWith({
        block_id: 'heading-123',
        children: expect.arrayContaining([
          expect.objectContaining({ type: 'divider' }),
          expect.objectContaining({ type: 'callout' }),
        ]),
      });
    });

    it('should create new "Histórico" section if heading not found', async () => {
      const mockBlocks = {
        results: [
          {
            type: 'heading_1',
            id: 'other-heading',
            heading_1: {
              rich_text: [{ plain_text: 'Other Section' }],
            },
          },
        ],
      };

      mockNotionClient.client.blocks.children.list.mockResolvedValue(mockBlocks);

      const entry: HistoryEntry = {
        type: 'DOCUMENTO_PROCESSADO',
        date: new Date('2026-02-20'),
        documents: ['doc.pdf'],
      };

      await service.appendEntry('page123', entry);

      expect(mockNotionClient.client.blocks.children.append).toHaveBeenCalledWith({
        block_id: 'page123',
        children: expect.arrayContaining([
          expect.objectContaining({
            type: 'heading_2',
            heading_2: {
              rich_text: expect.arrayContaining([
                expect.objectContaining({
                  text: { content: '📋 Histórico' },
                }),
              ]),
            },
          }),
        ]),
      });
    });

    it('should format callout block correctly', async () => {
      mockNotionClient.client.blocks.children.list.mockResolvedValue({ results: [] });

      const entry: HistoryEntry = {
        type: 'PLANO_DE_ATAQUE',
        date: new Date('2026-02-20'),
        documents: ['file.pdf'],
        pageLink: 'https://notion.so/abc123',
        notes: 'Test notes',
      };

      await service.appendEntry('page123', entry);

      const callArgs = mockNotionClient.client.blocks.children.append.mock.calls[0][0];
      const calloutBlock = (callArgs.children as any[]).find((b) => b.type === 'callout');

      expect(calloutBlock).toBeDefined();
      expect(calloutBlock.callout.icon).toEqual({ type: 'emoji', emoji: '📋' });
      expect(calloutBlock.callout.color).toBe('blue_background');
      expect(calloutBlock.callout.rich_text).toBeDefined();
    });

    it('should handle missing document list gracefully', async () => {
      mockNotionClient.client.blocks.children.list.mockResolvedValue({ results: [] });

      const entry: HistoryEntry = {
        type: 'REUNIAO',
        date: new Date('2026-02-20'),
        documents: [],
      };

      await service.appendEntry('page123', entry);

      expect(mockNotionClient.client.blocks.children.append).toHaveBeenCalled();
    });
  });
});
