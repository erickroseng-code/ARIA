import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlanOfAttackService } from './PlanOfAttackService';
import type { GeneratedAnalysis } from '@aria/shared';

describe('PlanOfAttackService', () => {
  let mockNotionClient: any;
  let planService: PlanOfAttackService;

  beforeEach(() => {
    mockNotionClient = {
      createPage: vi.fn().mockResolvedValue('page-123-456'),
    };
    planService = new PlanOfAttackService(mockNotionClient);

    // Mock the HistoryService's appendEntry method
    vi.spyOn(planService['historyService'], 'appendEntry').mockResolvedValue(undefined);
  });

  const createMockAnalysis = (overrides?: Partial<GeneratedAnalysis>): GeneratedAnalysis => ({
    clientName: 'Test Client',
    sections: [
      {
        label: 'Setor Comercial',
        sectorType: 'comercial',
        content: '## Análise\nConteúdo do setor comercial',
      },
      {
        label: 'Marketing',
        sectorType: 'marketing',
        content: '## Análise\nConteúdo do marketing',
      },
    ],
    integratedAnalysis: '## Análise Integrada\nSinergias e gaps identificados',
    practicalChecklist: [
      { action: 'Revisar plano comercial', priority: 'alta', sector: 'comercial' },
      { action: 'Atualizar estratégia', priority: 'média' },
    ],
    generatedAt: new Date(),
    sourceDocuments: ['Setor Comercial', 'Marketing'],
    ...overrides,
  });

  describe('createPlanPage', () => {
    it('should create a plan page with multi-section structure', async () => {
      const analysis = createMockAnalysis();
      const result = await planService.createPlanPage('client-id', analysis);

      expect(result).toBe('page-123-456');
      expect(mockNotionClient.createPage).toHaveBeenCalledWith(
        'client-id',
        expect.stringContaining('🎯'),
        expect.any(Array)
      );
    });

    it('should include date in page title', async () => {
      const analysis = createMockAnalysis();
      await planService.createPlanPage('client-id', analysis);

      const callArgs = mockNotionClient.createPage.mock.calls[0];
      expect(callArgs[1]).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    it('should include source documents count and labels in header', async () => {
      const analysis = createMockAnalysis();
      await planService.createPlanPage('client-id', analysis);

      const callArgs = mockNotionClient.createPage.mock.calls[0];
      const blocks = callArgs[2];
      const firstBlock = blocks[0];

      expect(firstBlock.paragraph.rich_text[0].text.content).toContain('2 documentos analisados');
    });

    it('should create heading_2 sections for each document', async () => {
      const analysis = createMockAnalysis();
      await planService.createPlanPage('client-id', analysis);

      const callArgs = mockNotionClient.createPage.mock.calls[0];
      const blocks = callArgs[2];
      const headingBlocks = blocks.filter((b: any) => b.type === 'heading_2');

      expect(headingBlocks.length).toBeGreaterThanOrEqual(2);
      expect(headingBlocks[0].heading_2.rich_text[0].text.content).toContain('📄 Setor Comercial');
      expect(headingBlocks[1].heading_2.rich_text[0].text.content).toContain('📄 Marketing');
    });

    it('should include integrated analysis section with callout', async () => {
      const analysis = createMockAnalysis();
      await planService.createPlanPage('client-id', analysis);

      const callArgs = mockNotionClient.createPage.mock.calls[0];
      const blocks = callArgs[2];
      const calloutBlocks = blocks.filter((b: any) => b.type === 'callout');

      expect(calloutBlocks.length).toBeGreaterThan(0);
      expect(calloutBlocks[0].callout.rich_text[0].text.content).toContain('Com base em 2 documentos');
    });

    it('should include checklist items from analysis', async () => {
      const analysis = createMockAnalysis();
      await planService.createPlanPage('client-id', analysis);

      const callArgs = mockNotionClient.createPage.mock.calls[0];
      const blocks = callArgs[2];
      const todoBlocks = blocks.filter((b: any) => b.type === 'to_do');

      expect(todoBlocks.length).toBe(2);
      expect(todoBlocks[0].to_do.rich_text[0].text.content).toContain('Revisar plano comercial');
    });

    it('should attempt to append to history with source documents', async () => {
      const analysis = createMockAnalysis();
      await planService.createPlanPage('client-id', analysis);

      expect(planService['historyService'].appendEntry).toHaveBeenCalledWith(
        'client-id',
        expect.objectContaining({
          type: 'PLANO_DE_ATAQUE',
          date: expect.any(Date),
          documents: ['Setor Comercial', 'Marketing'],
          pageLink: expect.any(String),
        })
      );
    });

    it('should not fail if appendToHistory fails', async () => {
      vi.spyOn(planService['historyService'], 'appendEntry').mockRejectedValueOnce(new Error('Append failed'));
      const analysis = createMockAnalysis();

      const result = await planService.createPlanPage('client-id', analysis);

      expect(result).toBe('page-123-456');
      // Verify the error was caught and logged
      expect(planService['historyService'].appendEntry).toHaveBeenCalled();
    });

    it('should throw AppError on createPage failure', async () => {
      mockNotionClient.createPage.mockRejectedValueOnce(new Error('API Error'));
      const analysis = createMockAnalysis();

      await expect(planService.createPlanPage('client-id', analysis)).rejects.toThrow(/NOTION_001|Failed to create Notion page/);
    });

    it('should throw AppError for invalid client page ID', async () => {
      const analysis = createMockAnalysis();

      await expect(planService.createPlanPage('', analysis)).rejects.toThrow('Invalid client page ID');
    });

    it('should handle single document analysis', async () => {
      const singleDocAnalysis = createMockAnalysis({
        sections: [
          {
            label: 'Único Documento',
            sectorType: 'comercial',
            content: 'Conteúdo único',
          },
        ],
        sourceDocuments: ['Único Documento'],
      });

      const result = await planService.createPlanPage('client-id', singleDocAnalysis);

      expect(result).toBe('page-123-456');
      const callArgs = mockNotionClient.createPage.mock.calls[0];
      const blocks = callArgs[2];
      const heading2Blocks = blocks.filter((b: any) => b.type === 'heading_2');

      expect(heading2Blocks.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle three documents (Story 2.6 example)', async () => {
      const threeDocAnalysis = createMockAnalysis({
        sections: [
          {
            label: 'Setor Comercial',
            sectorType: 'comercial',
            content: 'Análise comercial',
          },
          {
            label: 'Setor Marketing',
            sectorType: 'marketing',
            content: 'Análise marketing',
          },
          {
            label: 'RH',
            sectorType: 'rh',
            content: 'Análise RH',
          },
        ],
        sourceDocuments: ['Setor Comercial', 'Setor Marketing', 'RH'],
      });

      await planService.createPlanPage('client-id', threeDocAnalysis);

      const callArgs = mockNotionClient.createPage.mock.calls[0];
      const blocks = callArgs[2];
      const heading2Blocks = blocks.filter((b: any) => b.type === 'heading_2');

      expect(heading2Blocks.length).toBe(3);
      expect(blocks[0].paragraph.rich_text[0].text.content).toContain('3 documentos');
    });
  });

  describe('formatNotionUrl', () => {
    it('should format UUID to Notion URL', () => {
      const pageId = '123e4567-e89b-12d3-a456-426614174000';
      const url = planService.formatNotionUrl(pageId);

      expect(url).toBe('https://notion.so/123e4567e89b12d3a456426614174000');
    });

    it('should remove all dashes from UUID', () => {
      const pageId = 'abc-def-ghi-jkl';
      const url = planService.formatNotionUrl(pageId);

      expect(url).not.toContain('-');
      expect(url).toContain('abcdefghijkl');
    });

    it('should prepend notion.so domain', () => {
      const pageId = 'test-page-id';
      const url = planService.formatNotionUrl(pageId);

      expect(url).toMatch(/^https:\/\/notion\.so\//);
    });
  });
});
