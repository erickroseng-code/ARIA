import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateSlideHtml } from '../carousel-designer/html-export';
import { screenshotBatch } from '../carousel-designer/screenshot';
import type { CarouselStructure } from '../carousel-designer/index';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SAMPLE_CAROUSEL: CarouselStructure = {
  title: 'Teste Carousel',
  format: 'Carrossel Educativo',
  total_slides: 3,
  slides: [
    { position: 1, type: 'cover', title: 'Capa', body: 'Texto da capa', visual_hint: 'foto' },
    { position: 2, type: 'content', title: 'Conteúdo', body: 'Texto de conteúdo', visual_hint: 'grafico' },
    { position: 3, type: 'cta', title: 'CTA', body: 'Siga para mais', visual_hint: 'seta' },
  ],
};

// ── generateSlideHtml ─────────────────────────────────────────────────────────

describe('generateSlideHtml', () => {
  test('retorna HTML completo com DOCTYPE', () => {
    const slide = SAMPLE_CAROUSEL.slides[0];
    const html = generateSlideHtml(slide, 3, 'dark');

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
  });

  test('HTML não tem padding no body (pronto para screenshot 1080×1080)', () => {
    const slide = SAMPLE_CAROUSEL.slides[0];
    const html = generateSlideHtml(slide, 3, 'dark');

    // Body deve ter width/height 1080px sem padding extra
    expect(html).toContain('1080px');
    expect(html).toContain('overflow: hidden');
  });

  test('tema dark aplica fundo correto', () => {
    const slide = SAMPLE_CAROUSEL.slides[0]; // cover
    const html = generateSlideHtml(slide, 3, 'dark');

    expect(html).toContain('#0d0d0d'); // dark cover bg
  });

  test('tema light aplica fundo correto', () => {
    const slide = SAMPLE_CAROUSEL.slides[0]; // cover
    const html = generateSlideHtml(slide, 3, 'light');

    expect(html).toContain('#FAFAFA'); // light cover bg
  });

  test('slide CTA usa fundo do tema CTA', () => {
    const ctaSlide = SAMPLE_CAROUSEL.slides[2];
    const html = generateSlideHtml(ctaSlide, 3, 'dark');

    expect(html).toContain('#0a0a0a'); // dark cta bg
  });

  test('inclui Google Fonts no head', () => {
    const slide = SAMPLE_CAROUSEL.slides[1];
    const html = generateSlideHtml(slide, 3, 'dark');

    expect(html).toContain('fonts.googleapis.com');
  });

  test('inclui texto do slide no HTML', () => {
    const slide = SAMPLE_CAROUSEL.slides[0];
    const html = generateSlideHtml(slide, 3, 'dark');

    expect(html).toContain('Capa');
    expect(html).toContain('Texto da capa');
  });
});

// ── screenshotBatch — fallback gracioso ───────────────────────────────────────

describe('screenshotBatch — fallback quando Playwright indisponível (AC: 6)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('retorna null quando playwright não está instalado', async () => {
    // Simula módulo playwright ausente
    vi.doMock('playwright', () => {
      throw new Error('Cannot find module playwright');
    });

    // Importa screenshotBatch depois do mock
    const { screenshotBatch: sb } = await import('../carousel-designer/screenshot.js');
    const result = await sb(SAMPLE_CAROUSEL, 'dark');

    expect(result).toBeNull();
  });

  test('retorna null quando chromium.launch falha (sem binário)', async () => {
    vi.doMock('playwright', () => ({
      chromium: {
        launch: vi.fn().mockRejectedValue(new Error('Executable path not found')),
      },
    }));

    const { screenshotBatch: sb } = await import('../carousel-designer/screenshot.js');
    const result = await sb(SAMPLE_CAROUSEL, 'dark');

    expect(result).toBeNull();
  });
});

// ── weekly-batch integração: hasScreenshots quando Playwright ausente ─────────

describe('weekly-batch — hasScreenshots flag (AC: 6)', () => {
  const SCRIPT_STUB = {
    title: 'Teste',
    format: 'Carrossel Educativo',
    hook: 'Hook de teste',
    body: 'Parágrafo 1.\n\nParágrafo 2.\n\nParágrafo 3.',
    visual_cues: ['v1', 'v2', 'v3'],
    cta: 'Salve!',
  };

  test('hasScreenshots é false quando Playwright indisponível', async () => {
    vi.resetModules();

    // Mock fetch para OpenRouter
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(SCRIPT_STUB) } }] }),
    }));

    // Mock screenshot para retornar null (Playwright ausente)
    vi.doMock('../carousel-designer/screenshot.js', () => ({
      screenshotBatch: vi.fn().mockResolvedValue(null),
      cleanupScreenshots: vi.fn().mockResolvedValue(undefined),
    }));

    const { runWeeklyBatch } = await import('../weekly-batch.service.js');
    const result = await runWeeklyBatch(['teste-topic'], 'dark', 'fake-key');

    expect(result.topics[0].status).toBe('success');
    expect(result.topics[0].carousel?.hasScreenshots).toBe(false);
    expect(result.topics[0].carousel?.screenshotPaths).toBeUndefined();
  });

  test('hasScreenshots é true quando Playwright disponível', async () => {
    vi.resetModules();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(SCRIPT_STUB) } }] }),
    }));

    // Mock screenshot retornando paths simulados
    const fakePaths = ['/tmp/aria-carousel-test/slide-1.png', '/tmp/aria-carousel-test/slide-2.png'];
    vi.doMock('../carousel-designer/screenshot.js', () => ({
      screenshotBatch: vi.fn().mockResolvedValue({
        slidePaths: fakePaths,
        tmpDir: '/tmp/aria-carousel-test',
      }),
      cleanupScreenshots: vi.fn().mockResolvedValue(undefined),
    }));

    const { runWeeklyBatch } = await import('../weekly-batch.service.js');
    const result = await runWeeklyBatch(['teste-topic'], 'dark', 'fake-key');

    expect(result.topics[0].status).toBe('success');
    expect(result.topics[0].carousel?.hasScreenshots).toBe(true);
    expect(result.topics[0].carousel?.screenshotPaths).toEqual(fakePaths);
  });
});
