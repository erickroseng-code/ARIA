import { CopywriterAgent } from './copywriter/index';
import * as fs from 'fs';

async function runScripts() {
    const planFile = process.argv[2];

    if (!planFile) {
        process.stderr.write('[ERROR] plan file path required\n');
        process.exit(1);
    }

    if (!fs.existsSync(planFile)) {
        process.stderr.write(`[ERROR] plan file not found: ${planFile}\n`);
        process.exit(1);
    }

    const plan = fs.readFileSync(planFile, 'utf-8');

    // Redireciona console.log para stdout com prefixo [LOG]
    console.log = (...args: any[]) => {
        process.stdout.write(`[LOG] ${args.join(' ')}\n`);
    };
    console.warn = (...args: any[]) => {
        process.stderr.write(`[WARN] ${args.join(' ')}\n`);
    };

    try {
        const copywriter = new CopywriterAgent();
        const scripts = await copywriter.generateScripts(plan);

        process.stdout.write('[SCRIPTS_START]\n');
        process.stdout.write(scripts);
        process.stdout.write('\n[SCRIPTS_END]\n');
    } catch (error: any) {
        process.stderr.write(`[ERROR] ${error.message}\n`);
        process.exit(1);
    }
}

runScripts();
