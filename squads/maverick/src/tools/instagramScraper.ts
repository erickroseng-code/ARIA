import path from 'path';
import { chromium } from 'playwright-extra';
import type { Page, BrowserContext, ElementHandle } from 'playwright';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// ── Interfaces ──────────────────────────────────────────────────────────────

interface RawPost {
  url: string;
  caption?: string;
  views?: number;
  likes?: number;
  comments?: number;
  type?: string;
  ageDays?: number;
}

interface ViralPost extends RawPost {
  viral_score: number;
}

// ── InstagramScraper ─────────────────────────────────────────────────────────

export class InstagramScraper {
  private sessionPath: string;

  constructor() {
    this.sessionPath = path.join(
      process.env['LOCALAPPDATA'] ?? 'C:\\Users\\erick\\AppData\\Local',
      'Playwright',
      'instagram-scraper'
    );
  }

  // ── Browser ──────────────────────────────────────────────────────────────────

  private async openBrowser(): Promise<{ context: BrowserContext; page: Page }> {
    chromium.use(StealthPlugin());
    process.stdout.write(`[BROWSER] Iniciando Chromium (pasta: ${this.sessionPath})\n`);

    const context = await chromium.launchPersistentContext(this.sessionPath, {
      headless: false,
      viewport: { width: 1280, height: 900 },
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    });

    const page = context.pages()[0] ?? (await context.newPage());
    return { context, page };
  }

  // ── Login Check ───────────────────────────────────────────────────────────────

  private async ensureLoggedIn(page: Page): Promise<void> {
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await this.randomDelay(1000, 2000);

    const isLoggedIn = await page.evaluate(() => {
      return !document.querySelector('input[name="username"]');
    });

    if (!isLoggedIn) {
      process.stdout.write('[LOGIN] Aguardando login manual... (feche após logar)\n');
      await page.waitForSelector('input[name="username"]', { state: 'detached', timeout: 120_000 });
    }
    process.stdout.write('[LOGIN] Sessão do Instagram válida.\n');
  }

  // ── Smart URL — normaliza keyword para hashtag ────────────────────────────

  /**
   * Stopwords PT-BR removidas antes de montar a hashtag.
   */
  private static readonly STOPWORDS = new Set([
    'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas',
    'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos',
    'para', 'pra', 'por', 'pelo', 'pela', 'pelos', 'pelas',
    'com', 'sem', 'sob', 'sobre', 'entre', 'ate', 'apos',
    'e', 'ou', 'mas', 'se', 'que', 'como', 'quando', 'onde',
    'eu', 'tu', 'ele', 'ela', 'eles', 'elas',
    'me', 'te', 'lhe',
    'muito', 'mais', 'menos', 'bem', 'mal',
    'sao', 'ser', 'estar', 'ter', 'fazer',
  ]);

  /**
   * Normaliza uma keyword (palavra ou frase) para hashtag sem espaços.
   *
   * Exemplos:
   *  "fitness"                    → "fitness"
   *  "copywriting para iniciantes" → "copywritinginiciantes"
   *  "educação financeira"         → "educacaofinanceira"
   *  "como sair das dívidas"       → "sairdividas"
   */
  normalizeToHashtag(keyword: string): string {
    const normalized = keyword
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .trim();

    const words = normalized.split(/\s+/).filter(Boolean);
    const significant = words.filter(w => !InstagramScraper.STOPWORDS.has(w));
    return (significant.length > 0 ? significant : words).join('');
  }

  /**
   * Resolve a URL de busca — SEMPRE usa /explore/tags/ (mais estável).
   * Frases são normalizadas para hashtag antes de montar a URL.
   */
  private resolveSearchUrl(keyword: string): { url: string; hashtag: string } {
    const hashtag = this.normalizeToHashtag(keyword);
    return {
      url: `https://www.instagram.com/explore/tags/${encodeURIComponent(hashtag)}/`,
      hashtag,
    };
  }

  // ── humanScroll ─────────────────────────────────────────────────────────────

  private async humanScroll(page: Page, times = 3): Promise<void> {
    for (let i = 0; i < times; i++) {
      await page.mouse.wheel(0, 300 + Math.random() * 200);
      await this.randomDelay(600, 1200);
    }
  }

  // ── Coleta via Hover no Grid ──────────────────────────────────────────────

  /**
   * Melhoria 2: Hover + pré-filtro de viralidade no grid.
   * Faz hover em cada thumbnail → lê o texto do overlay (views/curtidas) →
   * descarta posts abaixo de minViews antes de visitar cada post.
   */
  private async collectLinksWithHover(
    page: Page,
    minViews: number,
    maxLinks: number
  ): Promise<Array<{ url: string; gridViews?: number; gridLikes?: number }>> {
    const handles: ElementHandle[] = await page.$$('main a[href*="/reel/"], main a[href*="/p/"]');
    const toProcess = handles.slice(0, maxLinks * 3);

    process.stdout.write(`[HOVER] ${toProcess.length} thumbnails encontrados. Iniciando hovers...\n`);

    const approved: Array<{ url: string; gridViews?: number; gridLikes?: number }> = [];
    let hoverCount = 0;

    for (const handle of toProcess) {
      if (approved.length >= maxLinks) break;

      try {
        await handle.scrollIntoViewIfNeeded();
        await this.randomDelay(150, 350);

        const url: string = await handle.evaluate((el: HTMLAnchorElement) => el.href);
        if (!url || (!url.includes('/reel/') && !url.includes('/p/'))) continue;

        const box = await handle.boundingBox();
        if (!box) continue;

        await page.mouse.move(
          box.x + box.width / 2 + (Math.random() - 0.5) * 10,
          box.y + box.height / 2 + (Math.random() - 0.5) * 10,
          { steps: 8 }
        );
        await this.randomDelay(500, 800);
        hoverCount++;

        const overlayText: string = await page.evaluate(() => {
          const overlay = document.querySelector('div[style*="opacity: 1"] ul, div[class*="overlay"] ul');
          return overlay?.textContent ?? '';
        });

        const { views: gridViews, likes: gridLikes } = this.parseMetricsFromHoverText(overlayText);

        const hasViews = gridViews !== undefined;
        const passesFilter = minViews === 0 || !hasViews || (gridViews ?? 0) >= minViews;

        const viewsLabel = hasViews ? `${(gridViews!).toLocaleString('pt-BR')} views` : 'sem views no overlay';

        if (passesFilter) {
          process.stdout.write(`  [✓] ${viewsLabel} → ${url.slice(-40)}\n`);
          approved.push({ url, gridViews, gridLikes });
        } else {
          process.stdout.write(`  [PRÉ-FILTRO] descartado (${viewsLabel}) → ${url.slice(-40)}\n`);
        }
      } catch {
        // handle pode ter sido removido do DOM durante o scroll
      }
    }

    process.stdout.write(`[HOVER] ${hoverCount} hovers | ${approved.length} aprovados no pré-filtro\n\n`);
    return approved;
  }

  // ── Coleta via Click + Esc (modal) ───────────────────────────────────────

  /**
   * Estratégia "Click, Read and Esc":
   *  1. Clica no thumbnail → abre modal sobre o grid (sem navegar)
   *  2. Aguarda ~1s para o modal renderizar
   *  3. Lê o aria-label do botão de curtida e contador de views
   *  4. Aperta Escape → volta para o grid
   *
   * Mais preciso que hover: usa números reais do DOM do modal.
   * Funciona para imagens (curtidas) e reels (views + curtidas).
   */
  private async collectLinksWithClick(
    page: Page,
    minViews: number,
    maxLinks: number
  ): Promise<Array<{ url: string; gridViews?: number; gridLikes?: number }>> {
    const handles: ElementHandle[] = await page.$$('main a[href*="/reel/"], main a[href*="/p/"]');
    const toProcess = handles.slice(0, maxLinks * 3);

    process.stdout.write(`[CLICK] ${toProcess.length} thumbnails encontrados. Iniciando click+esc...\n`);

    const approved: Array<{ url: string; gridViews?: number; gridLikes?: number }> = [];

    for (const handle of toProcess) {
      if (approved.length >= maxLinks) break;

      try {
        await handle.scrollIntoViewIfNeeded();
        await this.randomDelay(200, 400);

        const url: string = await handle.evaluate((el: HTMLAnchorElement) => el.href);
        if (!url || (!url.includes('/reel/') && !url.includes('/p/'))) continue;

        // Clica para abrir o modal (Instagram abre em overlay, não navega para nova página)
        await handle.click();
        await this.randomDelay(900, 1300);

        // Lê métricas do modal via aria-label
        const raw = await page.evaluate(() => {
          const likeBtn = document.querySelector<HTMLElement>(
            'button[aria-label*="curtida" i], button[aria-label*="like" i], section[aria-label*="curtida" i]'
          );
          const viewEl = document.querySelector<HTMLElement>(
            '[aria-label*="visuali" i], [aria-label*="plays" i], [aria-label*="view" i]'
          );
          return {
            likeLabel: likeBtn?.getAttribute('aria-label') ?? '',
            viewLabel: viewEl?.getAttribute('aria-label') ?? '',
          };
        });

        // Fecha o modal
        await page.keyboard.press('Escape');
        await this.randomDelay(300, 500);

        const parsedLikes = this.parseMetricsFromHoverText(raw.likeLabel);
        const parsedViews = this.parseMetricsFromHoverText(raw.viewLabel);
        const gridLikes = parsedLikes.likes ?? parsedLikes.views;
        const gridViews = parsedViews.views;

        // Sem views (imagem) → passa; com views → filtra pelo threshold
        const hasViews = gridViews !== undefined;
        const passesFilter = minViews === 0 || !hasViews || (gridViews ?? 0) >= minViews;

        const label = hasViews
          ? `${(gridViews!).toLocaleString('pt-BR')} views`
          : gridLikes ? `${gridLikes.toLocaleString('pt-BR')} curtidas` : 'n/d';

        if (passesFilter) {
          process.stdout.write(`  [CLICK ✓] ${label} → ${url.slice(-40)}\n`);
          approved.push({ url, gridViews, gridLikes });
        } else {
          process.stdout.write(`  [PRÉ-FILTRO] descartado (${label}) → ${url.slice(-40)}\n`);
        }
      } catch {
        // handle removido ou modal não abriu
      }
    }

    process.stdout.write(`[CLICK] ${approved.length} aprovados no pré-filtro\n\n`);
    return approved;
  }

  // ── Extração de dados do post individual ──────────────────────────────────

  /**
   * Visita cada URL de post e extrai métricas do JSON embutido pelo Instagram
   * (estratégia mais confiável que DOM scraping).
   * Melhoria 4: filtra posts com mais de maxAgeDays dias.
   */
  private async extractPostData(
    url: string,
    page: Page,
    maxAgeDays: number,
    gridViews?: number,
    gridLikes?: number
  ): Promise<RawPost | null> {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await this.randomDelay(800, 1500);

      let views = gridViews;
      let likes = gridLikes;
      let comments: number | undefined;
      let caption = '';
      let postedAt: Date | undefined;
      let type = 'Image';

      const jsonScripts: Array<{ textContent: string | null }> = await page.evaluate(() =>
        Array.from(document.querySelectorAll('script[type="application/json"]')).map(s => ({
          textContent: s.textContent,
        }))
      );

      for (const script of jsonScripts) {
        try {
          const json = JSON.parse(script.textContent ?? '');
          const str = JSON.stringify(json);

          if (views === undefined) {
            const vm = str.match(/"video_view_count":(\d+)/);
            if (vm) views = parseInt(vm[1]);
          }
          if (views === undefined) {
            const pm = str.match(/"play_count":(\d+)/);
            if (pm) views = parseInt(pm[1]);
          }
          if (likes === undefined) {
            const lm = str.match(/"like_count":(\d+)/);
            if (lm) likes = parseInt(lm[1]);
          }
          if (comments === undefined) {
            const cm = str.match(/"comment_count":(\d+)/);
            if (cm) comments = parseInt(cm[1]);
          }
          if (!caption) {
            const capm = str.match(/"caption":"([^"]{10,300})"/);
            if (capm) caption = capm[1].replace(/\\n/g, ' ').replace(/\\"/g, '"');
          }
          // Data de publicação via JSON
          if (!postedAt) {
            const tm = str.match(/"taken_at_timestamp":(\d+)/);
            if (tm) postedAt = new Date(parseInt(tm[1]) * 1000);
          }
          if (!postedAt) {
            const dtm = str.match(/"taken_at":(\d+)/);
            if (dtm) postedAt = new Date(parseInt(dtm[1]) * 1000);
          }
          if (str.includes('"is_video":true') || str.includes('"media_type":2')) {
            type = 'Reel';
          }
        } catch { /* JSON inválido */ }
      }

      // Fallback para data via meta tag
      if (!postedAt) {
        const metaDate: string | null = await page.evaluate(() =>
          document.querySelector('meta[property="article:published_time"]')?.getAttribute('content') ?? null
        );
        if (metaDate) postedAt = new Date(metaDate);
      }

      // Melhoria 4: filtro de data
      let ageDays: number | undefined;
      if (postedAt) {
        ageDays = Math.floor((Date.now() - postedAt.getTime()) / (1000 * 60 * 60 * 24));
        if (ageDays > maxAgeDays) {
          process.stdout.write(`    → descartado: ${ageDays}d atrás (limite ${maxAgeDays}d)\n`);
          return null;
        }
      }

      // Fallback caption via DOM — evita pegar comentários
      if (!caption) {
        caption = await page.evaluate(() => {
          // 1. h1 sempre é o caption principal no Instagram
          const h1 = document.querySelector('h1');
          if (h1?.textContent && h1.textContent.trim().length >= 30) {
            return h1.textContent.trim();
          }

          // 2. Spans dentro da section de descrição do post
          const descSection = document.querySelector(
            'div[role="dialog"] ul li:first-child span, article header ~ div span'
          );
          if (descSection?.textContent && descSection.textContent.trim().length >= 30) {
            return descSection.textContent.trim();
          }

          // 3. Fallback: spans longos (≥60 chars) sem links — descarta textos curtos tipo comentários
          const spans = Array.from(document.querySelectorAll('span')).filter(
            (s: any) => s.innerText?.length >= 60 && !s.querySelector('a') && !/^\d/.test(s.innerText)
          );
          return spans[0]?.textContent?.trim() ?? '';
        });
      }
      const viewsLabel = views !== undefined ? `${views.toLocaleString('pt-BR')} views` : 'n/d';
      process.stdout.write(`    views: ${viewsLabel} | likes: ${(likes ?? 0).toLocaleString('pt-BR')} | ${ageDays ?? '?'}d atrás\n`);

      return {
        url,
        caption: caption.slice(0, 300) || undefined,
        views,
        likes: likes ?? 0,
        comments: comments ?? 0,
        type,
        ageDays,
      };
    } catch (err: any) {
      process.stderr.write(`[IG] Erro em ${url}: ${err.message?.slice(0, 60)}\n`);
      return null;
    }
  }

  // ── Filtro de Viralidade ──────────────────────────────────────────────────

  // ── Detecção de idioma PT-BR ─────────────────────────────────────────────

  /**
   * Retorna true se o texto contém ao menos uma palavra-raiz do PT-BR.
   * Usada para filtrar posts em espanhol / inglês coletados via hashtags globais.
   */
  private isPortuguese(text: string): boolean {
    if (!text || text.length < 15) return true; // texto curto: não descartar

    const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Marcadores positivos: palavras exclusivamente PT-BR
    const ptMarkers = [
      'voce', 'nao', 'que', 'uma', 'para', 'com', 'por', 'isso', 'mas', 'tem',
      'seu', 'sua', 'nos', 'ele', 'ela', 'esse', 'essa', 'aqui', 'bem', 'muito',
      'quando', 'como', 'onde', 'porque', 'entao', 'ja', 'ate', 'cada', 'ainda',
      'sempre', 'nunca', 'agora', 'depois', 'antes', 'sobre', 'entre',
      // Termos financeiros PT-BR
      'dinheiro', 'divida', 'poupanca', 'renda', 'financas', 'investimento',
      'salario', 'emprego', 'trabalho', 'empresa', 'mercado', 'economia',
    ];

    // Marcadores negativos: palavras exclusivamente ES (espanhol)
    const esOnlyMarkers = [
      'eres', 'estas', 'estoy', 'tienes', 'tiene', 'ellos', 'ellas',
      'también', 'tambien', 'pero', 'porque', 'nosotros', 'vosotros',
      'siempre', 'nunca', 'ahora', 'entonces', 'cuando', 'donde',
      'muy', 'mucho', 'mucha', 'muchos', 'muchas',
    ];

    const hasES = esOnlyMarkers.some(w => lower.includes(w));
    const hasPT = ptMarkers.some(w => lower.includes(w));

    if (hasES && !hasPT) return false; // claramente espanhol
    return true; // PT-BR ou neutro → mantém
  }

  /**
   * Melhoria 3: Funil de Viralidade
   * Filtra posts por views, idioma PT-BR e calcula score.
   * Se menos de 3 posts atingirem o threshold, usa um fallback leniente.
   */
  filterByVirality(posts: RawPost[], minViews = 100_000): ViralPost[] {
    // Filtro de idioma: remove posts claramente em espanhol
    const ptPosts = posts.filter(p => this.isPortuguese(p.caption ?? ''));
    const removedLang = posts.length - ptPosts.length;
    if (removedLang > 0) {
      process.stdout.write(`[LANG FILTER] ${removedLang} post(s) em outro idioma removidos\n`);
    }

    const withViews = ptPosts.filter(p => p.views !== undefined && p.views > 0);
    const withLikes = ptPosts.filter(p => p.views === undefined && (p.likes ?? 0) > 0);

    if (withViews.length === 0 && withLikes.length === 0) {
      process.stdout.write('[FILTER] Sem métricas confiáveis — usando ordem do Instagram\n');
      return ptPosts.map(p => ({ ...p, viral_score: 0 }));
    }

    // Filtro strict: somente posts que atingem minViews
    const strict = withViews.filter(p => (p.views ?? 0) >= minViews);
    process.stdout.write(`[FILTER] Threshold ${minViews.toLocaleString('pt-BR')}: ${strict.length} posts aceitos\n`);

    // Fallback leniente se menos de 3 aprovados
    const lenient = withViews.filter(p => (p.views ?? 0) >= minViews * 0.2);
    const filtered = strict.length >= 3 ? strict : lenient;

    // Ordenação: puramente por viral_score desc (sem mixar idade como desempate)
    const sorted = [...filtered, ...withLikes]
      .map(p => ({ ...p, viral_score: this.calculateViralScore(p) }))
      .sort((a, b) => b.viral_score - a.viral_score);

    process.stdout.write(`[TOP VIEWS] ${sorted.length} posts com ${minViews.toLocaleString('pt-BR')}+ views\n\n`);
    return sorted;
  }

  // ── Score de viralidade ──────────────────────────────────────────────────

  private calculateViralScore(post: RawPost): number {
    const views = post.views ?? 0;
    const likes = post.likes ?? 0;
    const comments = post.comments ?? 0;

    if (views > 0) {
      const engagementRate = (likes + comments * 2) / views;
      const base = Math.log10(views + 1) * (1 + engagementRate * 10);
      // Penaliza posts mais antigos (decai 1% por dia)
      const agePenalty = post.ageDays ? (1 - Math.min(post.ageDays, 45) * 0.01) : 1;
      return parseFloat((base * agePenalty).toFixed(2));
    }

    if (likes > 0) {
      const score = Math.log10(likes + 1) * (1 + (comments * 2 / (likes + 1)) * 10);
      const agePenalty = post.ageDays ? (1 - Math.min(post.ageDays, 45) * 0.01) : 1;
      return parseFloat((score * agePenalty).toFixed(2));
    }

    return 0;
  }

  // ── Parse de métricas do overlay/aria-label ──────────────────────────────

  /**
   * Melhoria 2: extrai views e curtidas do texto do overlay hover ou de aria-labels.
   * Suporta formatos PT-BR: "1.234", "10,5 mil", "2,5 mi", "1.5M"
   */
  parseMetricsFromHoverText(text: string): { views?: number; likes?: number } {
    if (!text || text.trim().length === 0) return {};

    const parseCount = (t: string): number => {
      // Millions: "1,2 mi", "1.2M", "2.5M plays", "1,5 milhão"
      // NÃO casa com "mil" simples (para não conflitar com milhares)
      const mi = t.match(/([0-9][0-9.,]*)\s*(?:milh[ãaoôõ]\w*|mi(?!\w)|M(?![a-z]))/i);
      if (mi) {
        return Math.round(parseFloat(mi[1].replace(',', '.')) * 1_000_000);
      }
      // Thousands: "10,5 mil", "10K", "12k"
      const k = t.match(/([0-9][0-9.,]*)\s*(?:mil\b|K|k)/i);
      if (k) {
        return Math.round(parseFloat(k[1].replace(',', '.')) * 1_000);
      }
      // Plain: "1.234" or "1234"
      const plain = t.match(/([0-9][0-9.,]*)/);
      if (plain) {
        const cleaned = plain[1].replace(/\./g, '').replace(',', '.');
        const n = parseFloat(cleaned);
        if (!isNaN(n)) return Math.round(n);
      }
      return 0;
    };

    const lower = text.toLowerCase();

    // Views: "X visualizações", "X views", "X plays", "X reproduções"
    if (lower.includes('visuali') || lower.includes('plays') || lower.includes('reproduç') ||
      lower.includes('views') || lower.includes('view')) {
      return { views: parseCount(text) };
    }

    // Likes: "X curtidas", "X curtir", "X likes"
    if (lower.includes('curtid') || lower.includes('curtir') || lower.includes('like') ||
      lower.includes('gosto')) {
      return { likes: parseCount(text) };
    }

    return {};
  }

  // ── randomDelay ──────────────────────────────────────────────────────────

  async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.random() * (max - min) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  // ── scrapeMultipleHashtags ────────────────────────────────────────────────

  /**
   * Busca múltiplas keywords usando /explore/tags/{hashtag}/ (Top Posts do Instagram).
   * Usa estratégia CLICK+ESC por padrão para métricas precisas.
   *
   * @param keywords             Lista de palavras-chave / hashtags
   * @param minViews             Mínimo de views para considerar viral (padrão: 100k)
   * @param maxPostsPerKeyword   Máximo de posts por keyword (padrão: 12)
   * @param maxAgeDays           Máximo de dias desde a publicação (padrão: 45)
   * @param strategy             'click' (padrão, preciso) ou 'hover' (legado)
   */
  async scrapeMultipleHashtags(
    keywords: string[],
    minViews = 100_000,
    maxPostsPerKeyword = 12,
    maxAgeDays = 45,
    strategy: 'click' | 'hover' = 'click'
  ): Promise<ViralPost[]> {
    process.stdout.write(`\n${'='.repeat(60)}\n`);
    process.stdout.write(`[IG SCRAPER] ${keywords.length} keywords | mín. ${minViews.toLocaleString('pt-BR')} views | máx. ${maxAgeDays}d\n`);
    process.stdout.write(`${'='.repeat(60)}\n\n`);

    const { context, page } = await this.openBrowser();
    const allResults: RawPost[] = [];

    try {
      await this.ensureLoggedIn(page);

      for (const keyword of keywords) {
        try {
          const { url: searchUrl, hashtag } = this.resolveSearchUrl(keyword);
          process.stdout.write(`\n[BUSCA] "${keyword}" → #${hashtag} → ${searchUrl}\n`);

          await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
          await this.randomDelay(2000, 3000);

          await page.waitForSelector('main a[href*="/reel/"], main a[href*="/p/"]', { timeout: 15_000 })
            .catch(() => { });

          await this.humanScroll(page, 4);

          // Roteamento por estratégia
          const approved = strategy === 'click'
            ? await this.collectLinksWithClick(page, minViews, maxPostsPerKeyword)
            : await this.collectLinksWithHover(page, minViews, maxPostsPerKeyword);

          process.stdout.write(`[BUSCA] ${approved.length} posts aprovados → extraindo detalhes...\n`);

          for (let i = 0; i < approved.length; i++) {
            const { url, gridViews, gridLikes } = approved[i];
            process.stdout.write(`  [${i + 1}/${approved.length}] ${url.slice(-40)}\n`);

            await page.mouse.move(Math.random() * 1080, Math.random() * 900, { steps: 3 });
            const postData = await this.extractPostData(url, page, maxAgeDays, gridViews, gridLikes);

            if (postData) allResults.push(postData);
            await this.randomDelay(1200, 2500);
          }
        } catch (err: any) {
          process.stderr.write(`[IG SCRAPER] Erro na keyword "${keyword}": ${err.message?.slice(0, 60)}\n`);
        }
      }
    } finally {
      await context.close();
    }

    process.stdout.write(`\n[MÉTRICAS] ${allResults.length} posts coletados com views | ${allResults.filter(p => p.likes).length} com curtidas\n`);

    const sorted = this.filterByVirality(allResults, minViews);

    process.stdout.write(`\n${'='.repeat(60)}\n`);
    process.stdout.write(`[RESULTADO] ${allResults.length} extraídos → ${sorted.length} virais (${minViews.toLocaleString('pt-BR')}+ views | ≤ ${maxAgeDays}d)\n`);
    process.stdout.write(`${'='.repeat(60)}\n\n`);

    sorted.forEach((p, i) => {
      const viewsLabel = p.views !== undefined ? `${p.views.toLocaleString('pt-BR')} views` : 'views n/d';
      const likesLabel = `${(p.likes ?? 0).toLocaleString('pt-BR')} curtidas`;
      process.stdout.write(
        `[${i + 1}] ${p.type ?? 'Post'} | ${viewsLabel} | ${likesLabel} | ${p.ageDays ?? '?'}d atrás\n` +
        `    Score: ${p.viral_score} | ${p.url}\n` +
        `    "${p.caption?.slice(0, 60) ?? '(sem legenda)'}"\n\n`
      );
    });

    return sorted;
  }

  // ── scrapeViralReels ──────────────────────────────────────────────────────

  /**
   * Busca uma única keyword.
   * Usa estratégia CLICK+ESC por padrão.
   */
  async scrapeViralReels(
    keyword: string,
    minViews = 100_000,
    maxPosts = 12,
    maxAgeDays = 45,
    strategy: 'click' | 'hover' = 'click'
  ): Promise<ViralPost[]> {
    process.stdout.write(`\n${'='.repeat(60)}\n`);
    process.stdout.write(`[IG SCRAPER] "#${keyword}" | mín. ${minViews.toLocaleString('pt-BR')} views | máx. ${maxPosts} posts | máx. ${maxAgeDays}d\n`);
    process.stdout.write(`${'='.repeat(60)}\n\n`);

    const { context, page } = await this.openBrowser();
    const results: RawPost[] = [];

    try {
      await this.ensureLoggedIn(page);

      const { url: searchUrl, hashtag } = this.resolveSearchUrl(keyword);
      process.stdout.write(`[PASSO 1] #${hashtag} → ${searchUrl}\n`);

      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await this.randomDelay(1500, 2500);

      await page.waitForSelector('main a[href*="/reel/"], main a[href*="/p/"]', { timeout: 15_000 })
        .catch(() => process.stderr.write(`[IG] Grid demorou para carregar\n`));

      process.stdout.write(`[PASSO 2] Carregando posts...\n`);
      await this.humanScroll(page, 4);

      process.stdout.write(`[PASSO 3] ${strategy === 'click' ? 'Click+Esc no modal para métricas precisas...' : 'Hover nos thumbnails...'}\n`);
      const approved = strategy === 'click'
        ? await this.collectLinksWithClick(page, minViews, maxPosts)
        : await this.collectLinksWithHover(page, minViews, maxPosts);

      process.stdout.write(`[PASSO 4] ${approved.length} aprovados. Extraindo detalhes...\n\n`);

      for (let i = 0; i < approved.length; i++) {
        const { url, gridViews, gridLikes } = approved[i];
        process.stdout.write(`[${i + 1}/${approved.length}] ${url.slice(-45)}\n`);
        const postData = await this.extractPostData(url, page, maxAgeDays, gridViews, gridLikes);
        if (postData) results.push(postData);
        await this.randomDelay(1000, 2000);
      }
    } finally {
      await context.close();
    }

    const viral = this.filterByVirality(results, minViews);

    process.stdout.write(`\n${'='.repeat(60)}\n`);
    process.stdout.write(`[RESULTADO] ${results.length} extraídos → ${viral.length} virais (${minViews.toLocaleString('pt-BR')}+ views | ≤ ${maxAgeDays}d)\n`);
    process.stdout.write(`${'='.repeat(60)}\n\n`);

    viral.forEach((p, i) => {
      const viewsLabel = p.views !== undefined ? `${p.views.toLocaleString('pt-BR')} views` : 'views n/d';
      process.stdout.write(
        `[${i + 1}] ${p.type ?? 'Post'} | ${viewsLabel} | ${(p.likes ?? 0).toLocaleString('pt-BR')} curtidas | ${p.ageDays ?? '?'}d atrás\n` +
        `    Score: ${p.viral_score} | ${p.url}\n` +
        `    "${p.caption?.slice(0, 60) ?? '(sem legenda)'}"\n\n`
      );
    });

    process.stdout.write(`\n✅ RESULTADO FINAL — ${viral.length} posts virais\n`);
    return viral;
  }
}
