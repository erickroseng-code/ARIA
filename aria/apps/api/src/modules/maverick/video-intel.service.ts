import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import Groq from 'groq-sdk';
import { chromium } from 'playwright';
import { deleteTempObjectFromR2, isR2Enabled, uploadTempObjectToR2 } from './r2-temp-storage.service';

export interface ReferenceVideoInput {
  title: string;
  content: string;
  views: number;
  url?: string;
}

export interface ReferenceVideoIntel {
  sourceUrl: string;
  mediaUrl: string | null;
  transcript: string;
  transcriptPreview: string;
  temporaryObjectKey: string | null;
  storageBackend: 'local' | 'r2';
  deletedAfterProcessing: boolean;
  error?: string;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function mkTmpKey(): string {
  const id = crypto.randomUUID();
  return `maverick/reels/${new Date().toISOString().slice(0, 10)}/${id}.mp4`;
}

function preview(text: string, max = 320): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, max);
}

async function resolveInstagramMediaUrl(reelUrl: string): Promise<string | null> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(reelUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1200);

    const fromOg = await page.locator('meta[property="og:video"]').first().getAttribute('content');
    if (fromOg) return fromOg;

    const fromSecureOg = await page.locator('meta[property="og:video:secure_url"]').first().getAttribute('content');
    if (fromSecureOg) return fromSecureOg;

    const html = await page.content();
    const m = html.match(/"video_url":"(https:[^"]+)"/);
    if (m?.[1]) {
      return m[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
    }
    return null;
  } finally {
    await browser.close();
  }
}

async function downloadToTemp(mediaUrl: string): Promise<{ filePath: string; key: string; bytes: Buffer }> {
  const res = await fetch(mediaUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    },
  });
  if (!res.ok) throw new Error(`Falha ao baixar midia: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) throw new Error('Midia vazia');
  if (buf.length > 60 * 1024 * 1024) throw new Error('Midia maior que 60MB (limite de processamento)');

  const key = mkTmpKey();
  const tmpBase = path.join(os.tmpdir(), 'aria-maverick-media');
  const filePath = path.join(tmpBase, sanitizeFilename(key));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buf);
  return { filePath, key, bytes: buf };
}

async function transcribeVideoFile(filePath: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return '';
  const groq = new Groq({ apiKey });
  const bytes = fs.readFileSync(filePath);
  const blob = new Blob([bytes], { type: 'video/mp4' });
  const file = new File([blob], 'reference.mp4', { type: 'video/mp4' });
  const transcription = await groq.audio.transcriptions.create({
    file,
    model: 'whisper-large-v3',
    language: 'pt',
    response_format: 'text',
  });
  return String(transcription ?? '').trim();
}

function toEnrichedContent(original: string, transcript: string): string {
  if (!transcript) return original;
  const t = preview(transcript, 500);
  return `${original}\nTranscript (trecho): ${t}`;
}

export async function enrichReferenceVideos(
  videos: ReferenceVideoInput[] | undefined,
): Promise<{ enrichedVideos: ReferenceVideoInput[]; intel: ReferenceVideoIntel[] }> {
  if (!videos || videos.length === 0) return { enrichedVideos: [], intel: [] };

  const maxToAnalyze = Number(process.env.MAVERICK_VIDEO_INTEL_MAX ?? 5);
  const selected = videos.slice(0, Math.max(1, Math.min(maxToAnalyze, videos.length)));
  const passthrough = videos.slice(selected.length);

  const intel: ReferenceVideoIntel[] = [];
  const enriched: ReferenceVideoInput[] = [];

  for (const v of selected) {
    let filePath: string | null = null;
    let key: string | null = null;
    const usingR2 = isR2Enabled();

    try {
      if (!v.url) {
        enriched.push(v);
        intel.push({
          sourceUrl: '',
          mediaUrl: null,
          transcript: '',
          transcriptPreview: '',
          temporaryObjectKey: null,
          storageBackend: usingR2 ? 'r2' : 'local',
          deletedAfterProcessing: true,
          error: 'Video sem URL',
        });
        continue;
      }

      const mediaUrl = await resolveInstagramMediaUrl(v.url);
      if (!mediaUrl) {
        enriched.push(v);
        intel.push({
          sourceUrl: v.url,
          mediaUrl: null,
          transcript: '',
          transcriptPreview: '',
          temporaryObjectKey: null,
          storageBackend: usingR2 ? 'r2' : 'local',
          deletedAfterProcessing: true,
          error: 'Nao foi possivel resolver URL de midia',
        });
        continue;
      }

      const dl = await downloadToTemp(mediaUrl);
      filePath = dl.filePath;
      key = dl.key;

      if (usingR2) {
        await uploadTempObjectToR2(key, dl.bytes);
      }

      const transcript = await transcribeVideoFile(filePath);

      enriched.push({
        ...v,
        content: toEnrichedContent(v.content, transcript),
      });

      intel.push({
        sourceUrl: v.url,
        mediaUrl,
        transcript,
        transcriptPreview: preview(transcript),
        temporaryObjectKey: key,
        storageBackend: usingR2 ? 'r2' : 'local',
        deletedAfterProcessing: false,
      });
    } catch (err: any) {
      enriched.push(v);
      intel.push({
        sourceUrl: v.url ?? '',
        mediaUrl: null,
        transcript: '',
        transcriptPreview: '',
        temporaryObjectKey: key,
        storageBackend: usingR2 ? 'r2' : 'local',
        deletedAfterProcessing: false,
        error: err?.message ?? 'Falha no processamento de midia',
      });
    } finally {
      if (key && usingR2) {
        try {
          await deleteTempObjectFromR2(key);
          const last = intel[intel.length - 1];
          if (last) last.deletedAfterProcessing = true;
        } catch {
          // non-blocking cleanup
        }
      }

      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          const last = intel[intel.length - 1];
          if (last) last.deletedAfterProcessing = true;
        } catch {
          // non-blocking cleanup
        }
      }
    }
  }

  return { enrichedVideos: [...enriched, ...passthrough], intel };
}
