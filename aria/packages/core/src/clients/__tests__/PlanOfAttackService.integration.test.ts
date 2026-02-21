import { describe, it, expect } from 'vitest';
import { PlanOfAttackService } from '../PlanOfAttackService';

// Create a simple mock NotionClient for testing
class MockNotionClient {
  async createPage() {
    return 'page-id-123';
  }

  formatNotionUrl(pageId: string) {
    return `https://notion.so/${pageId.replace(/-/g, '')}`;
  }
}

describe('PlanOfAttackService', () => {
  it('should format Notion URL correctly', () => {
    const mockClient = new MockNotionClient() as any;
    const service = new PlanOfAttackService(mockClient);
    const pageId = '550e8400-e29b-41d4-a716-446655440000';
    const url = service.formatNotionUrl(pageId);

    expect(url).toBe('https://notion.so/550e8400e29b41d4a716446655440000');
    expect(url).not.toContain('-');
  });
});
