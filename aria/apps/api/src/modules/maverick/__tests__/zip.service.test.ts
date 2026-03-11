import { describe, test, expect, vi } from 'vitest';
import { createBatchZip, getBatchFilename } from '../zip.service';
import type { BatchResult } from '../weekly-batch.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BATCH_WITH_HTML: BatchResult = {
  batchId: 'batch-2026-03-10-abcd1234',
  generatedAt: '2026-03-10T11:00:00.000Z',
  topics: [
    {
      topic: 'emagrecimento feminino',
      status: 'success',
      carousel: {
        title: 'Emagreça sem sofrimento',
        total_slides: 3,
        slides: [],
        htmlExport: '<html><body>Slide 1</body></html>',
        hasScreenshots: false,
      },
    },
    {
      topic: 'mindset financeiro',
      status: 'error',
      error: 'LLM timeout',
    },
    {
      topic: 'produtividade',
      status: 'success',
      carousel: {
        title: 'Seja mais produtivo',
        total_slides: 3,
        slides: [],
        htmlExport: '<html><body>Produtividade</body></html>',
        hasScreenshots: false,
      },
    },
  ],
};

// ── getBatchFilename ─────────────────────────────────────────────────────────

describe('getBatchFilename', () => {
  test('extrai data do generatedAt e formata nome do arquivo', () => {
    const filename = getBatchFilename(BATCH_WITH_HTML);
    expect(filename).toBe('carrossets-2026-03-10.zip');
  });
});

// ── createBatchZip — HTML fallback ────────────────────────────────────────────

describe('createBatchZip — HTML fallback (AC: 5)', () => {
  // Mock fs.existsSync to return false (no PNG files)
  vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('fs')>();
    return {
      ...actual,
      existsSync: vi.fn().mockReturnValue(false),
      default: {
        ...actual,
        existsSync: vi.fn().mockReturnValue(false),
      },
    };
  });

  test('retorna Buffer com conteúdo ZIP', async () => {
    const result = await createBatchZip(BATCH_WITH_HTML);

    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });

  test('ZIP começa com magic bytes PK (0x50 0x4B)', async () => {
    const result = await createBatchZip(BATCH_WITH_HTML);

    // ZIP magic bytes: PK (0x50 0x4B 0x03 0x04)
    expect(result[0]).toBe(0x50); // P
    expect(result[1]).toBe(0x4B); // K
  });

  test('tópicos com status error são ignorados no ZIP', async () => {
    const result = await createBatchZip(BATCH_WITH_HTML);

    // ZIP should not be empty (has 2 success topics)
    expect(result.length).toBeGreaterThan(100);

    // The error topic ('mindset financeiro') shouldn't appear in filename listing
    const zipStr = result.toString('latin1');
    expect(zipStr).not.toContain('mindset-financeiro');
  });

  test('inclui carousel-completo.html como fallback para tópicos sem screenshot', async () => {
    const result = await createBatchZip(BATCH_WITH_HTML);
    const zipStr = result.toString('latin1');

    expect(zipStr).toContain('carousel-completo.html');
    expect(zipStr).toContain('emagrecimento-feminino');
  });

  test('estrutura do ZIP usa pasta carrossets-{DATA}', async () => {
    const result = await createBatchZip(BATCH_WITH_HTML);
    const zipStr = result.toString('latin1');

    expect(zipStr).toContain('carrossets-2026-03-10');
    expect(zipStr).toContain('topico-01-');
    expect(zipStr).toContain('topico-03-'); // índice 3 (tópico erro é pulado mas índice mantém)
  });
});

// ── createBatchZip — batch vazio ──────────────────────────────────────────────

describe('createBatchZip — batch sem tópicos válidos', () => {
  test('retorna ZIP válido mesmo sem tópicos com sucesso', async () => {
    const emptyBatch: BatchResult = {
      batchId: 'batch-2026-03-10-0000',
      generatedAt: '2026-03-10T11:00:00.000Z',
      topics: [
        { topic: 'falhou', status: 'error', error: 'timeout' },
      ],
    };

    const result = await createBatchZip(emptyBatch);

    expect(result).toBeInstanceOf(Buffer);
    // Empty ZIP is still a valid ZIP (end-of-central-directory record)
    expect(result.length).toBeGreaterThan(0);
  });
});
