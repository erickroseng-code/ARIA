import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClientService } from '../ClientService';
import { ContextStore } from '../../chat/ContextStore';

// Mock integrations
vi.mock('@aria/integrations', () => ({
  getNotionClient: vi.fn(() => ({
    getTopMatches: vi.fn().mockImplementation((name: string) => {
      if (name.toLowerCase() === 'empresa a') {
        return Promise.resolve([
          {
            notionPageId: 'page-1',
            name: 'Empresa A',
            segment: 'Tech',
            responsible: 'João',
          },
        ]);
      }
      if (name.toLowerCase().includes('empresa')) {
        return Promise.resolve([
          {
            notionPageId: 'page-1',
            name: 'Empresa A',
            segment: 'Tech',
            responsible: 'João',
          },
          {
            notionPageId: 'page-2',
            name: 'Empresa B',
            segment: 'Finance',
            responsible: 'Maria',
          },
          {
            notionPageId: 'page-3',
            name: 'Empresa C',
            segment: 'Retail',
            responsible: 'Pedro',
          },
        ]);
      }
      return Promise.resolve([]);
    }),
  })),
}));

describe('ClientService', () => {
  let clientService: ClientService;
  let contextStore: ContextStore;

  beforeEach(() => {
    contextStore = new ContextStore();
    clientService = new ClientService(contextStore);
  });

  it('should handle exact client match', async () => {
    const result = await clientService.handleClientLookup(
      'Empresa A',
      'session-1',
      'user-1'
    );

    expect(result.message).toContain('✅');
    expect(result.requiresSelection).toBe(false);
    expect(result.matches).toHaveLength(1);
  });

  it('should handle multiple client matches', async () => {
    const result = await clientService.handleClientLookup(
      'Empresa',
      'session-1',
      'user-1'
    );

    expect(result.message).toContain('Encontrei');
    expect(result.requiresSelection).toBe(true);
    expect(result.matches.length).toBeGreaterThan(1);
  });

  it('should handle no client matches', async () => {
    const result = await clientService.handleClientLookup(
      'NonExistent',
      'session-1',
      'user-1'
    );

    expect(result.message).toContain('❌');
    expect(result.requiresSelection).toBe(false);
    expect(result.matches).toHaveLength(0);
  });

  it('should confirm client selection', async () => {
    const matches = [
      { notionPageId: 'page-1', name: 'Empresa A', segment: 'Tech', responsible: 'João' },
      { notionPageId: 'page-2', name: 'Empresa B', segment: 'Finance', responsible: 'Maria' },
    ];

    const result = await clientService.confirmClientSelection(1, matches, 'user-1');

    expect(result.success).toBe(true);
    expect(result.message).toContain('✅');
    expect(result.message).toContain('Empresa A');
  });

  it('should reject invalid selection', async () => {
    const matches = [
      { notionPageId: 'page-1', name: 'Empresa A', segment: 'Tech', responsible: 'João' },
    ];

    const result = await clientService.confirmClientSelection(5, matches, 'user-1');

    expect(result.success).toBe(false);
    expect(result.message).toContain('❌');
  });
});
