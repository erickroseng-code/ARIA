import { StrategistAgent } from './strategist/index';

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

    const strategist = new StrategistAgent();
    const plan = await strategist.createStrategicPlan(username);

    console.log("\n==========================================");
    console.log("📄 RELATÓRIO FINAL GERADO:");
    console.log("==========================================\n");
    console.log(plan);
}

runMaverick();
