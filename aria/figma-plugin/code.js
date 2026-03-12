// ── Aria Carousel Plugin ──────────────────────────────────────────────────────
// Gera frames de carrossel 1080×1080px no Figma a partir do JSON do Maverick.
// Design system extraído de referências reais do Instagram.

figma.showUI(__html__, { width: 360, height: 520 });

// ── Design tokens ─────────────────────────────────────────────────────────────

const THEMES = {
  dark: {
    slideBg: {
      cover:   { r: 0.051, g: 0.051, b: 0.051 },  // #0d0d0d
      content: { r: 0.067, g: 0.067, b: 0.067 },  // #111111
      cta:     { r: 0.039, g: 0.039, b: 0.039 },  // #0a0a0a
    },
    text:      { r: 1, g: 1, b: 1 },
    subtext:   { r: 1, g: 1, b: 1, a: 0.65 },
    accent:    { r: 0.898, g: 0.243, b: 0.243 },  // #E53E3E
    badgeBg:   { r: 0.898, g: 0.243, b: 0.243 },
    badgeText: { r: 1, g: 1, b: 1 },
    tagBg:     { r: 1, g: 1, b: 1, a: 0.08 },
    tagText:   { r: 1, g: 1, b: 1, a: 0.7 },
    titleFont: { family: 'Inter', style: 'Black' },
    bodyFont:  { family: 'Inter', style: 'Regular' },
    titleSize: { cover: 72, content: 52, cta: 52 },
    uppercase: true,
    letterSpacing: 1,
  },
  light: {
    slideBg: {
      cover:   { r: 0.98, g: 0.98, b: 0.98 },     // #FAFAFA
      content: { r: 1, g: 1, b: 1 },               // #FFFFFF
      cta:     { r: 0.067, g: 0.067, b: 0.067 },  // #111111
    },
    text:      { r: 0.067, g: 0.067, b: 0.067 },
    subtext:   { r: 0.067, g: 0.067, b: 0.067, a: 0.55 },
    accent:    { r: 0.898, g: 0.243, b: 0.243 },
    badgeBg:   { r: 0.067, g: 0.067, b: 0.067 },
    badgeText: { r: 1, g: 1, b: 1 },
    tagBg:     { r: 0, g: 0, b: 0, a: 0.06 },
    tagText:   { r: 0, g: 0, b: 0, a: 0.6 },
    titleFont: { family: 'Inter', style: 'Extra Bold' },
    bodyFont:  { family: 'Inter', style: 'Regular' },
    titleSize: { cover: 60, content: 48, cta: 48 },
    uppercase: false,
    letterSpacing: -1,
  },
};

const SIZE = 1080;
const PAD  = 96;   // left/right padding

// ── Helpers ───────────────────────────────────────────────────────────────────

function solidFill(color) {
  const { r, g, b, a = 1 } = color;
  return [{ type: 'SOLID', color: { r, g, b }, opacity: a }];
}

async function loadFonts(theme) {
  await figma.loadFontAsync(theme.titleFont);
  await figma.loadFontAsync(theme.bodyFont);
  await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' }); // badges
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });      // CTA button
}

function typeLabel(type) {
  return type === 'cover' ? 'CAPA' : type === 'cta' ? 'CTA' : 'CONTEÚDO';
}

// Fetch image from Unsplash and return as Uint8Array
async function fetchUnsplashImage(query, accessKey) {
  try {
    const metaRes = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=squarish&client_id=${accessKey}`
    );
    if (!metaRes.ok) return null;
    const meta = await metaRes.json();
    const imgUrl = meta.urls && meta.urls.regular;
    if (!imgUrl) return null;

    const imgRes = await fetch(imgUrl);
    if (!imgRes.ok) return null;
    const buffer = await imgRes.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (e) {
    return null;
  }
}

// ── Slide builder ─────────────────────────────────────────────────────────────

async function createSlide(slide, total, theme, themeName, unsplashKey) {
  const t = THEMES[themeName];
  const isCta = slide.type === 'cta';
  const isDark = themeName === 'dark';

  // ── Frame ──────────────────────────────────────────────────────────────────
  const frame = figma.createFrame();
  frame.name = `${slide.position}. ${typeLabel(slide.type)} — ${slide.title.substring(0, 40)}`;
  frame.resize(SIZE, SIZE);
  frame.fills = solidFill(t.slideBg[slide.type] || t.slideBg.content);
  frame.clipsContent = true;

  // ── Unsplash background image (optional, content slides only) ──────────────
  if (unsplashKey && slide.type === 'content' && slide.visual_hint) {
    figma.ui.postMessage({ type: 'progress', message: `Buscando imagem: "${slide.visual_hint}"...` });
    const imgBytes = await fetchUnsplashImage(slide.visual_hint, unsplashKey);
    if (imgBytes) {
      const imgHash = figma.createImage(imgBytes).hash;
      // Image in bottom 40% of slide with overlay
      const imgRect = figma.createRectangle();
      imgRect.name = 'Image';
      imgRect.resize(SIZE, SIZE * 0.42);
      imgRect.x = 0;
      imgRect.y = SIZE * 0.58;
      imgRect.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: imgHash }];
      frame.appendChild(imgRect);

      // Dark overlay over image
      const overlay = figma.createRectangle();
      overlay.name = 'Image Overlay';
      overlay.resize(SIZE, SIZE * 0.42);
      overlay.x = 0;
      overlay.y = SIZE * 0.58;
      overlay.fills = solidFill({ r: 0, g: 0, b: 0, a: 0.45 });
      frame.appendChild(overlay);
    }
  }

  // ── Accent line (top for dark, bottom for light) ───────────────────────────
  const accentLine = figma.createRectangle();
  accentLine.name = 'Accent Line';
  accentLine.resize(SIZE, 4);
  accentLine.x = 0;
  accentLine.y = isDark ? 0 : SIZE - 4;
  accentLine.fills = solidFill(t.accent);
  frame.appendChild(accentLine);

  // ── Counter badge ──────────────────────────────────────────────────────────
  const counterBg = figma.createRectangle();
  counterBg.name = 'Counter BG';
  counterBg.resize(72, 32);
  counterBg.x = PAD;
  counterBg.y = 52;
  counterBg.cornerRadius = 100;
  counterBg.fills = solidFill(t.tagBg);
  frame.appendChild(counterBg);

  const counterText = figma.createText();
  counterText.name = 'Counter';
  counterText.fontName = { family: 'Inter', style: 'Semi Bold' };
  counterText.fontSize = 13;
  counterText.characters = `${slide.position} / ${total}`;
  counterText.fills = solidFill(t.tagText);
  counterText.x = PAD + 14;
  counterText.y = 58;
  frame.appendChild(counterText);

  // ── Type badge ─────────────────────────────────────────────────────────────
  const badgeLabel = typeLabel(slide.type);
  const badgeW = badgeLabel.length * 8 + 28;
  const badgeBg = figma.createRectangle();
  badgeBg.name = 'Type Badge BG';
  badgeBg.resize(badgeW, 32);
  badgeBg.x = PAD + 82;
  badgeBg.y = 52;
  badgeBg.cornerRadius = 100;
  badgeBg.fills = solidFill(t.badgeBg);
  frame.appendChild(badgeBg);

  const badgeText = figma.createText();
  badgeText.name = 'Type Badge';
  badgeText.fontName = { family: 'Inter', style: 'Bold' };
  badgeText.fontSize = 11;
  badgeText.characters = badgeLabel;
  badgeText.fills = solidFill(t.badgeText);
  badgeText.letterSpacing = { value: 1, unit: 'PIXELS' };
  badgeText.x = PAD + 82 + 14;
  badgeText.y = 59;
  frame.appendChild(badgeText);

  // ── "DESLIZE →" hint (cover only) ─────────────────────────────────────────
  if (slide.type === 'cover') {
    const swipeHint = figma.createText();
    swipeHint.name = 'Swipe Hint';
    swipeHint.fontName = { family: 'Inter', style: 'Semi Bold' };
    swipeHint.fontSize = 12;
    swipeHint.characters = 'DESLIZE →';
    swipeHint.fills = solidFill(t.subtext);
    swipeHint.letterSpacing = { value: 0.5, unit: 'PIXELS' };
    swipeHint.x = SIZE - PAD - 90;
    swipeHint.y = 62;
    frame.appendChild(swipeHint);
  }

  // ── Title ──────────────────────────────────────────────────────────────────
  const titleNode = figma.createText();
  titleNode.name = 'Title';
  titleNode.fontName = t.titleFont;
  titleNode.fontSize = t.titleSize[slide.type] || 52;
  titleNode.characters = t.uppercase ? slide.title.toUpperCase() : slide.title;
  titleNode.fills = solidFill(isCta && isDark ? { r: 1, g: 1, b: 1 } : t.text);
  titleNode.letterSpacing = { value: t.letterSpacing, unit: 'PIXELS' };
  titleNode.lineHeight = { value: isDark ? 100 : 110, unit: 'PERCENT' };
  titleNode.textAutoResize = 'HEIGHT';
  titleNode.resize(SIZE - PAD * 2, 100); // width fixed, height auto
  titleNode.x = PAD;
  titleNode.y = 360;
  frame.appendChild(titleNode);

  let cursorY = titleNode.y + titleNode.height;

  // ── Red separator line (dark cover only) ──────────────────────────────────
  if (slide.type === 'cover' && isDark) {
    const sep = figma.createRectangle();
    sep.name = 'Separator';
    sep.resize(64, 4);
    sep.x = PAD;
    sep.y = cursorY + 24;
    sep.cornerRadius = 2;
    sep.fills = solidFill(t.accent);
    frame.appendChild(sep);
    cursorY = sep.y + sep.height;
  }

  // ── Body text ──────────────────────────────────────────────────────────────
  const bodyNode = figma.createText();
  bodyNode.name = 'Body';
  bodyNode.fontName = t.bodyFont;
  bodyNode.fontSize = slide.type === 'cover' ? 24 : 26;
  bodyNode.characters = slide.body;
  bodyNode.fills = solidFill(isCta && isDark ? { r: 1, g: 1, b: 1, a: 0.7 } : t.subtext);
  bodyNode.lineHeight = { value: 165, unit: 'PERCENT' };
  bodyNode.textAutoResize = 'HEIGHT';
  bodyNode.resize(SIZE - PAD * 2, 100);
  bodyNode.x = PAD;
  bodyNode.y = cursorY + (slide.type === 'cover' ? 24 : 28);
  frame.appendChild(bodyNode);

  cursorY = bodyNode.y + bodyNode.height;

  // ── CTA button ─────────────────────────────────────────────────────────────
  if (slide.type === 'cta') {
    const btnW = 340;
    const btnH = 64;
    const btnBg = figma.createRectangle();
    btnBg.name = 'CTA Button BG';
    btnBg.resize(btnW, btnH);
    btnBg.x = PAD;
    btnBg.y = cursorY + 48;
    btnBg.cornerRadius = 10;
    btnBg.fills = solidFill(t.accent);
    frame.appendChild(btnBg);

    const btnLabel = figma.createText();
    btnLabel.name = 'CTA Button Label';
    btnLabel.fontName = { family: 'Inter', style: 'Bold' };
    btnLabel.fontSize = 18;
    btnLabel.characters = 'Siga para mais conteúdo →';
    btnLabel.fills = solidFill({ r: 1, g: 1, b: 1 });
    btnLabel.x = PAD + 24;
    btnLabel.y = cursorY + 48 + 20;
    frame.appendChild(btnLabel);
  }

  return frame;
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

figma.ui.onmessage = async (msg) => {

  if (msg.type === 'cancel') {
    figma.closePlugin();
    return;
  }

  if (msg.type === 'generate') {
    const { carousel, theme, unsplashKey } = msg;

    try {
      const t = THEMES[theme] || THEMES.dark;

      figma.ui.postMessage({ type: 'progress', message: 'Carregando fontes...' });
      await loadFonts(t);

      // Create a new page for the carousel
      const page = figma.createPage();
      page.name = `🎨 ${carousel.title}`;
      figma.currentPage = page;

      const frames = [];
      for (const slide of carousel.slides) {
        figma.ui.postMessage({
          type: 'progress',
          message: `Criando slide ${slide.position}/${carousel.total_slides}...`,
        });
        const frame = await createSlide(slide, carousel.total_slides, t, theme, unsplashKey);
        // Lay out slides horizontally with gap
        frame.x = (frames.length) * (SIZE + 40);
        frame.y = 0;
        page.appendChild(frame);
        frames.push(frame);
      }

      // Select all frames and zoom to fit
      figma.currentPage.selection = frames;
      figma.viewport.scrollAndZoomIntoView(frames);

      figma.ui.postMessage({ type: 'done', count: frames.length });

    } catch (err) {
      figma.ui.postMessage({ type: 'error', message: err.message || String(err) });
    }
  }
};
