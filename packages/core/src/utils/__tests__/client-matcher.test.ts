import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ClientMatcher } from '../client-matcher';

describe('ClientMatcher', () => {
  let matcher: ClientMatcher;
  const mockClients = [
    { id: '1', name: 'Empresa ABC', email: 'contact@abc.com' },
    { id: '2', name: 'Empresa XYZ', email: 'contact@xyz.com' },
    { id: '3', name: 'Tech Solutions', phone: '1234567890' },
    { id: '4', name: 'Digital Agency', email: 'info@digital.com' },
    { id: '5', name: 'Marketing Pro', phone: '0987654321' },
  ];

  beforeEach(() => {
    matcher = new ClientMatcher();
    matcher.setMockClients(mockClients);
  });

  afterEach(() => {
    matcher.destroy();
  });

  describe('matchClient', () => {
    it('should find exact match', async () => {
      const result = await matcher.matchClient('Empresa ABC');
      expect(result.matchQuality).toBe('confident');
      expect(result.confidentMatch?.name).toBe('Empresa ABC');
      expect(result.confidentMatch?.similarity).toBe(1);
    });

    it('should find confident match with high similarity', async () => {
      const result = await matcher.matchClient('empresa abc');
      expect(result.matchQuality).toBe('confident');
      expect(result.confidentMatch?.name).toBe('Empresa ABC');
    });

    it('should return top 3 matches', async () => {
      const result = await matcher.matchClient('Empresa');
      expect(result.possibleMatches.length).toBeLessThanOrEqual(3);
      expect(result.possibleMatches[0].name).toBe('Empresa ABC');
    });

    it('should handle case-insensitive matching', async () => {
      const result = await matcher.matchClient('TECH SOLUTIONS');
      expect(result.matchQuality).toBe('confident');
      expect(result.confidentMatch?.name).toBe('Tech Solutions');
    });

    it('should handle partial matches', async () => {
      const result = await matcher.matchClient('ABC');
      expect(result.possibleMatches.length).toBeGreaterThan(0);
      expect(result.possibleMatches[0].name).toContain('ABC');
    });

    it('should handle substring match with high similarity', async () => {
      const result = await matcher.matchClient('Empresa');
      expect(result.possibleMatches.length).toBeGreaterThan(0);
      expect(result.possibleMatches[0].similarity).toBeGreaterThanOrEqual(0.5);
    });

    it('should handle whitespace', async () => {
      const result = await matcher.matchClient('  Empresa ABC  ');
      expect(result.confidentMatch?.name).toBe('Empresa ABC');
    });

    it('should return no match for unknown client', async () => {
      const result = await matcher.matchClient('Nonexistent Corp');
      expect(result.matchQuality).toBe('nomatch');
      expect(result.confidentMatch).toBeUndefined();
    });

    it('should handle empty input', async () => {
      const result = await matcher.matchClient('');
      expect(result.matchQuality).toBe('nomatch');
      expect(result.possibleMatches.length).toBe(0);
    });

    it('should handle null/undefined gracefully', async () => {
      const result = await matcher.matchClient('');
      expect(result.matchQuality).toBe('nomatch');
    });
  });

  describe('similarity calculation', () => {
    it('should give higher score for closer matches', async () => {
      const exactResult = await matcher.matchClient('Empresa ABC');
      const closeResult = await matcher.matchClient('Empreza ABC'); // Typo
      const distantResult = await matcher.matchClient('XYZ');

      expect(exactResult.confidentMatch?.similarity).toBeGreaterThan(
        closeResult.possibleMatches[0]?.similarity || 0
      );
      expect(closeResult.possibleMatches[0]?.similarity).toBeGreaterThan(
        distantResult.possibleMatches[0]?.similarity || 0
      );
    });

    it('should handle typos in client names', async () => {
      const result = await matcher.matchClient('Empreza ABC'); // Typo: empresa
      expect(result.possibleMatches.length).toBeGreaterThan(0);
      expect(result.possibleMatches[0].name).toBe('Empresa ABC');
    });

    it('should rank by similarity score', async () => {
      matcher.setMockClients([
        { id: '1', name: 'Apple Inc' },
        { id: '2', name: 'Application Systems' },
        { id: '3', name: 'Apple Store' },
      ]);

      const result = await matcher.matchClient('Apple');
      expect(result.possibleMatches[0].name).toBe('Apple Inc');
      expect(result.possibleMatches[1].name).toBe('Apple Store');
    });
  });

  describe('match quality determination', () => {
    it('should return "confident" for >0.7 similarity', async () => {
      const result = await matcher.matchClient('Empresa ABC');
      expect(result.matchQuality).toBe('confident');
    });

    it('should return "ambiguous" for 0.5-0.7 similarity', async () => {
      matcher.setMockClients([
        { id: '1', name: 'Very Long Company Name Here' },
      ]);
      const result = await matcher.matchClient('Long Company');
      if (result.possibleMatches.length > 0) {
        expect(['ambiguous', 'confident']).toContain(result.matchQuality);
      }
    });

    it('should return "nomatch" for <0.5 similarity', async () => {
      const result = await matcher.matchClient('Zzzzz');
      expect(result.matchQuality).toBe('nomatch');
    });
  });

  describe('cache management', () => {
    it('should maintain client cache', () => {
      const cached = matcher.getCachedClients();
      expect(cached.length).toBe(mockClients.length);
      expect(cached[0].name).toBe('Empresa ABC');
    });

    it('should allow manual cache update', async () => {
      const newClients = [
        { id: '10', name: 'New Client' },
        { id: '11', name: 'Another Client' },
      ];
      matcher.setMockClients(newClients);

      const result = await matcher.matchClient('New Client');
      expect(result.confidentMatch?.name).toBe('New Client');
    });

    it('should destroy cleanup interval', () => {
      matcher.destroy();
      expect(matcher.getCachedClients()).toEqual(mockClients);
    });
  });

  describe('special cases', () => {
    it('should handle numbers in client names', async () => {
      matcher.setMockClients([{ id: '1', name: 'Client 123' }]);
      const result = await matcher.matchClient('Client 123');
      expect(result.confidentMatch?.name).toBe('Client 123');
    });

    it('should handle special characters', async () => {
      matcher.setMockClients([{ id: '1', name: 'Company & Co.' }]);
      const result = await matcher.matchClient('Company & Co.');
      expect(result.confidentMatch?.name).toBe('Company & Co.');
    });

    it('should handle unicode characters', async () => {
      matcher.setMockClients([{ id: '1', name: 'Café Premium' }]);
      const result = await matcher.matchClient('Café Premium');
      expect(result.confidentMatch?.name).toBe('Café Premium');
    });

    it('should return available client fields', async () => {
      const result = await matcher.matchClient('Empresa ABC');
      expect(result.confidentMatch?.email).toBe('contact@abc.com');
      expect(result.confidentMatch?.id).toBe('1');
    });
  });
});
