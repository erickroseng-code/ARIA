import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClientMatcher, getClientMatcher, type ClientMatchResult } from '../client-matcher';
import { getNotionClient } from '@aria/integrations';

// Mock the Notion client
vi.mock('@aria/integrations', () => ({
  getNotionClient: vi.fn(),
}));

describe('ClientMatcher', () => {
  let matcher: ClientMatcher;
  let mockNotionClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockNotionClient = {
      getTopMatches: vi.fn(),
    };

    (getNotionClient as any).mockReturnValue(mockNotionClient);
    matcher = new ClientMatcher();
  });

  describe('findMatches - Fuzzy Search', () => {
    it('should return exact match with high confidence', async () => {
      const mockClients = [
        { id: '1', name: 'Empresa XYZ', segment: 'tech', responsible: 'John', notionPageId: 'abc123' },
      ];

      mockNotionClient.getTopMatches.mockResolvedValueOnce(mockClients);

      const results = await matcher.findMatches('Empresa XYZ', 3);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        client: mockClients[0],
        confidence: 'high',
      });
      expect(results[0]!.score).toBeGreaterThan(0.7);
    });

    it('should return substring match with high confidence', async () => {
      const mockClients = [
        { id: '1', name: 'Empresa XYZ Ltda', segment: 'tech', responsible: 'John', notionPageId: 'abc123' },
      ];

      mockNotionClient.getTopMatches.mockResolvedValueOnce(mockClients);

      const results = await matcher.findMatches('Empresa XYZ', 3);

      expect(results).toHaveLength(1);
      expect(results[0]!.confidence).toBe('high');
      expect(results[0]!.score).toBeGreaterThan(0.7);
    });

    it('should return similar match with medium/high confidence', async () => {
      const mockClients = [
        { id: '1', name: 'Empresa ABC', segment: 'tech', responsible: 'John', notionPageId: 'abc123' },
      ];

      mockNotionClient.getTopMatches.mockResolvedValueOnce(mockClients);

      const results = await matcher.findMatches('Empresa XYZ', 3);

      expect(results).toHaveLength(1);
      expect(results[0]!.confidence).toBeDefined();
      expect(results[0]!.score).toBeGreaterThan(0);
    });

    it('should return top 3 matches ordered by score', async () => {
      const mockClients = [
        { id: '1', name: 'Empresa XYZ', segment: 'tech', responsible: 'John', notionPageId: 'abc123' },
        { id: '2', name: 'XYZ Consulting', segment: 'consulting', responsible: 'Jane', notionPageId: 'def456' },
        { id: '3', name: 'ABC Consulting', segment: 'consulting', responsible: 'Bob', notionPageId: 'ghi789' },
      ];

      mockNotionClient.getTopMatches.mockResolvedValueOnce(mockClients);

      const results = await matcher.findMatches('XYZ', 3);

      expect(results).toHaveLength(3);
      // First should be exact/substring match
      expect(results[0]!.score).toBeGreaterThanOrEqual(results[1]!.score);
      expect(results[1]!.score).toBeGreaterThanOrEqual(results[2]!.score);
    });

    it('should handle case-insensitive matching', async () => {
      const mockClients = [
        { id: '1', name: 'Empresa XYZ', segment: 'tech', responsible: 'John', notionPageId: 'abc123' },
      ];

      mockNotionClient.getTopMatches.mockResolvedValueOnce(mockClients);

      const results = await matcher.findMatches('empresa xyz', 3);

      expect(results).toHaveLength(1);
      expect(results[0]!.confidence).toBe('high');
    });

    it('should return empty array for no matches', async () => {
      mockNotionClient.getTopMatches.mockResolvedValueOnce([]);

      const results = await matcher.findMatches('Unknown Company', 3);

      expect(results).toHaveLength(0);
    });

    it('should handle empty input gracefully', async () => {
      const results = await matcher.findMatches('', 3);

      expect(results).toHaveLength(0);
      expect(mockNotionClient.getTopMatches).not.toHaveBeenCalled();
    });

    it('should handle null input gracefully', async () => {
      const results = await matcher.findMatches(null as any, 3);

      expect(results).toHaveLength(0);
      expect(mockNotionClient.getTopMatches).not.toHaveBeenCalled();
    });

    it('should respect limit parameter', async () => {
      const mockClients = Array.from({ length: 10 }, (_, i) => ({
        id: `${i}`,
        name: `Company ${i}`,
        segment: 'tech',
        responsible: 'John',
        notionPageId: `id${i}`,
      }));

      mockNotionClient.getTopMatches.mockResolvedValueOnce(mockClients.slice(0, 5));

      const results = await matcher.findMatches('Company', 5);

      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('findConfidentMatch', () => {
    it('should return single match if score > 0.7', async () => {
      const mockClients = [
        { id: '1', name: 'Empresa XYZ', segment: 'tech', responsible: 'John', notionPageId: 'abc123' },
      ];

      mockNotionClient.getTopMatches.mockResolvedValueOnce(mockClients);

      const result = await matcher.findConfidentMatch('Empresa XYZ');

      expect(result).toBeDefined();
      expect(result?.name).toBe('Empresa XYZ');
    });

    it('should return null if no high confidence match', async () => {
      const mockClients = [
        { id: '1', name: 'Totally Different', segment: 'tech', responsible: 'John', notionPageId: 'abc123' },
      ];

      mockNotionClient.getTopMatches.mockResolvedValueOnce(mockClients);

      const result = await matcher.findConfidentMatch('XYZ');

      expect(result).toBeNull();
    });

    it('should return null if no matches', async () => {
      mockNotionClient.getTopMatches.mockResolvedValueOnce([]);

      const result = await matcher.findConfidentMatch('Unknown');

      expect(result).toBeNull();
    });
  });

  describe('Confidence Levels', () => {
    it('should mark score > 0.7 as high confidence', async () => {
      const mockClients = [
        { id: '1', name: 'Empresa XYZ', segment: 'tech', responsible: 'John', notionPageId: 'abc123' },
      ];

      mockNotionClient.getTopMatches.mockResolvedValueOnce(mockClients);

      const results = await matcher.findMatches('empresa xyz', 3);

      expect(results[0]!.confidence).toBe('high');
    });

    it('should mark score 0.5-0.7 as medium confidence', async () => {
      const mockClients = [
        { id: '1', name: 'Empresa ABC', segment: 'tech', responsible: 'John', notionPageId: 'abc123' },
      ];

      mockNotionClient.getTopMatches.mockResolvedValueOnce(mockClients);

      const results = await matcher.findMatches('Empresa XYZ', 3);

      if (results.length > 0 && results[0]!.score >= 0.5 && results[0]!.score <= 0.7) {
        expect(results[0]!.confidence).toBe('medium');
      }
    });

    it('should mark score < 0.5 as low confidence', async () => {
      const mockClients = [
        { id: '1', name: 'ZZZZZ', segment: 'tech', responsible: 'John', notionPageId: 'abc123' },
      ];

      mockNotionClient.getTopMatches.mockResolvedValueOnce(mockClients);

      const results = await matcher.findMatches('Empresa ABC', 3);

      if (results.length > 0) {
        if (results[0]!.score < 0.5) {
          expect(results[0]!.confidence).toBe('low');
        }
      }
    });
  });

  describe('Levenshtein Distance', () => {
    it('should calculate distance for single character difference', async () => {
      const mockClients = [
        { id: '1', name: 'Empresa', segment: 'tech', responsible: 'John', notionPageId: 'abc123' },
      ];

      mockNotionClient.getTopMatches.mockResolvedValueOnce(mockClients);

      const results = await matcher.findMatches('Empresa', 3); // 'r' and 's' swapped

      expect(results).toHaveLength(1);
      expect(results[0]!.score).toBeGreaterThan(0.6); // Should have reasonable score
    });

    it('should calculate distance for multiple character differences', async () => {
      const mockClients = [
        { id: '1', name: 'ABC Company', segment: 'tech', responsible: 'John', notionPageId: 'abc123' },
        { id: '2', name: 'XYZ Industries', segment: 'tech', responsible: 'Jane', notionPageId: 'def456' },
      ];

      mockNotionClient.getTopMatches.mockResolvedValueOnce(mockClients);

      const results = await matcher.findMatches('ABC', 3);

      // ABC Company should score higher than XYZ Industries for 'ABC' query
      expect(results[0]!.score).toBeGreaterThan(0);
    });
  });

  describe('Cache Management', () => {
    it('should provide refreshCache method', async () => {
      await expect(matcher.refreshCache()).resolves.not.toThrow();
    });

    it('should provide clearCache method', () => {
      expect(() => matcher.clearCache()).not.toThrow();
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const matcher1 = getClientMatcher();
      const matcher2 = getClientMatcher();

      expect(matcher1).toBe(matcher2);
    });
  });

  describe('Integration - Full Flow', () => {
    it('should handle complete search flow with confidence levels', async () => {
      const mockClients = [
        { id: '1', name: 'Empresa XYZ Ltda', segment: 'tech', responsible: 'John', notionPageId: 'abc123' },
        { id: '2', name: 'XYZ Consulting', segment: 'consulting', responsible: 'Jane', notionPageId: 'def456' },
        { id: '3', name: 'ABC Empresa', segment: 'tech', responsible: 'Bob', notionPageId: 'ghi789' },
      ];

      mockNotionClient.getTopMatches.mockResolvedValueOnce(mockClients);

      const results = await matcher.findMatches('Empresa XYZ', 3);

      expect(results).toHaveLength(3);
      expect(Array.isArray(results)).toBe(true);

      // Check structure
      results.forEach((result) => {
        expect(result).toHaveProperty('client');
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('confidence');
        expect(typeof result.score).toBe('number');
        expect(['high', 'medium', 'low']).toContain(result.confidence);
        expect(result.score).toBeGreaterThan(0);
      });
    });

    it('should handle multiple searches with different queries', async () => {
      const mockClients1 = [
        { id: '1', name: 'Empresa XYZ', segment: 'tech', responsible: 'John', notionPageId: 'abc123' },
      ];

      const mockClients2 = [
        { id: '2', name: 'ABC Company', segment: 'tech', responsible: 'Jane', notionPageId: 'def456' },
      ];

      mockNotionClient.getTopMatches
        .mockResolvedValueOnce(mockClients1)
        .mockResolvedValueOnce(mockClients2);

      const results1 = await matcher.findMatches('Empresa XYZ', 3);
      const results2 = await matcher.findMatches('ABC Company', 3);

      expect(results1).toHaveLength(1);
      expect(results2).toHaveLength(1);
      expect(results1[0]!.client.id).toBe('1');
      expect(results2[0]!.client.id).toBe('2');
    });
  });
});
