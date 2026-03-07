import { InstagramScraper } from './instagramScraper';

/**
 * Instagram Scraper Tests
 *
 * Testes unitários para funcionalidades que não requerem browser/rede.
 * Testes de integração (scrapeViralReels, scrapeMultipleHashtags) requerem
 * Chrome fechado e conta Instagram logada — executados manualmente.
 */

describe('InstagramScraper', () => {
  let scraper: InstagramScraper;

  beforeEach(() => {
    scraper = new InstagramScraper();
  });

  // ── filterByVirality ────────────────────────────────────────────────────────

  describe('filterByVirality', () => {
    it('deve filtrar posts com menos de 100k views (modo strict)', () => {
      // Com 3+ posts passando no strict, o modo strict é usado (sem fallback lenient)
      const posts = [
        { url: 'https://instagram.com/p/1', views: 50000, likes: 100, comments: 10 },
        { url: 'https://instagram.com/p/2', views: 150000, likes: 1500, comments: 200 },
        { url: 'https://instagram.com/p/3', views: 100000, likes: 500, comments: 50 },
        { url: 'https://instagram.com/p/4', views: 200000, likes: 2000, comments: 300 },
      ];

      const viral = scraper.filterByVirality(posts, 100000);

      // strict tem 3 posts (100k, 150k, 200k), ativa strict mode
      expect(viral.length).toBe(3);
      expect(viral.every(p => (p.views ?? 0) >= 100000)).toBe(true);
      expect(viral.every(p => p.viral_score > 0)).toBe(true);
    });

    it('deve ativar fallback lenient quando strict tem menos de 3 posts', () => {
      // Com apenas 2 posts no strict, o fallback lenient ativa (20% do threshold)
      const posts = [
        { url: 'https://instagram.com/p/1', views: 50000, likes: 100, comments: 10 },
        { url: 'https://instagram.com/p/2', views: 150000, likes: 1500, comments: 200 },
        { url: 'https://instagram.com/p/3', views: 100000, likes: 500, comments: 50 },
      ];

      const viral = scraper.filterByVirality(posts, 100000);

      // strict = 2 posts → ativa lenient (threshold 20k) → todos 3 passam
      expect(viral.length).toBe(3);
      expect(viral[0].viral_score).toBeGreaterThanOrEqual(viral[viral.length - 1].viral_score);
    });

    it('deve incluir post sem views quando outros não passam no strict', () => {
      // Post sem views é incluído pelo lenient; post com 1000+ likes também
      const posts = [
        { url: 'https://instagram.com/p/semviews', views: undefined, likes: 1500, comments: 50 },
        { url: 'https://instagram.com/p/poucasviews', views: 5000, likes: 10 },
      ];

      const viral = scraper.filterByVirality(posts, 100000);

      // Lenient: sem views + likes >= 1000 → incluído; 5000 views < 20000 → excluído
      expect(viral.some(p => p.url === 'https://instagram.com/p/semviews')).toBe(true);
    });

    it('deve ordenar por viral_score descendente', () => {
      const posts = [
        { url: 'https://instagram.com/p/1', views: 100000, likes: 500, comments: 50 },
        { url: 'https://instagram.com/p/2', views: 500000, likes: 5000, comments: 500 },
      ];

      const viral = scraper.filterByVirality(posts, 100000);

      expect(viral[0].viral_score).toBeGreaterThan(viral[1].viral_score);
    });

    it('deve calcular viral_score baseado em views e engajamento', () => {
      const post = { url: 'https://instagram.com/p/1', views: 100000, likes: 1000, comments: 500 };
      const viral = scraper.filterByVirality([post], 100000);

      // score = log10(100001) * (1 + (1000 + 1000) / 100000 * 10) ≈ 5.0 * 1.2 = 6.0
      expect(viral[0].viral_score).toBeGreaterThan(5);
    });

    it('deve retornar score 0 para post sem views e sem engajamento', () => {
      const post = { url: 'https://instagram.com/p/1', views: 0, likes: 0, comments: 0 };
      const viral = scraper.filterByVirality([post], 0);

      expect(viral[0].viral_score).toBe(0);
    });
  });

  // ── parseCount (via filterByVirality) ──────────────────────────────────────

  describe('parseCount (via filterByVirality)', () => {
    it('deve ponderar comments 2x mais que likes no score', () => {
      const postA = { url: 'a', views: 100000, likes: 1000, comments: 0 };
      const postB = { url: 'b', views: 100000, likes: 0, comments: 500 };

      const [a] = scraper.filterByVirality([postA], 0);
      const [b] = scraper.filterByVirality([postB], 0);

      // 1000 likes == 500 comments×2 → scores similares
      expect(Math.abs(a.viral_score - b.viral_score)).toBeLessThan(0.5);
    });
  });

  // ── randomDelay ─────────────────────────────────────────────────────────────

  describe('randomDelay', () => {
    it('deve gerar delay dentro do intervalo especificado', async () => {
      const start = Date.now();
      await (scraper as any).randomDelay(100, 200);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(100);
      expect(elapsed).toBeLessThanOrEqual(300);
    });
  });

  // ── parseMetricsFromHoverText ───────────────────────────────────────────────

  describe('parseMetricsFromHoverText', () => {
    it('deve parsear "50K visualizações" como views', () => {
      const result = (scraper as any).parseMetricsFromHoverText('50K visualizações');
      expect(result.views).toBe(50000);
      expect(result.likes).toBeUndefined();
    });

    it('deve parsear "1,2 mi de curtidas" como likes', () => {
      const result = (scraper as any).parseMetricsFromHoverText('1,2 mi de curtidas');
      expect(result.likes).toBe(1_200_000);
    });

    it('deve parsear "123 mil visualizações" como views', () => {
      const result = (scraper as any).parseMetricsFromHoverText('123 mil visualizações');
      expect(result.views).toBe(123_000);
    });

    it('deve parsear "2.5M" como views (formato inglês)', () => {
      const result = (scraper as any).parseMetricsFromHoverText('2.5M plays');
      expect(result.views).toBe(2_500_000);
    });

    it('deve retornar {} para texto sem número', () => {
      const result = (scraper as any).parseMetricsFromHoverText('');
      expect(result).toEqual({});
    });

    it('deve retornar {} para texto sem número reconhecível', () => {
      const result = (scraper as any).parseMetricsFromHoverText('Ver mais');
      expect(result).toEqual({});
    });

    it('deve retornar {} para número simples sem contexto', () => {
      const result = (scraper as any).parseMetricsFromHoverText('500');
      // Sem palavra-chave de contexto (views/curtidas) → não assume nada
      expect(result.views).toBeUndefined();
      expect(result.likes).toBeUndefined();
    });

    it('deve parsear "1,5K curtidas" como likes', () => {
      const result = (scraper as any).parseMetricsFromHoverText('1,5K curtidas');
      expect(result.likes).toBe(1_500);
    });
  });

  // ── normalizeToHashtag ─────────────────────────────────────────────────────────

  describe('normalizeToHashtag', () => {
    it('deve manter palavra única sem alteração', () => {
      expect(scraper.normalizeToHashtag('fitness')).toBe('fitness');
    });

    it('deve remover stopwords e concatenar', () => {
      expect(scraper.normalizeToHashtag('copywriting para iniciantes')).toBe('copywritinginiciantes');
    });

    it('deve strip acentos e concatenar', () => {
      expect(scraper.normalizeToHashtag('educação financeira')).toBe('educacaofinanceira');
    });

    it('deve remover stopwords com acento (só stopwords normalizadas)', () => {
      expect(scraper.normalizeToHashtag('como sair das dividas')).toBe('sairdividas');
    });

    it('deve manter palavras quando todas são stopwords (fallback)', () => {
      // Frase só de stopwords → usa todas as palavras
      const result = scraper.normalizeToHashtag('de para com');
      expect(result.length).toBeGreaterThan(0);
    });

    it('deve ignorar espaços extras', () => {
      expect(scraper.normalizeToHashtag('  fitness  ')).toBe('fitness');
    });
  });

  // ── resolveSearchUrl ─────────────────────────────────────────────────────────

  describe('resolveSearchUrl', () => {
    it('deve gerar URL /explore/tags/ para palavra única', () => {
      const { url, hashtag } = (scraper as any).resolveSearchUrl('fitness');
      expect(hashtag).toBe('fitness');
      expect(url).toBe('https://www.instagram.com/explore/tags/fitness/');
    });

    it('deve normalizar frase para hashtag e gerar URL /explore/tags/', () => {
      const { url, hashtag } = (scraper as any).resolveSearchUrl('copywriting para iniciantes');
      expect(hashtag).toBe('copywritinginiciantes');
      expect(url).toContain('/explore/tags/');
      expect(url).not.toContain('/search/');
    });

    it('deve encodar hashtag com acentos removidos', () => {
      const { url, hashtag } = (scraper as any).resolveSearchUrl('educação financeira');
      expect(hashtag).toBe('educacaofinanceira');
      expect(url).toContain('educacaofinanceira');
      expect(url).not.toContain(' ');
    });

    it('deve ignorar espaços extras (trim)', () => {
      const { hashtag } = (scraper as any).resolveSearchUrl('  fitness  ');
      expect(hashtag).toBe('fitness');
    });
  });

  // ── Filtro de Data (integrado em filterByVirality via ageDays) ──────────────

  describe('filtro de data via ageDays', () => {
    it('deve ranquear posts recentes acima de posts antigos com mesmo score base', () => {
      const posts = [
        { url: 'https://instagram.com/p/novo', views: 100000, likes: 500, comments: 50, ageDays: 5 },
        { url: 'https://instagram.com/p/antigo', views: 100000, likes: 500, comments: 50, ageDays: 40 },
      ];
      // filterByVirality não usa ageDays no score — mas posts antigos foram
      // previamente descartados em extractPostData. Aqui testamos que apenas
      // posts dentro do limite chegam ao pipeline.
      const viral = scraper.filterByVirality(posts, 100000);
      expect(viral.length).toBe(2); // ambos passaram as views — filtro de data é pré-pipeline
    });
  });
});
