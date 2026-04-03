import { generateScriptsFromPlan } from './src/modules/maverick/copywriter.service';
import 'dotenv/config';

async function run() {
  const plan = `
Público-alvo: Dono de agência de marketing digital
Problema: O cara tenta crescer fechando-se na operação, configurando anúncios e escrevendo copy. Mas ele se isola, não faz networking, não aparece para os clientes e a agência para de tracionar e vira uma empresinha estagnada. O que o faz crescer é aparecer e documentar.
`;
  
  console.log("Gerando novos roteiros autênticos usando Llama 4 Maverick...");
  try {
    const scripts = await generateScriptsFromPlan(plan, undefined, (msg) => {
       console.log(`[PASS] ${msg}`);
    });

    console.log("\n\n=== SCRIPTS GERADOS (COMPLETOS) ===");
    console.log(JSON.stringify(scripts, null, 2));
    
  } catch(e) {
    console.error("Erro fatal:", e);
  }
}

run();
