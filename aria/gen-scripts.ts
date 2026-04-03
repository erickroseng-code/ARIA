import 'dotenv/config';
import { generateScriptsFromPlan } from './apps/api/src/modules/maverick/copywriter.service';

const profile = `
Nicho: Consultores de Marketing Digital no Brasil
Problema: Clientes não conseguem gerar leads de qualidade via Instagram
Audiência: Proprietários de agências e freelancers de marketing (25-45 anos)
Objetivo: Posicionar como especialista em estratégia de geração de leads
Ângulo: Triplicar leads via Instagram sem aumentar budget de anúncio
`;

(async () => {
  try {
    const scripts = await generateScriptsFromPlan(profile, (msg) => console.log(`ℹ️  ${msg}`));

    console.log('\n✅ ROTEIROS GERADOS\n');
    scripts.forEach((s, i) => {
      console.log(`${i+1}. ${s.title}`);
      console.log(`   🎣 ${s.hook}`);
      console.log(`   📝 ${s.body?.slice(0, 150)}...`);
      console.log(`   📢 ${s.cta}\n`);
    });
  } catch (e) {
    console.error('❌ Erro:', (e as Error).message);
  }
})();
