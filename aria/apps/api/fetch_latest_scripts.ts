import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fetchLatestScripts() {
  try {
    console.log("🔍 Buscando análises Maverick mais recentes...\n");

    const analyses = await prisma.maverickAnalysis.findMany({
      where: { status: "completed" },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    if (!analyses || analyses.length === 0) {
      console.log("❌ Nenhuma análise encontrada no banco de dados.");
      return;
    }

    console.log(`✅ Encontradas ${analyses.length} análises completadas.\n`);

    for (const analysis of analyses) {
      console.log(
        `\n${"=".repeat(80)}`
      );
      console.log(`📊 ANÁLISE: ${analysis.username}`);
      console.log(`📅 Data: ${analysis.createdAt.toLocaleString("pt-BR")}`);
      console.log(`${"=".repeat(80)}\n`);

      const scripts = analysis.scripts as any[];
      if (!scripts || !Array.isArray(scripts) || scripts.length === 0) {
        console.log("⚠️  Esta análise não possui scripts gerados.\n");
        continue;
      }

      console.log(`📝 Total de scripts: ${scripts.length}\n`);

      scripts.forEach((script, idx) => {
        console.log(
          `\n${"-".repeat(80)}`
        );
        console.log(`SCRIPT #${idx + 1}: ${script.title || "Sem título"}`);
        console.log(`${"-".repeat(80)}\n`);

        if (script.hook) {
          console.log("🪝 HOOK:\n");
          console.log(`  ${script.hook}\n`);
        }

        if (script.body) {
          console.log("📄 BODY:\n");
          console.log(`  ${script.body}\n`);
        }

        if (script.cta) {
          console.log("🎯 CTA:\n");
          console.log(`  ${script.cta}\n`);
        }

        // Exibir metadados
        if (script.word_count) {
          console.log(
            `📊 Palavras: ${script.word_count} | Tipo de Técnica: ${script.technique || "N/A"}`
          );
        }
      });

      console.log(`\n${"=".repeat(80)}`);
    }

    console.log("\n✅ Busca concluída!");
  } catch (error: any) {
    console.error("❌ Erro ao buscar scripts:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fetchLatestScripts();
