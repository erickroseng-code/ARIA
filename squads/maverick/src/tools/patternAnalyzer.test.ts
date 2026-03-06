import { PatternAnalyzer, VideoPattern } from './patternAnalyzer';

/**
 * Pattern Analyzer Tests
 *
 * Testa extração de padrões virais via LLM
 * NOTA: Testes reais requerem API key do DeepSeek configurada
 */

describe('PatternAnalyzer', () => {
  let analyzer: PatternAnalyzer;

  beforeEach(() => {
    analyzer = new PatternAnalyzer();
  });

  describe('analyzeVirtualPosts', () => {
    it('deve processar array de posts', async () => {
      const posts = [
        {
          url: 'https://instagram.com/p/1',
          caption: 'Como aumentar suas vendas em 30 dias com copywriting',
          views: 150000,
          likes: 2000,
          comments: 300,
        },
        {
          url: 'https://instagram.com/p/2',
          caption: 'O segredo que os copywriters não querem que você saiba',
          views: 200000,
          likes: 3000,
          comments: 500,
        },
      ];

      const patterns = await analyzer.analyzeVirtualPosts(posts);

      expect(Array.isArray(patterns)).toBe(true);
      expect(patterns.length).toBe(2);
      patterns.forEach(p => {
        expect(p).toHaveProperty('url');
        expect(p).toHaveProperty('views');
        expect(p).toHaveProperty('analysis');
        expect(p.analysis).toHaveProperty('hook');
        expect(p.analysis).toHaveProperty('theme');
        expect(p.analysis).toHaveProperty('format');
        expect(p.analysis).toHaveProperty('cta');
        expect(p.analysis).toHaveProperty('pattern');
        expect(p.analysis).toHaveProperty('emotional_trigger');
      });
    }, 60000); // Timeout 60s para LLM
  });

  describe('extractTrends', () => {
    it('deve extrair tendências de padrões', () => {
      const patterns: VideoPattern[] = [
        {
          url: 'https://instagram.com/p/1',
          views: 100000,
          engagement: { likes: 1000, comments: 100 },
          viral_score: 5.2,
          analysis: {
            hook: 'Como ganhar dinheiro',
            theme: 'copywriting',
            format: 'Storytelling',
            cta: 'Salva esse vídeo',
            pattern: 'Problem-Solution-Action',
            emotional_trigger: 'Desire',
          },
        },
        {
          url: 'https://instagram.com/p/2',
          views: 150000,
          engagement: { likes: 1500, comments: 200 },
          viral_score: 5.8,
          analysis: {
            hook: 'Você estava fazendo errado',
            theme: 'copywriting',
            format: 'Pergunta',
            cta: 'Comente suas dúvidas',
            pattern: 'Before-After',
            emotional_trigger: 'Curiosity',
          },
        },
        {
          url: 'https://instagram.com/p/3',
          views: 200000,
          engagement: { likes: 2000, comments: 300 },
          viral_score: 6.1,
          analysis: {
            hook: 'Erro comum em copywriting',
            theme: 'produtividade',
            format: 'Revelação',
            cta: 'Compartilha com alguém',
            pattern: 'List-Tips',
            emotional_trigger: 'Fear',
          },
        },
      ];

      const trends = analyzer.extractTrends(patterns);

      expect(trends).toHaveProperty('top_hooks');
      expect(trends).toHaveProperty('top_themes');
      expect(trends).toHaveProperty('top_formats');
      expect(trends).toHaveProperty('top_ctas');
      expect(trends).toHaveProperty('top_triggers');

      // Verificar que retorna arrays
      expect(Array.isArray(trends.top_hooks)).toBe(true);
      expect(Array.isArray(trends.top_themes)).toBe(true);
      expect(Array.isArray(trends.top_formats)).toBe(true);
      expect(Array.isArray(trends.top_ctas)).toBe(true);
      expect(Array.isArray(trends.top_triggers)).toBe(true);

      // Verificar limite de resultados
      expect(trends.top_hooks.length).toBeLessThanOrEqual(5);
      expect(trends.top_themes.length).toBeLessThanOrEqual(5);
      expect(trends.top_formats.length).toBeLessThanOrEqual(3);
      expect(trends.top_ctas.length).toBeLessThanOrEqual(5);
      expect(trends.top_triggers.length).toBeLessThanOrEqual(3);

      // Verificar que captura dados corretos
      expect(trends.top_themes).toContain('copywriting');
      expect(trends.top_themes).toContain('produtividade');
      expect(trends.top_formats).toContain('Storytelling');
      expect(trends.top_triggers).toContain('Desire');
    });

    it('deve remover duplicatas ao extrair tendências', () => {
      const patterns: VideoPattern[] = [
        {
          url: 'https://instagram.com/p/1',
          views: 100000,
          engagement: { likes: 1000, comments: 100 },
          viral_score: 5.2,
          analysis: {
            hook: 'Hook duplicado',
            theme: 'copywriting',
            format: 'Storytelling',
            cta: 'Salva',
            pattern: 'Problem-Solution-Action',
            emotional_trigger: 'Desire',
          },
        },
        {
          url: 'https://instagram.com/p/2',
          views: 100000,
          engagement: { likes: 1000, comments: 100 },
          viral_score: 5.2,
          analysis: {
            hook: 'Hook duplicado',
            theme: 'copywriting',
            format: 'Storytelling',
            cta: 'Salva',
            pattern: 'Problem-Solution-Action',
            emotional_trigger: 'Desire',
          },
        },
      ];

      const trends = analyzer.extractTrends(patterns);

      // Deve ter apenas 1 de cada
      expect(trends.top_hooks.length).toBe(1);
      expect(trends.top_themes.length).toBe(1);
      expect(trends.top_formats.length).toBe(1);
      expect(trends.top_ctas.length).toBe(1);
      expect(trends.top_triggers.length).toBe(1);
    });
  });

  describe('analyzeSinglePost (fallback)', () => {
    it('deve retornar padrão válido mesmo com falha LLM', async () => {
      // Teste de fallback - garante que não quebra se LLM falhar
      const post = {
        url: 'https://instagram.com/p/test',
        caption: 'Este é um teste de fallback para análise',
        views: 100000,
        likes: 500,
        comments: 50,
      };

      const pattern = await analyzer['analyzeSinglePost'](post);

      expect(pattern).toHaveProperty('url', post.url);
      expect(pattern).toHaveProperty('views');
      expect(pattern).toHaveProperty('analysis');
      expect(pattern.analysis.hook).toBeTruthy();
      expect(pattern.analysis.theme).toBeTruthy();
    }, 30000);
  });
});
