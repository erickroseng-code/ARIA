import { getNotionClient } from '@aria/integrations';
import type { ClientRef } from '@aria/shared';

export interface ClientMatchResult {
  client: ClientRef;
  score: number; // 0-1, where 1 is exact match
  confidence: 'high' | 'medium' | 'low'; // high: >0.7, medium: 0.5-0.7, low: <0.5
}

/**
 * ClientMatcher - Fuzzy search for clients with caching
 * Loads clients from Notion, caches them in memory, and refreshes every 5 minutes
 */
export class ClientMatcher {
  private cachedClients: ClientRef[] | null = null;
  private lastCacheTime: number = 0;
  private cacheRefreshInterval: number = 5 * 60 * 1000; // 5 minutes in milliseconds
  private notionClient = getNotionClient();

  /**
   * Match client name and return top results
   */
  async findMatches(clientName: string, limit = 3): Promise<ClientMatchResult[]> {
    if (!clientName || typeof clientName !== 'string') {
      return [];
    }

    // Get top matches from Notion client (which already implements fuzzy search)
    const matches = await this.notionClient.getTopMatches(clientName, limit);

    // Convert to ClientMatchResult format with confidence levels
    return matches.map((client) => ({
      client,
      score: this.calculateScore(clientName, client.name),
      confidence: this.getConfidenceLevel(clientName, client.name),
    }));
  }

  /**
   * Get a single confident match, or null if not confident enough
   * Threshold: >0.7 is considered high confidence
   */
  async findConfidentMatch(clientName: string): Promise<ClientRef | null> {
    const matches = await this.findMatches(clientName, 1);

    if (matches.length === 0) {
      return null;
    }

    const topMatch = matches[0];
    if (topMatch && topMatch.confidence === 'high') {
      return topMatch.client;
    }

    return null;
  }

  /**
   * Calculate similarity score between two strings
   * Uses a combination of exact match, substring match, and Levenshtein distance
   */
  private calculateScore(input: string, target: string): number {
    const inputLower = input.toLowerCase().trim();
    const targetLower = target.toLowerCase().trim();

    // Exact match
    if (inputLower === targetLower) {
      return 1.0;
    }

    // Substring match (either direction)
    if (targetLower.includes(inputLower) || inputLower.includes(targetLower)) {
      return 0.9;
    }

    // First word match
    const inputFirstWord = inputLower.split(/\s+/)[0] || '';
    const targetFirstWord = targetLower.split(/\s+/)[0] || '';
    if (inputFirstWord && targetFirstWord && inputFirstWord === targetFirstWord) {
      return 0.8;
    }

    // Levenshtein-based distance
    const distance = this.levenshteinDistance(inputLower, targetLower);
    const maxLen = Math.max(inputLower.length, targetLower.length);
    const similarityScore = Math.max(0, 1 - distance / maxLen);

    return Math.min(1.0, similarityScore);
  }

  /**
   * Calculate Levenshtein distance (edit distance) between two strings
   * Used for fuzzy matching
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    // Initialize first column and row
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix with distances
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2[i - 1] === str1[j - 1]) {
          matrix[i][j] = matrix[i - 1]![j - 1]!;
        } else {
          matrix[i][j] =
            Math.min(
              matrix[i - 1]![j]! + 1, // deletion
              matrix[i]![j - 1]! + 1, // insertion
              matrix[i - 1]![j - 1]! + 1 // substitution
            );
        }
      }
    }

    return matrix[str2.length]![str1.length] || 0;
  }

  /**
   * Determine confidence level based on score
   * high: >0.7, medium: 0.5-0.7, low: <0.5
   */
  private getConfidenceLevel(input: string, target: string): 'high' | 'medium' | 'low' {
    const score = this.calculateScore(input, target);

    if (score > 0.7) {
      return 'high';
    } else if (score >= 0.5) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Refresh cached clients (manual refresh)
   * In real implementation, this would load from Notion database
   */
  async refreshCache(): Promise<void> {
    this.cachedClients = null;
    this.lastCacheTime = 0;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cachedClients = null;
    this.lastCacheTime = 0;
  }
}

// Singleton instance
let clientMatcher: ClientMatcher | null = null;

export function getClientMatcher(): ClientMatcher {
  if (!clientMatcher) {
    clientMatcher = new ClientMatcher();
  }
  return clientMatcher;
}
