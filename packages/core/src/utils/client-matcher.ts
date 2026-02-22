/**
 * ClientMatcher: Fuzzy search for clients from Notion database
 * Loads clients from Notion, caches in memory, refreshes every 5 minutes
 */

export interface ClientMatch {
  id: string;
  name: string;
  similarity: number;
  email?: string;
  phone?: string;
}

export interface ClientDatabase {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const SIMILARITY_THRESHOLD_CONFIDENT = 0.7;
const SIMILARITY_THRESHOLD_ASK = 0.5;

export class ClientMatcher {
  private clientCache: ClientDatabase[] = [];
  private lastCacheTime: number = 0;
  private cacheRefreshInterval: NodeJS.Timer | null = null;

  // Mock client loader - would be replaced with actual Notion API call
  private clientLoader: () => Promise<ClientDatabase[]> = async () => {
    return [];
  };

  constructor(clientLoaderFn?: () => Promise<ClientDatabase[]>) {
    if (clientLoaderFn) {
      this.clientLoader = clientLoaderFn;
    }
    this.startAutoRefresh();
  }

  /**
   * Initialize client cache from Notion
   */
  async initialize(): Promise<void> {
    await this.refreshCache();
  }

  /**
   * Start automatic cache refresh every 5 minutes
   */
  private startAutoRefresh(): void {
    this.cacheRefreshInterval = setInterval(
      () => this.refreshCache(),
      CACHE_DURATION_MS
    );
  }

  /**
   * Stop automatic cache refresh
   */
  destroy(): void {
    if (this.cacheRefreshInterval) {
      clearInterval(this.cacheRefreshInterval);
      this.cacheRefreshInterval = null;
    }
  }

  /**
   * Refresh client cache from loader
   */
  async refreshCache(): Promise<void> {
    try {
      this.clientCache = await this.clientLoader();
      this.lastCacheTime = Date.now();
    } catch (error) {
      console.error('Failed to refresh client cache:', error);
    }
  }

  /**
   * Match a client name and return top 3 matches
   * Returns: confident match (>0.7), ask user (0.5-0.7), or no match (<0.5)
   */
  async matchClient(clientName: string): Promise<{
    confidentMatch?: ClientMatch;
    possibleMatches: ClientMatch[];
    matchQuality: 'confident' | 'ambiguous' | 'nomatch';
  }> {
    if (!clientName || clientName.trim().length === 0) {
      return {
        possibleMatches: [],
        matchQuality: 'nomatch',
      };
    }

    // Ensure cache is fresh
    if (Date.now() - this.lastCacheTime > CACHE_DURATION_MS) {
      await this.refreshCache();
    }

    // Calculate similarity for all clients
    const matches = this.clientCache
      .map((client) => ({
        ...client,
        similarity: this.calculateSimilarity(clientName, client.name),
      }))
      .filter((match) => match.similarity >= SIMILARITY_THRESHOLD_ASK)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3); // Top 3 matches

    // Determine match quality
    const topMatch = matches[0];
    let matchQuality: 'confident' | 'ambiguous' | 'nomatch' = 'nomatch';
    let confidentMatch: ClientMatch | undefined;

    if (topMatch && topMatch.similarity >= SIMILARITY_THRESHOLD_CONFIDENT) {
      matchQuality = 'confident';
      confidentMatch = topMatch;
    } else if (topMatch && topMatch.similarity >= SIMILARITY_THRESHOLD_ASK) {
      matchQuality = 'ambiguous';
    }

    return {
      confidentMatch,
      possibleMatches: matches,
      matchQuality,
    };
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance
   * Returns value between 0 (no similarity) and 1 (exact match)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    // Exact match
    if (s1 === s2) {
      return 1;
    }

    // One string is empty
    if (s1.length === 0 || s2.length === 0) {
      return 0;
    }

    // Check for substring match (high similarity)
    if (s1.includes(s2) || s2.includes(s1)) {
      return 0.85;
    }

    // Levenshtein distance
    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    const similarity = 1 - distance / maxLength;

    return Math.max(0, similarity);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Get all cached clients (for fallback or debugging)
   */
  getCachedClients(): ClientDatabase[] {
    return [...this.clientCache];
  }

  /**
   * Manually set cache (for testing)
   */
  setMockClients(clients: ClientDatabase[]): void {
    this.clientCache = clients;
    this.lastCacheTime = Date.now();
  }
}
