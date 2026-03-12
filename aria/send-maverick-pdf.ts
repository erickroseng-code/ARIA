/**
 * Envia o diagnóstico Maverick como PDF para o Telegram usando a análise mais recente salva no banco.
 */
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PdfService } from './apps/api/src/services/pdf/pdf.service';
import type { ReportLayoutData } from './apps/api/src/services/pdf/pdf.service';

// ── Carrega .env ───────────────────────────────────────────────────────────────
import * as fs from 'fs';
const envPath = path.resolve(__dirname, '.env');
fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && !k.startsWith('#')) process.env[k.trim()] = v.join('=').trim();
});

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_CHAT_ID   = process.env.TELEGRAM_CHAT_ID!;
const USERNAME           = process.env.MAVERICK_WEEKLY_USERNAME ?? 'erickroseng';

async function sendDocument(buffer: Buffer, filename: string, caption: string) {
  const form = new FormData();
  form.append('chat_id', TELEGRAM_CHAT_ID);
  form.append('document', new Blob([buffer.buffer as ArrayBuffer], { type: 'application/pdf' }), filename);
  form.append('caption', caption);
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(await res.text());
  console.log('✅ PDF enviado!');
}

async function main() {
  const dbPath = path.resolve(__dirname, 'apps/api/prisma/dev.db').replace(/\\/g, '/');
  const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
  const prisma  = new PrismaClient({ adapter } as any);

  const analyses: any[] = await (prisma as any).maverickAnalysis.findMany({
    where: { username: USERNAME },
    orderBy: { createdAt: 'desc' },
    take: 2,
  });

  if (analyses.length === 0) {
    console.error(`❌ Nenhuma análise encontrada para @${USERNAME}`);
    process.exit(1);
  }

  const current  = analyses[0];
  const report   = current.fullReport as any;
  const profile  = report.profile;
  const strategy = report.strategy;
  const analysis = report.analysis;
  const score    = strategy?.profile_score;
  const eng      = strategy?.engagement_panorama;
  const icp      = strategy?.suggested_icp;

  const followers = parseInt(profile?.followers ?? '0').toLocaleString('pt-BR');

  // Monta tabela de resultados
  const results: ReportLayoutData['results'] = [];
  (analysis?.positive_points ?? []).slice(0, 3).forEach((p: string) =>
    results.push({ name: p.slice(0, 60), status: 'FORTE', detail: '' }));
  (analysis?.profile_gaps ?? []).slice(0, 3).forEach((g: string) =>
    results.push({ name: g.slice(0, 60), status: 'ATENÇÃO', detail: '' }));
  if (analysis?.best_posts?.[0])
    results.push({ name: `"${analysis.best_posts[0].caption_preview.slice(0,55)}"`, status: 'VIRAL',  detail: analysis.best_posts[0].reason.slice(0,80) });
  if (analysis?.worst_posts?.[0])
    results.push({ name: `"${analysis.worst_posts[0].caption_preview.slice(0,55)}"`, status: 'FALHOU', detail: analysis.worst_posts[0].reason.slice(0,80) });

  // Monta diagnóstico
  const diagLines: string[] = [];
  if (strategy?.key_concept) diagLines.push(`Conceito-chave: ${strategy.key_concept}`, '');
  if (strategy?.diagnosis)   diagLines.push(strategy.diagnosis.slice(0, 400));
  if (strategy?.next_steps?.length) {
    diagLines.push('', 'Próximos passos:');
    (strategy.next_steps as string[]).slice(0, 3).forEach((s, i) => diagLines.push(`${i+1}. ${s.slice(0,120)}`));
  }
  if (icp?.inferred_audience) diagLines.push('', `ICP: ${icp.inferred_audience.slice(0,120)}`);

  const metrics: ReportLayoutData['metrics'] = [
    { label: 'Seguidores', value: followers },
    { label: 'Posts',      value: profile?.posts_count ?? '—' },
  ];
  if (score) metrics.push({ label: 'Score Geral',   value: `${score.overall}/100` });
  if (eng)   metrics.push({ label: 'Engajamento',   value: eng.profile_rate });

  const pdfData: ReportLayoutData = {
    title:      'Análise de Nicho & Roteiros (Maverick)',
    clientName: `@${profile?.username ?? USERNAME}`,
    clientId:   current.id?.slice(0, 8) ?? 'MAV',
    reportDate: new Date(current.createdAt).toLocaleDateString('pt-BR'),
    metrics,
    results: results.length > 0 ? results : [{ name: 'Análise concluída', status: 'OK', detail: '' }],
    diagnosis: diagLines.join('\n'),
  };

  const pdfService = new PdfService();
  console.log('⏳ Gerando PDF...');
  const buffer  = await pdfService.generatePdfBuffer('maverick', pdfData);
  const date    = new Date(current.createdAt).toISOString().slice(0, 10);
  const filename = `Maverick-Weekly-${date}.pdf`;
  const caption  = `🎨 Diagnóstico Maverick — @${profile?.username ?? USERNAME} · ${new Date(current.createdAt).toLocaleDateString('pt-BR')}`;

  console.log(`📤 Enviando ${filename}...`);
  await sendDocument(buffer, filename, caption);

  await prisma.$disconnect();
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
