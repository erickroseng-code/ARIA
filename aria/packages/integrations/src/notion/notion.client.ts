import { Client } from '@notionhq/client';
import type { ClientRef, ClientProfile } from '@aria/shared';
import type { NotionBlock } from './notion.types';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export interface NotionPropertyValue {
  type: 'rich_text' | 'select' | 'multi_select' | 'title';
  value: string | string[];
}

export class NotionClient {
  private client: Client;
  private databaseId: string;
  private cache = new Map<string, CacheEntry<ClientRef[]>>();
  private pagePropertiesCache = new Map<string, CacheEntry<Record<string, NotionPropertyValue>>>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly PAGE_PROPERTIES_TTL = 2 * 60 * 1000; // 2 minutes

  constructor(apiKey: string, databaseId: string) {
    this.client = new Client({ auth: apiKey });
    this.databaseId = databaseId;
  }

  async listClients(): Promise<ClientRef[]> {
    // Check cache first
    const cached = this.cache.get('all_clients');
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    try {
      // Use type assertion to access query method (Notion SDK type definitions vary by version)
      const notionDatabases = this.client.databases as unknown as {
        query: (args: { database_id: string; page_size: number }) => Promise<{ results: unknown[] }>;
      };

      const response = await notionDatabases.query({
        database_id: this.databaseId,
        page_size: 100,
      });

      const clients: ClientRef[] = response.results.map((page: unknown) => {
        const p = page as Record<string, unknown>;
        const properties = p['properties'] as Record<string, unknown> | undefined;
        const nameTitle = (properties?.['Name'] as Record<string, unknown> | undefined)?.['title'] as unknown[] | undefined;
        const titleTitle = (properties?.['Title'] as Record<string, unknown> | undefined)?.['title'] as unknown[] | undefined;
        const namePlainText = (nameTitle?.[0] as Record<string, unknown> | undefined)?.['plain_text'] as string | undefined;
        const titlePlainText = (titleTitle?.[0] as Record<string, unknown> | undefined)?.['plain_text'] as string | undefined;

        return {
          notionPageId: p['id'] as string,
          name: namePlainText || titlePlainText || 'Unnamed',
          segment:
            ((properties?.['Segment'] as Record<string, unknown> | undefined)?.['select'] as Record<string, string> | undefined)?.['name'] ||
            ((properties?.['Industry'] as Record<string, unknown> | undefined)?.['select'] as Record<string, string> | undefined)?.['name'] ||
            'General',
          responsible:
            ((properties?.['Responsible'] as Record<string, unknown> | undefined)?.['select'] as Record<string, string> | undefined)?.['name'] ||
            (((properties?.['Owner'] as Record<string, unknown> | undefined)?.['people'] as Record<string, string>[] | undefined)?.[0])?.['name'] ||
            'Unassigned',
        };
      });

      // Cache the results
      this.cache.set('all_clients', {
        data: clients,
        expiresAt: Date.now() + this.CACHE_TTL,
      });

      return clients;
    } catch (error) {
      console.error('Error listing clients from Notion:', error);
      throw new Error('NOTION_001: Failed to list clients');
    }
  }

  async searchClient(name: string): Promise<ClientRef[]> {
    const allClients = await this.listClients();
    const lowerName = name.toLowerCase();

    return allClients.filter((client) =>
      client.name.toLowerCase().includes(lowerName)
    );
  }

  async getTopMatches(
    name: string,
    limit = 3
  ): Promise<ClientRef[]> {
    const allClients = await this.listClients();
    const lowerName = name.toLowerCase();

    // Simple similarity scoring based on substring match
    const scored = allClients.map((client) => {
      const clientNameLower = client.name.toLowerCase();
      let score = 0;

      if (clientNameLower === lowerName) {
        score = 1.0; // Exact match
      } else if (clientNameLower.includes(lowerName)) {
        score = 0.9; // Substring match
      } else if (lowerName.includes(clientNameLower.split(' ')[0] ?? '')) {
        score = 0.7; // Partial word match
      } else {
        // Levenshtein-like simple distance
        const distance = this.levenshteinDistance(
          clientNameLower,
          lowerName
        );
        const maxLen = Math.max(clientNameLower.length, lowerName.length);
        score = Math.max(0, 1 - distance / maxLen);
      }

      return { client, score };
    });

    return scored
      .filter((item) => item.score > 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.client);
  }

  async getClientProfile(pageId: string): Promise<ClientProfile> {
    try {
      const page = await this.client.pages.retrieve({ page_id: pageId });
      const p = page as Record<string, unknown>;
      const properties = p['properties'] as Record<string, unknown> | undefined;

      const nameTitle = (properties?.['Name'] as Record<string, unknown> | undefined)?.['title'] as unknown[] | undefined;
      const titleTitle = (properties?.['Title'] as Record<string, unknown> | undefined)?.['title'] as unknown[] | undefined;
      const namePlainText = (nameTitle?.[0] as Record<string, unknown> | undefined)?.['plain_text'] as string | undefined;
      const titlePlainText = (titleTitle?.[0] as Record<string, unknown> | undefined)?.['plain_text'] as string | undefined;
      const descText = ((properties?.['Description'] as Record<string, unknown> | undefined)?.['rich_text'] as unknown[] | undefined)?.[0];
      const description = (descText as Record<string, string> | undefined)?.['plain_text'] ?? '';

      const status =
        ((properties?.['Status'] as Record<string, unknown> | undefined)?.['select'] as Record<string, string> | undefined)?.['name'] ||
        ((properties?.['State'] as Record<string, unknown> | undefined)?.['select'] as Record<string, string> | undefined)?.['name'] ||
        'Active';

      const result: ClientProfile = {
        notionPageId: pageId,
        name: namePlainText || titlePlainText || 'Unnamed',
        segment:
          ((properties?.['Segment'] as Record<string, unknown> | undefined)?.['select'] as Record<string, string> | undefined)?.['name'] ||
          ((properties?.['Industry'] as Record<string, unknown> | undefined)?.['select'] as Record<string, string> | undefined)?.['name'] ||
          'General',
        responsible:
          ((properties?.['Responsible'] as Record<string, unknown> | undefined)?.['select'] as Record<string, string> | undefined)?.['name'] ||
          (((properties?.['Owner'] as Record<string, unknown> | undefined)?.['people'] as Record<string, string>[] | undefined)?.[0])?.['name'] ||
          'Unassigned',
        status,
        description,
      };

      // Only add metadata if it exists
      if (properties) {
        result.metadata = properties as Record<string, unknown>;
      }

      return result;
    } catch (error) {
      console.error('Error retrieving client profile:', error);
      throw new Error('NOTION_003: Client page not found');
    }
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;

    // Create matrix initialized with 0
    const matrix: number[][] = Array.from({ length: n + 1 }, (_, i) => {
      const row = Array.from({ length: m + 1 }, (__, j) => j);
      row[0] = i;
      return row;
    });

    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        const prevRow = matrix[i - 1];
        const currRow = matrix[i];
        if (!prevRow || !currRow) continue;

        if (str2[i - 1] === str1[j - 1]) {
          currRow[j] = prevRow[j - 1] ?? 0;
        } else {
          const del = prevRow[j] ?? 0;
          const ins = currRow[j - 1] ?? 0;
          const sub = prevRow[j - 1] ?? 0;
          currRow[j] = Math.min(del + 1, ins + 1, sub + 1);
        }
      }
    }

    const lastRow = matrix[n];
    return lastRow ? (lastRow[m] ?? 0) : 0;
  }

  clearCache(): void {
    this.cache.clear();
  }

  async createPage(
    parentPageId: string,
    title: string,
    blocks: NotionBlock[]
  ): Promise<string> {
    const BATCH_SIZE = 100;
    const firstBatch = blocks.slice(0, BATCH_SIZE);
    const remaining = blocks.slice(BATCH_SIZE);

    try {
      // Create page with first 100 blocks
      const page = await this.client.pages.create({
        parent: { page_id: parentPageId },
        properties: {
          title: { title: [{ text: { content: title } }] },
        },
        children: firstBatch as any,
      });

      // Add remaining blocks in batches
      if (remaining.length > 0) {
        for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
          const batch = remaining.slice(i, i + BATCH_SIZE);
          await this.client.blocks.children.append({
            block_id: page.id,
            children: batch as any,
          });
        }
      }

      return page.id;
    } catch (error) {
      console.error('Error creating Notion page:', error);
      throw new Error('NOTION_002: Failed to create page');
    }
  }

  async getPageProperties(pageId: string): Promise<Record<string, NotionPropertyValue>> {
    // Check cache first
    const cached = this.pagePropertiesCache.get(pageId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    try {
      const page = await this.client.pages.retrieve({ page_id: pageId });
      const p = page as Record<string, unknown>;
      const properties = p['properties'] as Record<string, unknown> | undefined;

      const result: Record<string, NotionPropertyValue> = {};

      if (properties) {
        for (const [key, value] of Object.entries(properties)) {
          const prop = value as Record<string, unknown> | undefined;
          if (!prop) continue;

          const type = prop['type'] as string | undefined;

          if (type === 'rich_text') {
            const richText = prop['rich_text'] as unknown[] | undefined;
            const text = richText
              ?.map((item) => (item as Record<string, unknown>)?.['plain_text'])
              .join('')
              ?? '';
            result[key] = { type: 'rich_text', value: text };
          } else if (type === 'select') {
            const select = prop['select'] as Record<string, string> | undefined | null;
            result[key] = { type: 'select', value: select?.['name'] ?? '' };
          } else if (type === 'multi_select') {
            const multiSelect = prop['multi_select'] as Record<string, string>[] | undefined;
            const values = (multiSelect?.map((item) => item['name']) ?? []).filter(
              (v) => v !== undefined
            ) as string[];
            result[key] = { type: 'multi_select', value: values };
          } else if (type === 'title') {
            const title = prop['title'] as unknown[] | undefined;
            const text = title
              ?.map((item) => (item as Record<string, unknown>)?.['plain_text'])
              .join('')
              ?? '';
            result[key] = { type: 'title', value: text };
          }
        }
      }

      // Cache the results
      this.pagePropertiesCache.set(pageId, {
        data: result,
        expiresAt: Date.now() + this.PAGE_PROPERTIES_TTL,
      });

      return result;
    } catch (error) {
      console.error('Error retrieving page properties:', error);
      return {};
    }
  }

  async updatePageProperties(
    pageId: string,
    properties: Record<string, NotionPropertyValue>
  ): Promise<void> {
    try {
      const notionProperties: Record<string, unknown> = {};

      for (const [key, prop] of Object.entries(properties)) {
        if (prop.type === 'rich_text') {
          notionProperties[key] = {
            rich_text: [{ text: { content: String(prop.value) } }],
          };
        } else if (prop.type === 'select') {
          notionProperties[key] = {
            select: { name: String(prop.value) },
          };
        } else if (prop.type === 'multi_select') {
          const values = Array.isArray(prop.value) ? prop.value : [prop.value];
          notionProperties[key] = {
            multi_select: values.map((v) => ({ name: String(v) })),
          };
        } else if (prop.type === 'title') {
          notionProperties[key] = {
            title: [{ text: { content: String(prop.value) } }],
          };
        }
      }

      await this.client.pages.update({
        page_id: pageId,
        properties: notionProperties as any,
      });

      // Invalidate cache for this page
      this.pagePropertiesCache.delete(pageId);
    } catch (error) {
      console.error('Error updating page properties:', error);
      // Non-critical operation, don't throw
    }
  }

  async appendToHistory?(
    _clientPageId: string,
    _entry: { type: string; pageId: string; date: string; documentCount: number }
  ): Promise<void> {
    // Stub implementation for Story 2.5 (AI Document History)
    // Will implement proper history appending logic in a later story
    return Promise.resolve();
  }
}

// Singleton instance
let notionClient: NotionClient | null = null;

export function initializeNotionClient(
  apiKey: string,
  databaseId: string
): NotionClient {
  if (!notionClient) {
    notionClient = new NotionClient(apiKey, databaseId);
  }
  return notionClient;
}

export function getNotionClient(): NotionClient {
  if (!notionClient) {
    throw new Error('NotionClient not initialized. Call initializeNotionClient first.');
  }
  return notionClient;
}
