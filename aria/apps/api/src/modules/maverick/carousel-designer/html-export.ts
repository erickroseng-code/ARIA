import { CarouselStructure } from './index';

const TYPE_COLORS: Record<string, { bg: string; accent: string; badge: string }> = {
  cover:   { bg: '#1a1a2e', accent: '#e94560', badge: '#e94560' },
  content: { bg: '#16213e', accent: '#0f3460', badge: '#0f3460' },
  cta:     { bg: '#0f3460', accent: '#e94560', badge: '#e94560' },
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function generateCarouselHtml(carousel: CarouselStructure): string {
  const slides = carousel.slides.map(slide => {
    const colors = TYPE_COLORS[slide.type] ?? TYPE_COLORS.content;
    const typeLabel = slide.type === 'cover' ? 'CAPA' : slide.type === 'cta' ? 'CTA' : 'CONTEÚDO';

    return `
    <div class="slide" style="
      width: 1080px;
      height: 1080px;
      background: ${colors.bg};
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 80px;
      box-sizing: border-box;
      border: 2px solid ${colors.accent};
      border-radius: 12px;
      margin-bottom: 40px;
      page-break-after: always;
      font-family: 'Segoe UI', Arial, sans-serif;
    ">
      <!-- Número e tipo -->
      <div style="position: absolute; top: 40px; left: 80px; display: flex; gap: 12px; align-items: center;">
        <span style="
          background: rgba(255,255,255,0.1);
          color: #fff;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
        ">${slide.position}/${carousel.total_slides}</span>
        <span style="
          background: ${colors.badge};
          color: #fff;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.5px;
        ">${typeLabel}</span>
      </div>

      <!-- Título -->
      <h2 style="
        color: #ffffff;
        font-size: ${slide.type === 'cover' ? '56px' : '48px'};
        font-weight: 800;
        line-height: 1.2;
        margin: 0 0 32px 0;
        max-width: 900px;
      ">${escapeHtml(slide.title)}</h2>

      <!-- Body -->
      <p style="
        color: rgba(255,255,255,0.85);
        font-size: 28px;
        line-height: 1.6;
        margin: 0 0 40px 0;
        max-width: 900px;
      ">${escapeHtml(slide.body)}</p>

      <!-- Visual hint -->
      <div style="
        position: absolute;
        bottom: 40px;
        left: 80px;
        right: 80px;
        background: rgba(255,255,255,0.06);
        border: 1px dashed rgba(255,255,255,0.2);
        border-radius: 8px;
        padding: 16px 24px;
        display: flex;
        align-items: center;
        gap: 10px;
      ">
        <span style="font-size: 20px;">🎨</span>
        <span style="color: rgba(255,255,255,0.6); font-size: 18px; font-style: italic;">${escapeHtml(slide.visual_hint)}</span>
      </div>
    </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(carousel.title)} — Carrossel</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0d0d0d;
      padding: 40px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .header {
      color: #fff;
      text-align: center;
      margin-bottom: 48px;
    }
    .header h1 {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .header p {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 16px;
      color: rgba(255,255,255,0.5);
    }
    .slide {
      transform-origin: top center;
    }
    @media (max-width: 1200px) {
      .slide { transform: scale(0.5); margin-bottom: -500px; }
    }
    @media print {
      body { background: white; padding: 0; }
      .header { display: none; }
      .slide { border: none !important; margin-bottom: 0 !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(carousel.title)}</h1>
    <p>${escapeHtml(carousel.format)} &bull; ${carousel.total_slides} slides</p>
  </div>
  ${slides}
</body>
</html>`;
}
