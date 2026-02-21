import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientProfileService } from '../ClientProfileService';
import type { ClientMetadata } from '@aria/shared';

// Mock NotionClient
const mockNotionClient = {
  getPageProperties: vi.fn(),
  updatePageProperties: vi.fn(),
};

describe('ClientProfileService', () => {
  let service: ClientProfileService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ClientProfileService(mockNotionClient as any);
  });

  describe('fillProperties', () => {
    it('should update empty fields', async () => {
      mockNotionClient.getPageProperties.mockResolvedValue({
        'Responsável Comercial': { type: 'rich_text', value: '' },
        'Segmento': { type: 'select', value: '' },
      });

      const metadata: ClientMetadata = {
        responsavel_comercial: 'João Silva',
        segmento: 'Varejo',
      };

      const result = await service.fillProperties('page123', metadata);

      expect(result.updated).toContain('responsavel_comercial');
      expect(result.updated).toContain('segmento');
      expect(result.conflicted).toHaveLength(0);
      expect(mockNotionClient.updatePageProperties).toHaveBeenCalled();
    });

    it('should detect conflicts when field already has value', async () => {
      mockNotionClient.getPageProperties.mockResolvedValue({
        'Responsável Comercial': { type: 'rich_text', value: 'Maria Santos' },
      });

      const metadata: ClientMetadata = {
        responsavel_comercial: 'João Silva',
      };

      const result = await service.fillProperties('page123', metadata);

      expect(result.conflicted).toHaveLength(1);
      expect(result.conflicted[0]).toEqual({
        field: 'responsavel_comercial',
        notionPropName: 'Responsável Comercial',
        existing: 'Maria Santos',
        incoming: 'João Silva',
      });
      expect(result.updated).toHaveLength(0);
    });

    it('should skip empty metadata values', async () => {
      mockNotionClient.getPageProperties.mockResolvedValue({});

      const metadata: ClientMetadata = {
        responsavel_comercial: undefined,
        segmento: '',
      };

      const result = await service.fillProperties('page123', metadata);

      expect(result.updated).toHaveLength(0);
      expect(result.conflicted).toHaveLength(0);
    });

    it('should handle array metadata for rich_text fields', async () => {
      mockNotionClient.getPageProperties.mockResolvedValue({
        'Metas': { type: 'rich_text', value: '' },
      });

      const metadata: ClientMetadata = {
        metas: ['Aumentar vendas', 'Expandir mercado'],
      };

      const result = await service.fillProperties('page123', metadata);

      expect(result.updated).toContain('metas');
      expect(mockNotionClient.updatePageProperties).toHaveBeenCalledWith(
        'page123',
        expect.objectContaining({
          'Metas': {
            type: 'rich_text',
            value: 'Aumentar vendas\nExpandir mercado',
          },
        })
      );
    });
  });

  describe('forceUpdateAll', () => {
    it('should update all fields regardless of conflicts', async () => {
      const metadata: ClientMetadata = {
        responsavel_comercial: 'João Silva',
        responsavel_marketing: 'Maria Santos',
        segmento: 'Varejo',
      };

      const result = await service.forceUpdateAll('page123', metadata);

      expect(result.updated.length).toBe(3);
      expect(result.conflicted).toHaveLength(0);
      expect(mockNotionClient.updatePageProperties).toHaveBeenCalled();
    });

    it('should skip empty values even in forceUpdateAll', async () => {
      const metadata: ClientMetadata = {
        responsavel_comercial: 'João',
        segmento: '',
      };

      const result = await service.forceUpdateAll('page123', metadata);

      expect(result.updated).toEqual(['responsavel_comercial']);
    });
  });
});
