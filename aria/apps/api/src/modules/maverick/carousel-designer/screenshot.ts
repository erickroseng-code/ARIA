import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { CarouselStructure } from './index';
import { generateSlideHtml } from './html-export';

// Chromium args for headless environments without GPU (AC: 3)
const CHROMIUM_ARGS = [
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
];

export interface ScreenshotResult {
  slidePaths: string[];   // absolute paths to PNG files
  tmpDir: string;         // directory holding the files (caller is responsible for cleanup)
}

/**
 * Takes a 1080×1080 PNG screenshot of a single slide HTML string (AC: 1, 2).
 * The outputPath directory is created if it doesn't exist.
 * Throws if Playwright or Chromium is unavailable.
 */
export async function screenshotSlide(html: string, outputPath: string): Promise<void> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ args: CHROMIUM_ARGS, headless: true });

  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1080, height: 1080 });
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200); // allow Google Fonts to render

    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });

    await page.screenshot({
      path: outputPath,
      type: 'png',
      clip: { x: 0, y: 0, width: 1080, height: 1080 },
    });
  } finally {
    await browser.close();
  }
}

/**
 * Takes a 1080×1080 screenshot of every slide in the carousel.
 * Returns paths to the generated PNGs, or null if Playwright is unavailable (AC: 6).
 *
 * Graceful fallback: if chromium is not installed or any error occurs,
 * the function returns null so callers can proceed without screenshots.
 */
export async function screenshotBatch(
  carousel: CarouselStructure,
  themeName: 'dark' | 'light' = 'dark',
): Promise<ScreenshotResult | null> {
  // Dynamic import — avoids hard crash when playwright binary is missing
  let chromium: typeof import('playwright').chromium | undefined;
  try {
    const pw = await import('playwright');
    chromium = pw.chromium;
  } catch {
    return null; // Playwright not installed
  }

  // Try to launch browser — if chromium is not downloaded this will throw
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({ args: CHROMIUM_ARGS, headless: true });
  } catch {
    return null; // Chromium not installed
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aria-carousel-'));
  const slidePaths: string[] = [];

  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1080, height: 1080 });

    for (const slide of carousel.slides) {
      const html = generateSlideHtml(slide, carousel.total_slides, themeName);
      await page.setContent(html, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);

      const filePath = path.join(tmpDir, `slide-${slide.position}.png`);
      await page.screenshot({
        path: filePath,
        type: 'png',
        clip: { x: 0, y: 0, width: 1080, height: 1080 },
      });

      slidePaths.push(filePath);
    }

    await page.close();
  } finally {
    await browser.close();
  }

  return { slidePaths, tmpDir };
}

/** Remove all PNG files and the temp directory created by screenshotBatch. */
export async function cleanupScreenshots(result: ScreenshotResult): Promise<void> {
  await fs.rm(result.tmpDir, { recursive: true, force: true });
}
