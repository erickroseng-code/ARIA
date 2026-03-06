import axios from 'axios';
import { chromium } from 'playwright';
import StealthPlugin from 'playwright-extra-plugin-stealth';

/**
 * Instagram Scraper - DuckDuckGo + Playwright Strategy
 *
 * Workflow:
 * 1. DuckDuckGo busca URLs de vídeos virais
 * 2. Playwright extrai: caption, views, likes, comments
 * 3. Filtra por viralidade (100k+ views)
 * 4. Retorna dados estruturados
 */

interface RawPost {
  url: string;
  caption?: string;
  views?: number;
  likes?: number;
  comments?: number;
  type?: string;
  timestamp?: string;
}

interface ViralPost extends RawPost {
  viral_score: number;
}

export class InstagramScraper {
  private chromeUserDataPath: string;

  constructor() {
    // Windows Chrome path
    this.chromeUserDataPath = `C:\\Users\\erick\\AppData\\Local\\Google\\Chrome\\User Data`;
  }

  /**
   * PASSO 1: DuckDuckGo Search
   * Busca URLs de vídeos virais via DuckDuckGo
   */
  async searchViaDuckDuckGo(keyword: string, limit = 30): Promise<string[]> {
    try {
      process.stdout.write(`[DDG] Buscando "${keyword}" no DuckDuckGo...\n`);

      const response = await axios.get('https://duckduckgo.com/', {
        params: {
          q: `site:instagram.com ${keyword}`,
          ia: 'web',
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10000,
      });

      // Parse HTML simples - DuckDuckGo retorna links nos snippets
      const linkRegex = /href=["']([^"']*instagram\.com[^"']*?)["']/g;
      const matches = response.data.matchAll(linkRegex);
      const urls = new Set<string>();

      for (const match of matches) {
        const url = match[1];
        if (url && (url.includes('/p/') || url.includes('/reels/'))) {
          urls.add(url);
        }
      }

      const uniqueUrls = Array.from(urls).slice(0, limit);
      process.stdout.write(`[DDG] ✅ Encontrados ${uniqueUrls.length} URLs\n`);
      return uniqueUrls;
    } catch (error: any) {
      process.stderr.write(`[DDG] ❌ Erro: ${error.message}\n`);
      return [];
    }
  }

  /**
   * PASSO 2: Playwright Extraction (Humanizado)
   * Extrai dados do post SEM abrir vídeo completo
   */
  async extractViaPlaywright(urls: string[]): Promise<RawPost[]> {
    const browser = chromium.use(StealthPlugin());
    const posts: RawPost[] = [];

    try {
      process.stdout.write(`[PLAYWRIGHT] Conectando ao seu Chrome...\n`);

      const context = await browser.launchPersistentContext(
        this.chromeUserDataPath,
        {
          headless: false, // Não-headless: você vê a execução
          channel: 'chrome',
          viewport: { width: 1080, height: 1920 },
          locale: 'pt-BR',
        }
      );

      const page = await context.newPage();

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];

        try {
          process.stdout.write(`[${i + 1}/${urls.length}] Extraindo: ${url.slice(-30)}\n`);

          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

          // Aguardar carregar elementos principais
          await page.waitForSelector('img, video', { timeout: 5000 }).catch(() => {});

          // Random delay humanizado
          await this.randomDelay(800, 2000);

          // Extrair dados via JavaScript
          const postData = await page.evaluate(() => {
            // Caption/descrição
            const caption = document.querySelector('[data-testid="post_caption"]')?.textContent ||
                          document.querySelector('h1')?.textContent ||
                          '';

            // Views (para Reels)
            const viewsText = Array.from(document.querySelectorAll('span')).find(
              el => el.textContent?.includes('visualização') || el.textContent?.includes('plays')
            )?.textContent || '';

            // Likes
            const likesElement = document.querySelector('[aria-label*="gosto"]') ||
                               document.querySelector('[aria-label*="like"]');
            const likesText = likesElement?.getAttribute('aria-label') || '';

            // Comments
            const commentsElement = Array.from(document.querySelectorAll('a')).find(
              el => el.textContent?.includes('comentário')
            );
            const commentsText = commentsElement?.textContent || '';

            // Type (Video ou Image)
            const isVideo = document.querySelector('video') !== null;

            return {
              caption: caption.trim().slice(0, 200),
              views: parseInt(viewsText.replace(/\D/g, '')) || 0,
              likes: parseInt(likesText.replace(/\D/g, '')) || 0,
              comments: parseInt(commentsText.replace(/\D/g, '')) || 0,
              type: isVideo ? 'Video' : 'Image',
            };
          });

          posts.push({
            url,
            ...postData,
            timestamp: new Date().toISOString(),
          });

          // Random mouse move (anti-bot humanizado)
          await page.mouse.move(Math.random() * 1080, Math.random() * 1920);

        } catch (error: any) {
          process.stderr.write(`[EXTRACT] Erro em ${url}: ${error.message?.slice(0, 50)}\n`);
        }
      }

      await context.close();
      process.stdout.write(`[PLAYWRIGHT] ✅ Extração concluída: ${posts.length} posts\n`);
      return posts;

    } catch (error: any) {
      process.stderr.write(`[PLAYWRIGHT] ❌ Erro fatal: ${error.message}\n`);
      return posts;
    } finally {
      await browser.close();
    }
  }

  /**
   * PASSO 3: Filtro de Viralidade
   * Mantém apenas posts com 100k+ views
   */
  filterByVirality(posts: RawPost[], minViews = 100_000): ViralPost[] {
    process.stdout.write(`[FILTER] Filtrando por viralidade (${minViews.toLocaleString('pt-BR')}+ views)...\n`);

    const viral = posts
      .filter(p => {
        const views = p.views || 0;
        const engagement = (p.likes || 0) + (p.comments || 0);
        return views >= minViews && engagement > 0;
      })
      .map(p => ({
        ...p,
        viral_score: this.calculateViralScore(p),
      }))
      .sort((a, b) => b.viral_score - a.viral_score);

    process.stdout.write(`[FILTER] ✅ ${viral.length} posts virais identificados\n`);
    return viral;
  }

  /**
   * Calcula score de viralidade
   */
  private calculateViralScore(post: RawPost): number {
    const views = post.views || 0;
    const likes = post.likes || 0;
    const comments = post.comments || 0;

    if (views === 0) return 0;

    // Score: views + weighted engagement
    const engagementRate = (likes + comments * 2) / views; // comments valem 2x
    const score = Math.log10(views + 1) * (1 + engagementRate * 10);

    return parseFloat(score.toFixed(2));
  }

  /**
   * Random delay humanizado
   */
  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.random() * (max - min) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Função principal exportável
   */
  async scrapeViralReels(keyword: string, minViews = 100_000): Promise<ViralPost[]> {
    process.stdout.write(`\n${'='.repeat(80)}\n`);
    process.stdout.write(`🔍 INSTAGRAM SCRAPER - ${keyword.toUpperCase()}\n`);
    process.stdout.write(`${'='.repeat(80)}\n\n`);

    // Buscar URLs
    const urls = await this.searchViaDuckDuckGo(keyword);
    if (urls.length === 0) {
      process.stderr.write(`❌ Nenhum URL encontrado para "${keyword}"\n`);
      return [];
    }

    // Extrair dados
    const posts = await this.extractViaPlaywright(urls);
    if (posts.length === 0) {
      process.stderr.write(`❌ Nenhum post extraído\n`);
      return [];
    }

    // Filtrar por viralidade
    const viral = this.filterByVirality(posts, minViews);

    process.stdout.write(`\n✅ RESULTADO FINAL\n`);
    process.stdout.write(`   Total buscado: ${urls.length}\n`);
    process.stdout.write(`   Posts extraídos: ${posts.length}\n`);
    process.stdout.write(`   Posts virais (${minViews}+ views): ${viral.length}\n\n`);

    return viral;
  }
}
