import 'dotenv/config';
import { generateScriptsFromPlan } from './apps/api/src/modules/maverick/copywriter.service';

const profile = `
Nicho: Consultores de Marketing Digital no Brasil
Problema: Clientes não conseguem gerar leads de qualidade via Instagram
Audiência: Proprietários de agências e freelancers de marketing (25-45 anos)
Objetivo: Posicionar como especialista em estratégia de geração de leads
Ângulo: Triplicar leads via Instagram sem aumentar budget de anúncio
Gerar: 2 roteiros apenas para demonstração
`;

(async () => {
  try {
    const scripts = await generateScriptsFromPlan(profile, (msg) => process.stdout.write(`ℹ️  ${msg}\n`));

    console.log('\n' + '='.repeat(80));
    console.log('✅ ROTEIROS GERADOS COM GPT-OSS-120b MERGE');
    console.log('='.repeat(80) + '\n');

    scripts.forEach((s, i) => {
      console.log(`\n📌 ROTEIRO ${i + 1}: ${s.title}`);
      console.log(`   Framework: ${s.framework} | Funil: ${s.funnel_stage}`);
      console.log(`   Hook Technique: ${s.hook_technique}\n`);
      console.log(`🎣 HOOK (${s.hook?.split(' ').length} palavras):`);
      console.log(`   "${s.hook}"\n`);
      console.log(`📝 CORPO:`);
      console.log(`   ${s.body}\n`);
      console.log(`📢 CTA:`);
      console.log(`   ${s.cta}`);
      console.log('\n' + '-'.repeat(80));
    });
  } catch (e) {
    console.error('❌ Erro:', (e as Error).message);
    process.exit(1);
  }
})();
