import { StrategistAgent, ICP } from './strategist/index';

async function runPlan() {
    const username = process.argv[2];
    const icpJson = process.argv[3];

    if (!username) {
        process.stderr.write('[ERROR] username required\n');
        process.exit(1);
    }

    let icp: ICP | undefined;
    if (icpJson) {
        try {
            icp = JSON.parse(icpJson);
        } catch {
            process.stderr.write('[WARN] ICP JSON inválido — análise sem ICP\n');
        }
    }

    // Redireciona console.log para stdout com prefixo [LOG]
    const originalLog = console.log;
    const originalWarn = console.warn;
    console.log = (...args: any[]) => {
        process.stdout.write(`[LOG] ${args.join(' ')}\n`);
    };
    console.warn = (...args: any[]) => {
        process.stderr.write(`[WARN] ${args.join(' ')}\n`);
    };

    try {
        const strategist = new StrategistAgent();
        const plan = await strategist.createStrategicPlan(username, icp);

        process.stdout.write('[PLAN_START]\n');
        process.stdout.write(plan);
        process.stdout.write('\n[PLAN_END]\n');
    } catch (error: any) {
        process.stderr.write(`[ERROR] ${error.message}\n`);
        process.exit(1);
    }
}

runPlan();
