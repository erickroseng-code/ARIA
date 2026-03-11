export interface Slide {
  position: number;
  type: 'cover' | 'content' | 'cta';
  title: string;
  body: string;
  visual_hint: string;
}

export interface CarouselStructure {
  title: string;
  format: string;
  total_slides: number;
  slides: Slide[];
}

export interface ScriptInput {
  title: string;
  format: string;
  hook: string;
  body: string;
  visual_cues: string[];
  cta: string;
}

export function generateCarouselStructure(script: ScriptInput): CarouselStructure {
  const slides: Slide[] = [];

  // ── Slide 1: Cover (derived from hook) ─────────────────────────────────────
  const hookLines = script.hook.split('\n').filter(l => l.trim());
  slides.push({
    position: 1,
    type: 'cover',
    title: truncate(hookLines[0] ?? script.title, 60),
    body: truncate(hookLines.slice(1).join(' ') || script.hook, 120),
    visual_hint: script.visual_cues[0] ?? 'Imagem de impacto relacionada ao tema',
  });

  // ── Slides 2-N: Content (body paragraphs, max 6) ──────────────────────────
  const paragraphs = script.body
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 10)
    .slice(0, 6);

  // Fallback: se body não tiver parágrafos separados por linha dupla, quebra por frase
  const contentBlocks = paragraphs.length > 0
    ? paragraphs
    : script.body.split(/(?<=[.!?])\s+/).filter(s => s.length > 10).slice(0, 4);

  contentBlocks.forEach((block, i) => {
    slides.push({
      position: i + 2,
      type: 'content',
      title: extractTitle(block, i + 2),
      body: truncate(block, 120),
      visual_hint: script.visual_cues[i + 1] ?? `Visual para o ponto ${i + 1}`,
    });
  });

  // Ensure at least 1 content slide
  if (slides.length < 2) {
    slides.push({
      position: 2,
      type: 'content',
      title: 'Saiba mais',
      body: truncate(script.body || script.hook, 120),
      visual_hint: script.visual_cues[1] ?? 'Visual de suporte',
    });
  }

  // ── Slide final: CTA ───────────────────────────────────────────────────────
  slides.push({
    position: slides.length + 1,
    type: 'cta',
    title: 'Próximo passo',
    body: truncate(script.cta, 120),
    visual_hint: 'Call-to-action claro, fundo contrastante',
  });

  return {
    title: script.title,
    format: script.format,
    total_slides: slides.length,
    slides,
  };
}

function truncate(text: string, maxLen: number): string {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3).trimEnd() + '...';
}

function extractTitle(paragraph: string, slideNum: number): string {
  const firstSentence = paragraph.split(/[.!?\n]/)[0]?.trim() ?? '';
  if (firstSentence.length >= 5 && firstSentence.length <= 50) {
    return firstSentence;
  }
  return `Ponto ${slideNum - 1}`;
}
