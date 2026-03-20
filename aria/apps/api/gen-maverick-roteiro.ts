import 'dotenv/config';
import { generateScriptsFromPlan } from './src/modules/maverick/copywriter.service';

const PLAN = `{
  "profile": { "username": "ia_empreendedor", "followers": "25.000", "posts_count": "120" },
  "strategy": {
    "diagnosis": "Perfil focado em IA para empreendedores. Audiência: solopreneurs e pequenos negócios que querem automação e eficiência com IA. Alto potencial MOFU/BOFU. Conteúdo ainda educacional demais, falta dramatização de resultados reais.",
    "key_concept": "IA = MULTIPLICADOR DE TEMPO E DINHEIRO",
    "suggested_icp": {
      "inferred_audience": "Empreendedores digitais 25-45 anos, faturamento R$10k-R$100k/mês, que percebem IA como oportunidade mas não sabem por onde começar",
      "inferred_product": "Curso ou consultoria de IA prática para automação de negócios",
      "main_pain_addressed": "Perdem tempo em tarefas repetitivas enquanto competitors usam IA para escalar 10x mais rápido"
    },
    "funnel_mix": { "tofu_pct": 25, "mofu_pct": 45, "bofu_pct": 30 },
    "next_steps": [
      "Reel dramatizando: antes/depois de usar IA em seu negócio (tempo/resultado)",
      "Técnica de medo: mostrar empreendedor que ainda faz tudo manual enquanto concorrente usa IA",
      "Caso real: quanto de tempo você economiza com IA em uma semana?",
      "Curiosidade: qual é a ferramenta IA mais simples que pode multiplicar suas vendas?"
    ]
  }
}`;

async function main() {
  console.log('\n🧠 MAVERICK — IA E EMPREENDEDORISMO\n');
  console.log('═'.repeat(80));

  const scripts = await generateScriptsFromPlan(PLAN, undefined, (msg) => {
    console.log(' >', msg);
  });

  console.log('\n' + '═'.repeat(80));
  console.log(`\n✅ ${scripts.length} ROTEIRO(S) PRONTO(S)!\n`);

  for (const s of scripts) {
    console.log('═'.repeat(80));
    console.log(`\n🎯 ${s.title}\n`);
    console.log(`🪝 GANCHO:\n${s.hook}\n`);
    console.log(`📝 DESENVOLVIMENTO:\n${s.body}\n`);
    console.log(`📣 CTA:\n${s.cta}\n`);
  }

  console.log('═'.repeat(80));
  console.log('\n✨ Roteiros prontos para gravar! ✨\n');
}

main().catch(console.error);
