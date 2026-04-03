/**
 * Teste rápido: GPT-OSS-120b para merge niche + brain
 */
import * as dotenv from 'dotenv';
import path from 'path';

// Carrega .env
dotenv.config({ path: path.join(__dirname, '.env') });

import { generateScriptsFromPlan } from './apps/api/src/modules/maverick/copywriter.service';

const userProfile = `
Nicho: Consultores de Marketing Digital no Brasil
Problema principal: Clientes não conseguem gerar leads de qualidade via Instagram
Audiência-alvo: Proprietários de agências e freelancers de marketing (25-45 anos)
Objetivo: Posicionar como especialista em estratégia de geração de leads
Ângulo: "Como triplicar leads via Instagram sem aumentar budget de anúncio"
`;

async function testMerge() {
  try {
    console.log('🚀 Testando merge com gpt-oss-120b...');
    console.log('📝 User Profile:', userProfile);

    const scripts = await generateScriptsFromPlan(userProfile, (msg) => {
      console.log(`  ℹ️  ${msg}`);
    });

    console.log('\n✅ Scripts gerados com sucesso!');
    console.log(`\nTotal de roteiros: ${scripts.length}\n`);

    scripts.forEach((script, i) => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Roteiro ${i + 1}: ${script.title}`);
      console.log(`Framework: ${script.framework} | Funil: ${script.funnel_stage}`);
      console.log(`Hook Technique: ${script.hook_technique}`);
      console.log(`\n🎣 Hook:\n${script.hook}`);
      console.log(`\n📝 Body (primeiras 200 chars):\n${script.body?.slice(0, 200)}...`);
      console.log(`\n📢 CTA:\n${script.cta}`);
    });

  } catch (error) {
    console.error('❌ Erro ao gerar scripts:', error);
    process.exit(1);
  }
}

testMerge();
