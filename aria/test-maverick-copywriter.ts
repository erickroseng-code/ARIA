import 'dotenv/config';
import { generateScriptsFromPlan } from './apps/api/src/modules/maverick/copywriter.service';

// Plano real do @erickroseng (extraído do banco)
const PLAN_MOCK = `{
  "profile": { "username": "erickroseng", "followers": "10.000", "posts_count": "150" },
  "strategy": {
    "diagnosis": "Perfil de consultor de marketing digital/Instagram com foco em conversão. Audiência de empreendedores e gestores que querem vender pelo Instagram sem depender de viralização. Alto potencial de BOFU mas conteúdo ainda genérico demais para converter a essa audiência específica.",
    "key_concept": "CONVERSÃO > VIRALIZAÇÃO",
    "suggested_icp": {
      "inferred_audience": "Empreendedores e consultores premium, 28-45 anos, com produto/serviço acima de R$3k, que têm seguidores mas não convertem em clientes",
      "inferred_product": "Mentoria ou consultoria de posicionamento e vendas pelo Instagram",
      "main_pain_addressed": "Investem tempo e energia criando conteúdo mas não conseguem transformar seguidores em clientes pagantes"
    },
    "funnel_mix": { "tofu_pct": 30, "mofu_pct": 40, "bofu_pct": 30 },
    "next_steps": [
      "Criar Reels mostrando a matemática de conversão: por que 10k seguidores convertidos valem mais que 100k viralizados",
      "Carrossel com framework de 3 pilares para transformar perfil em máquina de clientes premium",
      "Post de case: cliente que saiu de R$0 para R$70k em 5 meses mudando apenas o posicionamento",
      "Reel de polarização: por que focar em viralizar é o maior erro de quem quer vender pelo Instagram"
    ]
  }
}`;

async function main() {
  console.log('🧠 Testando Maverick Copywriter com brain/ completo...\n');

  const scripts = await generateScriptsFromPlan(PLAN_MOCK, (msg) => {
    console.log(' >', msg);
  });

  console.log(`\n✅ ${scripts.length} roteiro(s) gerado(s)\n`);
  console.log('='.repeat(60));

  for (const s of scripts) {
    console.log(`\n📌 TÍTULO: ${s.title}`);
    console.log(`🎯 Framework: ${s.framework} | Funil: ${s.funnel_stage}`);
    console.log(`🪝 Técnica de hook: ${s.hook_technique || '(não informado)'}`);
    if (s.technique_plan) {
      console.log(`\n🧠 TÉCNICAS APLICADAS:`);
      s.technique_plan.storytelling.forEach((t, i) => console.log(`  Story ${i+1}: ${t.name}`));
      s.technique_plan.persuasion.forEach((t, i) => console.log(`  Persuasão ${i+1}: ${t.name}`));
      if (s.technique_plan.closing?.name) console.log(`  Closing: ${s.technique_plan.closing.name}`);
    }
    console.log(`\n🎣 GANCHO (${s.hook.split(/\s+/).length} palavras):\n${s.hook}`);
    console.log(`\n📝 DESENVOLVIMENTO:\n${s.body}`);
    console.log(`\n📣 CTA:\n${s.cta}`);
    console.log('\n' + '='.repeat(60));
  }
}

main().catch(console.error);
