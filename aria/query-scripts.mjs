import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, 'apps/api/prisma/dev.db').replace(/\\/g, '/');
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

// Listar todos os usernames na base
const all = await prisma.maverickAnalysis.findMany({
  orderBy: { createdAt: 'desc' },
  take: 20,
  select: { id: true, username: true, createdAt: true, updatedAt: true, scripts: true }
});
console.log('Todos os registros:');
all.forEach(a => console.log(` - "${a.username}" | criado: ${a.createdAt} | atualizado: ${a.updatedAt} | scripts: ${a.scripts ? 'sim' : 'não'}`));

// Mostrar JSON bruto dos scripts
const first = all.find(a => a.scripts);
if (first) {
  const raw = Array.isArray(first.scripts) ? first.scripts : [first.scripts];
  console.log('\nCampos disponíveis no primeiro roteiro:');
  console.log(Object.keys(raw[0] || {}).join(', '));
  console.log('\nJSON bruto do roteiro 1:');
  console.log(JSON.stringify(raw[0], null, 2));
}

const analyses = all.filter(a => a.scripts);

console.log('Total de análises encontradas:', analyses.length);
analyses.forEach((a, i) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Análise ${i+1} | Perfil: ${a.username} | ${a.createdAt}`);
  if (!a.scripts) {
    console.log('  (sem roteiros salvos)');
    return;
  }
  const scripts = Array.isArray(a.scripts) ? a.scripts : [a.scripts];
  console.log(`  ${scripts.length} roteiro(s):`);
  scripts.forEach((s, j) => {
    console.log(`\n  --- Roteiro ${j+1} ---`);
    console.log(`  Tópico: ${s.topic}`);
    console.log(`  Técnica: ${s.hook_technique || s.hookTechnique || 'N/A'}`);
    console.log(`  HOOK: ${s.hook}`);
    console.log(`  CORPO: ${s.body?.substring(0, 300)}...`);
    console.log(`  CTA: ${s.cta}`);
  });
});

await prisma.$disconnect();
