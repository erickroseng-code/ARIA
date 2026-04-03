import 'dotenv/config';
import { generateScriptsFromPlan } from './src/modules/maverick/copywriter.service';

const topics = ['Inteligência Artificial', 'Empreendedorismo', 'Vendas'];

async function main() {
  for (const topic of topics) {
    const plan = JSON.stringify({
      strategy: {
        key_concept: topic,
        diagnosis: `Criador de conteúdo sobre ${topic} para empreendedores brasileiros.`,
        suggested_icp: {
          inferred_audience: 'Empreendedores e donos de negócio 25-45 anos que querem crescer',
          inferred_product: `Curso, consultoria ou serviço relacionado a ${topic}`,
          main_pain_addressed: `Perdem tempo e dinheiro por não dominar ${topic}`,
        },
        funnel_mix: { tofu_pct: 40, mofu_pct: 35, bofu_pct: 25 },
        next_steps: [topic],
      },
    });

    console.log('\n' + '═'.repeat(80));
    console.log(`🎯 TEMA: ${topic.toUpperCase()}`);
    console.log('═'.repeat(80));

    const scripts = await generateScriptsFromPlan(plan, undefined, (msg) => {
      console.log(' >', msg);
    });

    const s = scripts[0];
    if (s) {
      console.log(`\n🪝 GANCHO:\n${s.hook}`);
      console.log(`\n📝 DESENVOLVIMENTO:\n${s.body}`);
      console.log(`\n📣 CTA:\n${s.cta}`);
    }
  }
  console.log('\n' + '═'.repeat(80));
  console.log('✅ 3 roteiros gerados!');
}

main().catch(console.error);
