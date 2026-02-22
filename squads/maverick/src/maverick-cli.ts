import { StrategistAgent } from './strategist/index';
import { CopywriterAgent } from './copywriter/index';
import * as readline from 'readline';

async function runMaverick() {
    const username = process.argv[2];

    if (!username) {
        console.error("❌ Erro: Forneça um @username.");
        console.log("Exemplo: npx ts-node squads/maverick/src/maverick-cli.ts neymarjr");
        process.exit(1);
    }

    console.clear();
    console.log("==========================================");
    console.log(`🦅 SQUAD MAVERICK INICIADO: @${username}`);
    console.log("==========================================\n");

    // 1. Strategist
    const strategist = new StrategistAgent();
    const plan = await strategist.createStrategicPlan(username);

    console.log("\n==========================================");
    console.log("📄 PLANO ESTRATÉGICO SUGERIDO:");
    console.log("==========================================\n");
    console.log(plan);

    // 2. Gate Interativo
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('\n🛑 [GATE] Deseja gerar os roteiros para este plano? (s/n): ', async (answer) => {
        if (answer.toLowerCase() !== 's') {
            console.log("❌ Operação cancelada pelo usuário.");
            rl.close();
            process.exit(0);
        }

        // 3. Copywriter
        console.log("\n🚀 Aprovado! Iniciando Copywriter...");
        const copywriter = new CopywriterAgent();
        const scripts = await copywriter.generateScripts(plan);

        console.log("\n==========================================");
        console.log("🎬 ROTEIROS FINAIS:");
        console.log("==========================================\n");
        console.log(scripts);
        
        rl.close();
    });
}

runMaverick();
