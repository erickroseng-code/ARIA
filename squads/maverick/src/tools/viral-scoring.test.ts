/**
 * Viral Scoring Algorithm Tests
 * Testa o cálculo de viral_score sem dependências externas
 */

describe('Viral Scoring Algorithm', () => {
  /**
   * Implementação do cálculo de viral_score
   * Réplica da lógica do InstagramScraper
   */
  function calculateViralScore(post: { views?: number; likes?: number; comments?: number }): number {
    const views = post.views || 0;
    const likes = post.likes || 0;
    const comments = post.comments || 0;

    if (views === 0) return 0;

    // Score: views + weighted engagement
    const engagementRate = (likes + comments * 2) / views; // comments valem 2x
    const score = Math.log10(views + 1) * (1 + engagementRate * 10);

    return parseFloat(score.toFixed(2));
  }

  describe('calculateViralScore', () => {
    it('deve retornar 0 para post sem views', () => {
      const score = calculateViralScore({ views: 0, likes: 0, comments: 0 });
      expect(score).toBe(0);
    });

    it('deve calcular score baseado em views e engajamento', () => {
      const score = calculateViralScore({ views: 100000, likes: 1000, comments: 500 });
      // log10(100001) ≈ 5.0
      // engagementRate = (1000 + 1000) / 100000 = 0.02
      // score = 5.0 * (1 + 0.02 * 10) = 5.0 * 1.2 = 6.0
      expect(score).toBeGreaterThan(5.5);
      expect(score).toBeLessThan(6.5);
    });

    it('deve favorecer posts com mais engajamento', () => {
      const lowEngagement = calculateViralScore({ views: 100000, likes: 100, comments: 10 });
      const highEngagement = calculateViralScore({ views: 100000, likes: 1000, comments: 500 });

      expect(highEngagement).toBeGreaterThan(lowEngagement);
    });

    it('deve favorecer posts com mais views', () => {
      const lowViews = calculateViralScore({ views: 10000, likes: 100, comments: 10 });
      const highViews = calculateViralScore({ views: 1000000, likes: 100, comments: 10 });

      expect(highViews).toBeGreaterThan(lowViews);
    });

    it('deve pesar comments 2x mais que likes', () => {
      // Post A: 1000 likes, 0 comments
      const postA = calculateViralScore({ views: 100000, likes: 1000, comments: 0 });

      // Post B: 0 likes, 500 comments (equivalente a 1000 likes em peso)
      const postB = calculateViralScore({ views: 100000, likes: 0, comments: 500 });

      // Devem ter scores similares
      expect(Math.abs(postA - postB)).toBeLessThan(0.2);
    });

    it('deve retornar número com 2 casas decimais', () => {
      const score = calculateViralScore({ views: 150000, likes: 1500, comments: 200 });
      const decimalPlaces = score.toString().split('.')[1]?.length || 0;

      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });
  });

  describe('Filtering by Virality', () => {
    it('deve filtrar posts com menos de 100k views', () => {
      const posts = [
        { url: 'low', views: 50000, likes: 100, comments: 10 },
        { url: 'high', views: 150000, likes: 1500, comments: 200 },
      ];

      const viral = posts.filter(p => (p.views || 0) >= 100000);

      expect(viral.length).toBe(1);
      expect(viral[0].url).toBe('high');
    });

    it('deve ordenar por viral_score descendente', () => {
      const posts = [
        { url: 'p1', views: 100000, likes: 500, comments: 50 },
        { url: 'p2', views: 500000, likes: 5000, comments: 500 },
        { url: 'p3', views: 150000, likes: 1500, comments: 200 },
      ];

      const sorted = posts
        .map(p => ({ ...p, score: calculateViralScore(p) }))
        .sort((a, b) => b.score - a.score)
        .map(p => p.url);

      expect(sorted[0]).toBe('p2'); // Maior score
      expect(sorted[2]).toBe('p1'); // Menor score
    });
  });

  describe('Edge Cases', () => {
    it('deve lidar com posts sem engajamento', () => {
      const score = calculateViralScore({ views: 100000, likes: 0, comments: 0 });
      expect(score).toBe(5.0); // log10(100001) ≈ 5.0
    });

    it('deve lidar com valores muito altos', () => {
      const score = calculateViralScore({ views: 10000000, likes: 100000, comments: 50000 });
      expect(score).toBeGreaterThan(0);
      expect(Number.isFinite(score)).toBe(true);
    });

    it('deve lidar com undefined e null values', () => {
      const score1 = calculateViralScore({});
      const score2 = calculateViralScore({ views: undefined, likes: undefined, comments: undefined });

      expect(score1).toBe(0);
      expect(score2).toBe(0);
    });
  });
});
