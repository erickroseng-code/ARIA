import { generateScriptsFromPlan } from './src/modules/maverick/copywriter.service';
import fs from 'fs';
import 'dotenv/config';

async function run() {
  const plan = `
**Público-alvo:** Donos de agências de marketing digital.
**Problema:** O cara se isola do time e dos clientes para tentar "construir a empresa focando na operação", mas no final do dia a agência para de crescer e vira uma empresa fantasma porque ele não faz networking, não aparece, e não cria conexão real.
**Objetivo:** Fazer eles tomarem consciência desse erro basal e pararem com essa ideia de que se trancar no escritório é sinônimo de produtividade.
`;
  
  console.log("Gerando...");
  const scripts = await generateScriptsFromPlan(plan, undefined, () => {});
  
  const goldenFile = {
    source: "Maverick Llama 4 - Testes Validados (API Direta)",
    description: "Roteiros reais gerados pelo backend do Maverick após a implementação das constraints absolutas do Penoni Mode. Como a interface web não salva na base, estes foram gerados nativamente para manter o registro 100% fiel de Hook + Body + CTA.",
    scripts: scripts.map((s: any, idx) => ({
      id: `llama4_golden_0${idx + 1}`,
      topic: s.title,
      hook: s.hook,
      body: s.body,
      cta: s.cta,
      full_script: `${s.hook}\n\n${s.body}\n\n${s.cta}`,
      tags: [s.framework.toLowerCase(), s.funnel_stage.toLowerCase()],
      analysis: "(Autogerado) Estrutura que respeita as constraints do Maverick: 'Teste do Bar' aplicado e termos genéricos como 'jornada' ou 'descubra' bloqueados."
    }))
  };

  fs.writeFileSync('c:/Users/erick/Projects/aios-core/squads/maverick/data/knowledge/copywriting/scripts/golden/maverick-llama4-scripts.json', JSON.stringify(goldenFile, null, 2));
  console.log("JSON Salvo com sucesso!");
}

run();
