import { TrendResearcherAgent } from './trend-researcher/index';
import * as fs from 'fs';

async function runKeywords() {
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

    try {
        const researcher = new TrendResearcherAgent();
        const keywords = await researcher.extractKeywords(plan);
        process.stdout.write('[KEYWORDS_START]\n');
        process.stdout.write(JSON.stringify(keywords));
        process.stdout.write('\n[KEYWORDS_END]\n');
    } catch (error: any) {
        process.stderr.write(`[ERROR] ${error.message}\n`);
        process.exit(1);
    }
}

runKeywords();
