import { chromium, Browser } from 'playwright';
import { InstagramProfile, ScraperOptions } from './types';

export class InstagramScraper {
  private browser: Browser | null = null;
  private options: ScraperOptions;

  constructor(options: ScraperOptions = {}) {
    this.options = {
      headless: true,
      timeout: 30000,
      ...options,
    };
  }

  private parseInstagramNumber(text: string | null | undefined): number {
    if (!text) return 0;
    const cleanText = text.replace(/,/g, '').replace(/ /g, '').toUpperCase();
    const match = cleanText.match(/([\d.]+)([KMB]?)/);
    if (!match) return 0;
    
    let num = parseFloat(match[1] || '0');
    const suffix = match[2];
    
    if (suffix === 'K') num *= 1000;
    if (suffix === 'M') num *= 1000000;
    if (suffix === 'B') num *= 1000000000;
    
    return Math.floor(num);
  }

  private async initialize() {
    if (this.browser) return;
    
    // Launch browser with automation evasion
    this.browser = await chromium.launch({
      headless: this.options.headless,
      args: ['--disable-blink-features=AutomationControlled'],
    });
  }

  public async scrapeProfile(username: string): Promise<InstagramProfile | null> {
    await this.initialize();
    if (!this.browser) throw new Error('Falha ao inicializar o browser.');

    const context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    });
    
    const page = await context.newPage();
    const url = `https://www.instagram.com/${username}/`;

    try {
      console.log(`🚀 [Scout] Navegando até o perfil: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle', timeout: this.options.timeout });

      // Espera o carregamento dos elementos de métricas
      await page.waitForSelector('header ul li', { timeout: 15000 });

      const rawData = await page.evaluate(() => {
        const header = document.querySelector('header');
        if (!header) return null;

        const statsElements = Array.from(header.querySelectorAll('ul li'));
        const postText = statsElements[0]?.textContent || '0';
        const followersText = statsElements[1]?.textContent || '0';
        const followingText = statsElements[2]?.textContent || '0';

        const bioElement = header.querySelector('section > div:last-child');
        
        // Extração de Posts da Grade
        const postElements = Array.from(document.querySelectorAll('article div div div a'));
        const posts = postElements.slice(0, 9).map(el => {
          const url = (el as HTMLAnchorElement).href;
          const img = el.querySelector('img');
          const caption = img?.getAttribute('alt') || '';
          
          // Tenta detectar o tipo (Reel, Carrossel, etc) pelos ícones
          const isReel = !!el.querySelector('svg[aria-label="Reels"]');
          const isCarousel = !!el.querySelector('svg[aria-label="Carrossel"]');
          
          return {
            id: url.split('/p/')[1]?.split('/')[0] || url.split('/reel/')[1]?.split('/')[0] || '',
            url,
            caption,
            type: isReel ? 'reel' : (isCarousel ? 'carousel' : 'image'),
            likes: 0,
            comments: 0,
            postedAt: new Date().toISOString()
          };
        });
        
        return {
          username: window.location.pathname.replace(/\//g, ''),
          fullName: header.querySelector('h2')?.textContent || '',
          bio: bioElement?.textContent || '',
          rawStats: {
            posts: postText,
            followers: followersText,
            following: followingText
          },
          isPrivate: document.body.innerText.includes('Este perfil é privado'),
          isVerified: !!header.querySelector('svg[aria-label="Verificado"]'),
          profilePicUrl: header.querySelector('img')?.getAttribute('src') || '',
          recentPosts: posts
        };
      });

      if (!rawData) return null;

      // Realiza o parse final dos dados no Node.js
      return {
        ...rawData,
        postCount: this.parseInstagramNumber(rawData.rawStats.posts),
        followerCount: this.parseInstagramNumber(rawData.rawStats.followers),
        followingCount: this.parseInstagramNumber(rawData.rawStats.following)
      } as any;

    } catch (error: any) {
      console.error(`❌ [Scout] Erro ao extrair perfil: ${error.message}`);
      return null;
    } finally {
      await context.close();
    }
  }

  public async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
