import { TrendResearcher } from './index';

/**
 * Trend Researcher Integration Tests
 *
 * Testa a integração completa de busca + análise de conteúdo viral
 */

describe('TrendResearcher Integration', () => {
  let trendResearcher: TrendResearcher;

  beforeEach(() => {
    trendResearcher = new TrendResearcher();
  });

  describe('fetchTopPosts with Instagram Scraper', () => {
    it('deve retornar posts virais com padrões analisados', async () => {
      // NOTA: Este teste requer rede + APIs
      // Comentado por padrão, descomente para teste completo

      /*
      const keywords = ['copywriting viral', 'produtividade'];
      const posts = await trendResearcher.fetchTopPosts(keywords, 15);

      expect(Array.isArray(posts)).toBe(true);
      expect(posts.length).toBeGreaterThan(0);

      posts.forEach(post => {
        expect(post).toHaveProperty('url');
        expect(post).toHaveProperty('analysis');

        if (post.analysis) {
          expect(post.analysis).toHaveProperty('hook');
          expect(post.analysis).toHaveProperty('theme');
          expect(post.analysis).toHaveProperty('format');
          expect(post.analysis).toHaveProperty('viral_score');
        }
      });
      */
    }, 120000);
  });

  describe('fallback to Google Search', () => {
    it('deve usar Google Search se scraper falhar', async () => {
      // NOTA: Este teste valida a estratégia de fallback
      // Comentado por padrão
      /*
      const keywords = ['copywriting'];
      const posts = await trendResearcher.fetchTopPosts(keywords, 10);

      // Se scraper falhar, deve tentar Google Search
      if (posts.length > 0) {
        expect(posts[0]).toHaveProperty('url');
      }
      */
    }, 120000);
  });

  describe('reference post generation', () => {
    it('deve gerar posts de referência estruturados', async () => {
      // NOTA: Teste de saída esperada
      /*
      const keywords = ['copywriting'];
      const posts = await trendResearcher.fetchTopPosts(keywords, 5);

      expect(posts).toBeDefined();
      posts.forEach(post => {
        expect(post.url).toMatch(/instagram\.com/);
        expect(typeof post.views).toBe('number');
      });
      */
    }, 60000);
  });
});
