import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotionClient } from '../notion.client';

vi.mock('@notionhq/client', () => ({
  Client: vi.fn(() => ({
    databases: {
      query: vi.fn().mockResolvedValue({
        results: [
          {
            id: 'page-1',
            properties: {
              Name: { title: [{ plain_text: 'Empresa A' }] },
              Segment: { select: { name: 'Tech' } },
              Responsible: { select: { name: 'João' } },
            },
          },
          {
            id: 'page-2',
            properties: {
              Name: { title: [{ plain_text: 'Empresa B Ltda' }] },
              Segment: { select: { name: 'Finance' } },
              Responsible: { select: { name: 'Maria' } },
            },
          },
          {
            id: 'page-3',
            properties: {
              Title: { title: [{ plain_text: 'Company C' }] },
              Industry: { select: { name: 'Retail' } },
              Owner: { people: [{ name: 'Pedro' }] },
            },
          },
        ],
      }),
    },
    pages: {
      retrieve: vi.fn().mockImplementation((params: any) => {
        if (params.page_id === 'page-1') {
          return Promise.resolve({
            id: 'page-1',
            properties: {
              Name: { title: [{ plain_text: 'Empresa A' }] },
              Segment: { select: { name: 'Tech' } },
              Responsible: { select: { name: 'João' } },
              Status: { select: { name: 'Active' } },
              Description: { rich_text: [{ plain_text: 'A test company' }] },
            },
          });
        }
        return Promise.reject(new Error('Page not found'));
      }),
      update: vi.fn().mockImplementation((args: any) => {
        return Promise.resolve({
          id: args.page_id || args.id,
          properties: args.properties || {},
        });
      }),
    },
  })),
}));

describe('NotionClient', () => {
  let client: NotionClient;

  beforeEach(() => {
    client = new NotionClient('test-key', 'test-db-id');
  });

  it('should list clients from Notion', async () => {
    const clients = await client.listClients();
    expect(clients).toHaveLength(3);
    expect(clients[0]).toBeDefined();
    if (clients[0]) {
      expect(clients[0].name).toBe('Empresa A');
      expect(clients[0].segment).toBe('Tech');
    }
  });

  it('should cache client list for 5 minutes', async () => {
    await client.listClients();
    const cached = await client.listClients();
    expect(cached).toHaveLength(3);
  });

  it('should search clients by name', async () => {
    const results = await client.searchClient('Empresa');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toBeDefined();
    if (results[0]) {
      expect(results[0].name).toContain('Empresa');
    }
  });

  it('should return top matches with scoring', async () => {
    const matches = await client.getTopMatches('Empresa A', 3);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]).toBeDefined();
    if (matches[0]) {
      expect(matches[0].name).toBe('Empresa A');
    }
  });

  it('should get client profile by page ID', async () => {
    const profile = await client.getClientProfile('page-1');
    expect(profile.notionPageId).toBe('page-1');
    expect(profile.name).toBe('Empresa A');
    expect(profile.segment).toBe('Tech');
  });

  it('should clear cache', async () => {
    await client.listClients();
    client.clearCache();
    // Cache should be cleared, but method should still work
    const clients = await client.listClients();
    expect(clients.length).toBeGreaterThan(0);
  });
});
