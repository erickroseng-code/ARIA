import { CarouselStructure, Slide } from './index';

/**
 * Design system extracted from Instagram carousel references:
 * - Dark premium: #0d0d0d bg, white text, red accent (dramatic, high-engagement)
 * - Light clean: #ffffff bg, dark text, subtle accents (professional, readable)
 *
 * Templates follow "tweet-style" layout: author badge + title + body + visual hint
 */

// ── Fonts ──────────────────────────────────────────────────────────────────────
const GOOGLE_FONTS = `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Bebas+Neue&display=swap`;

// ── Themes ────────────────────────────────────────────────────────────────────
interface Theme {
  slideBg: Record<string, string>;
  slideText: string;
  slideSubtext: string;
  accent: string;
  badgeBg: string;
  badgeText: string;
  tagBg: string;
  tagText: string;
  bodyBg: string;
  titleFont: string;
  bodyFont: string;
}

const THEMES: Record<string, Theme> = {
  dark: {
    slideBg:    { cover: '#0d0d0d', content: '#111111', cta: '#0a0a0a' },
    slideText:  '#FFFFFF',
    slideSubtext: 'rgba(255,255,255,0.65)',
    accent:     '#E53E3E',
    badgeBg:    '#E53E3E',
    badgeText:  '#FFFFFF',
    tagBg:      'rgba(255,255,255,0.08)',
    tagText:    'rgba(255,255,255,0.7)',
    bodyBg:     '#0a0a0a',
    titleFont:  "'Bebas Neue', 'Arial Narrow', Arial, sans-serif",
    bodyFont:   "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  light: {
    slideBg:    { cover: '#FAFAFA', content: '#FFFFFF', cta: '#111111' },
    slideText:  '#111111',
    slideSubtext: 'rgba(17,17,17,0.55)',
    accent:     '#E53E3E',
    badgeBg:    '#111111',
    badgeText:  '#FFFFFF',
    tagBg:      'rgba(0,0,0,0.06)',
    tagText:    'rgba(0,0,0,0.6)',
    bodyBg:     '#F0F0F0',
    titleFont:  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    bodyFont:   "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
};

// ── CTA theme override (always inverted for contrast) ─────────────────────────
function getCtaTheme(baseTheme: Theme): Partial<Theme> {
  return {
    slideText: baseTheme.bodyBg === '#0a0a0a' ? '#FFFFFF' : '#FFFFFF',
    slideSubtext: 'rgba(255,255,255,0.7)',
  };
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getTypeLabel(type: string): string {
  return type === 'cover' ? 'CAPA' : type === 'cta' ? 'CTA' : 'CONTEÚDO';
}

function getTitleSize(type: string, themeName: string): string {
  if (type === 'cover') return themeName === 'dark' ? '72px' : '60px';
  if (type === 'cta')   return '52px';
  return '46px';
}

// ── Slide generator ───────────────────────────────────────────────────────────
function renderSlide(
  slide: CarouselStructure['slides'][number],
  total: number,
  theme: Theme,
  themeName: string
): string {
  const isCta    = slide.type === 'cta';
  const bg       = theme.slideBg[slide.type] ?? theme.slideBg.content;
  const textCol  = isCta ? '#FFFFFF' : theme.slideText;
  const subCol   = isCta ? 'rgba(255,255,255,0.7)' : theme.slideSubtext;
  const accent   = theme.accent;
  const typeLabel = getTypeLabel(slide.type);
  const titleSize = getTitleSize(slide.type, themeName);
  const isDark   = themeName === 'dark' || isCta;

  // Accent line: subtle top stripe for dark, bottom stripe for light
  const accentLine = isDark
    ? `position: absolute; top: 0; left: 0; width: 100%; height: 3px; background: ${accent};`
    : `position: absolute; bottom: 0; left: 0; width: 100%; height: 3px; background: ${accent};`;

  return `
    <div class="slide" style="
      width: 1080px;
      height: 1080px;
      background: ${bg};
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 88px 96px;
      box-sizing: border-box;
      margin-bottom: 40px;
    ">
      <!-- Accent line -->
      <div style="${accentLine}"></div>

      <!-- Counter + type badge -->
      <div style="
        position: absolute;
        top: 52px;
        left: 96px;
        right: 96px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      ">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="
            background: ${theme.tagBg};
            color: ${theme.tagText};
            padding: 6px 14px;
            border-radius: 100px;
            font-family: ${theme.bodyFont};
            font-size: 13px;
            font-weight: 600;
            letter-spacing: 0.5px;
          ">${slide.position} / ${total}</span>
          <span style="
            background: ${theme.badgeBg};
            color: ${theme.badgeText};
            padding: 6px 14px;
            border-radius: 100px;
            font-family: ${theme.bodyFont};
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 1px;
            text-transform: uppercase;
          ">${typeLabel}</span>
        </div>
        <!-- Swipe hint (only on cover) -->
        ${slide.type === 'cover' ? `
        <span style="
          color: ${subCol};
          font-family: ${theme.bodyFont};
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          gap: 6px;
        ">DESLIZE →</span>` : ''}
      </div>

      <!-- Main content -->
      <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; padding-top: 40px;">
        <!-- Title -->
        <h2 style="
          color: ${textCol};
          font-family: ${theme.titleFont};
          font-size: ${titleSize};
          font-weight: ${themeName === 'dark' ? '400' : '800'};
          line-height: ${themeName === 'dark' ? '1.0' : '1.1'};
          margin: 0 0 ${slide.type === 'cover' ? '40px' : '32px'} 0;
          letter-spacing: ${themeName === 'dark' ? '1px' : '-1px'};
          text-transform: ${themeName === 'dark' ? 'uppercase' : 'none'};
          max-width: 860px;
        ">${escapeHtml(slide.title)}</h2>

        <!-- Accent separator for dark cover -->
        ${slide.type === 'cover' && themeName === 'dark' ? `
        <div style="width: 64px; height: 3px; background: ${accent}; margin-bottom: 32px; border-radius: 2px;"></div>
        ` : ''}

        <!-- Body text -->
        <p style="
          color: ${subCol};
          font-family: ${theme.bodyFont};
          font-size: ${slide.type === 'cover' ? '24px' : '26px'};
          font-weight: 400;
          line-height: 1.65;
          margin: 0;
          max-width: 820px;
        ">${escapeHtml(slide.body)}</p>

        <!-- CTA arrow -->
        ${slide.type === 'cta' ? `
        <div style="
          margin-top: 48px;
          display: inline-flex;
          align-items: center;
          gap: 12px;
          background: ${accent};
          color: #fff;
          padding: 16px 32px;
          border-radius: 8px;
          font-family: ${theme.bodyFont};
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 0.5px;
          width: fit-content;
        ">Siga para mais conteúdo <span style="font-size: 20px;">→</span></div>
        ` : ''}
      </div>

    </div>`;
}

// ── Single-slide export (for Playwright screenshots) ──────────────────────────
/**
 * Generates a standalone 1080×1080 HTML page for a single slide.
 * No body padding, no page header, no scaling — pure slide for screenshot.
 */
export function generateSlideHtml(
  slide: Slide,
  total: number,
  themeName: 'dark' | 'light' = 'dark',
): string {
  const theme = THEMES[themeName] ?? THEMES.dark;
  const slideHtml = renderSlide(slide, total, theme, themeName);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${GOOGLE_FONTS}" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 1080px; height: 1080px; overflow: hidden; background: ${theme.slideBg[slide.type] ?? theme.slideBg.content}; }
    .slide { margin-bottom: 0 !important; }
  </style>
</head>
<body>${slideHtml}</body>
</html>`;
}

// ── Main export function ───────────────────────────────────────────────────────
export function generateCarouselHtml(
  carousel: CarouselStructure,
  themeName: 'dark' | 'light' = 'dark'
): string {
  const theme = THEMES[themeName] ?? THEMES.dark;
  const slides = carousel.slides
    .map(slide => renderSlide(slide, carousel.total_slides, theme, themeName))
    .join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(carousel.title)} — Carrossel</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${GOOGLE_FONTS}" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background: ${theme.bodyBg};
      padding: 48px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      font-family: ${theme.bodyFont};
    }

    /* Page header */
    .header {
      color: ${theme.slideText};
      text-align: center;
      margin-bottom: 56px;
      opacity: ${themeName === 'dark' ? '1' : '0.85'};
    }
    .header h1 {
      font-family: ${theme.titleFont};
      font-size: ${themeName === 'dark' ? '36px' : '28px'};
      font-weight: ${themeName === 'dark' ? '400' : '800'};
      letter-spacing: ${themeName === 'dark' ? '2px' : '-0.5px'};
      text-transform: ${themeName === 'dark' ? 'uppercase' : 'none'};
      margin-bottom: 10px;
    }
    .header p {
      font-size: 14px;
      color: ${theme.slideSubtext};
      letter-spacing: 0.5px;
    }

    /* Slide container */
    .slide-wrapper {
      position: relative;
      width: 1080px;
      margin-bottom: 32px;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 40px rgba(0,0,0,0.3);
    }

    .slide {
      display: block;
    }

    /* Responsive scaling */
    @media (max-width: 1180px) {
      .slide-wrapper { transform: scale(0.75); transform-origin: top center; margin-bottom: calc(1080px * 0.75 - 1080px + 32px); }
    }
    @media (max-width: 860px) {
      .slide-wrapper { transform: scale(0.5); transform-origin: top center; margin-bottom: calc(1080px * 0.5 - 1080px + 32px); }
    }
    @media (max-width: 580px) {
      .slide-wrapper { transform: scale(0.35); transform-origin: top center; margin-bottom: calc(1080px * 0.35 - 1080px + 32px); }
    }

    /* Print */
    @media print {
      body { background: white; padding: 0; }
      .header { display: none; }
      .slide-wrapper { box-shadow: none; margin-bottom: 0; border-radius: 0; break-after: page; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(carousel.title)}</h1>
    <p>${escapeHtml(carousel.format)} &bull; ${carousel.total_slides} slides &bull; tema: ${themeName}</p>
  </div>

  ${carousel.slides.map(slide => `
  <div class="slide-wrapper">
    ${renderSlide(slide, carousel.total_slides, theme, themeName)}
  </div>`).join('\n')}

</body>
</html>`;
}
