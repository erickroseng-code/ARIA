import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const analysis = await prisma.maverickAnalysis.findFirst({
    where: { username: '@erick.penoni', status: 'completed' },
    orderBy: { createdAt: 'desc' },
  });

  if (!analysis) {
    console.log("Nenhuma análise encontrada.");
    return;
  }

  const scripts = analysis.scripts as any[];
  if (!scripts || !Array.isArray(scripts)) {
    console.log("Análise não possui scripts.");
    return;
  }

  scripts.forEach((s, i) => {
    console.log(`\n\n================ SCRIPT ${i + 1} ================`);
    console.log(`TITULO: ${s.title}`);
    console.log(`\n--- DRAFT SENTENCES (HOOK/BODY) ---`);
    console.log(s.hook);
    console.log(`\n--- BODY ---`);
    console.log(s.body);
    console.log(`\n--- CTA ---`);
    console.log(s.cta);
    console.log(`========================================`);
  });
}

run().finally(() => prisma.$disconnect());
