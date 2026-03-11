import archiver from 'archiver';
import fs from 'fs';
import { BatchResult } from './weekly-batch.service.js';

/**
 * Packages all slides from a completed batch into a single ZIP buffer.
 *
 * ZIP structure:
 *   carrossets-{DATE}/
 *   ├── topico-01-emagrecimento-feminino/
 *   │   ├── slide-1.png          ← PNG if Playwright was available
 *   │   └── slide-2.png
 *   └── topico-02-mindset-financeiro/
 *       └── carousel-completo.html  ← HTML fallback when no screenshots
 */
export function createBatchZip(batch: BatchResult): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = archiver('zip', { zlib: { level: 6 } });

    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);

    const date = batch.generatedAt.slice(0, 10);
    const folderName = `carrossets-${date}`;

    batch.topics.forEach((topic, i) => {
      if (topic.status !== 'success' || !topic.carousel) return;

      const slug = topic.topic
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 40);
      const topicFolder = `${folderName}/topico-${String(i + 1).padStart(2, '0')}-${slug}`;

      if (topic.carousel.hasScreenshots && topic.carousel.screenshotPaths?.length) {
        // PNGs from Playwright screenshots
        for (const pngPath of topic.carousel.screenshotPaths) {
          if (fs.existsSync(pngPath)) {
            const basename = pngPath.split(/[\\/]/).pop() ?? `slide-${i}.png`;
            archive.file(pngPath, { name: `${topicFolder}/${basename}` });
          }
        }
      } else {
        // Fallback: include the full HTML carousel
        archive.append(topic.carousel.htmlExport, {
          name: `${topicFolder}/carousel-completo.html`,
        });
      }
    });

    archive.finalize();
  });
}

/** Returns a sanitized filename for the ZIP download. */
export function getBatchFilename(batch: BatchResult): string {
  const date = batch.generatedAt.slice(0, 10);
  return `carrossets-${date}.zip`;
}
