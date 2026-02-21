import { ScoutAgent } from './scout/index';

async function main() {
    const username = process.argv[2] || 'instagram'; // Pega argumento ou usa default
    console.log(`🦅 Maverick Scout iniciado. Alvo: @${username}`);

    const scout = new ScoutAgent();
    const data = await scout.analyzeProfile(username);

    console.log("
--- 📊 Relatório do Scout ---");
    console.log(JSON.stringify(data, null, 2));
    console.log("-----------------------------");
}

main();
