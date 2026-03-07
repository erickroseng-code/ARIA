import { CopywriterAgent } from './copywriter/index';
import { TrendResearcherAgent, TrendResearch } from './trend-researcher/index';
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

    // Keywords pré-confirmadas pelo usuário (opcional — 3º argumento é caminho de arquivo JSON)
    const keywordsFile = process.argv[3];
    let preselectedKeywords: string[] | undefined;
    if (keywordsFile && fs.existsSync(keywordsFile)) {
        try {
            preselectedKeywords = JSON.parse(fs.readFileSync(keywordsFile, 'utf-8'));
        } catch { /* ignora erro de parse, usa extração normal */ }
    }

    // Período de busca (opcional — 4º argumento é caminho de arquivo JSON com { maxAgeDays })
    const maxAgeDaysFile = process.argv[4];
    let maxAgeDays = 45; // padrão
    if (maxAgeDaysFile && fs.existsSync(maxAgeDaysFile)) {
        try {
            const parsed = JSON.parse(fs.readFileSync(maxAgeDaysFile, 'utf-8'));
            if (typeof parsed.maxAgeDays === 'number' && parsed.maxAgeDays > 0) {
                maxAgeDays = parsed.maxAgeDays;
            }
        } catch { /* usa padrão */ }
    }

    // Redireciona console.log para stdout com prefixo [LOG]
    console.log = (...args: any[]) => {
        process.stdout.write(`[LOG] ${args.join(' ')}\n`);
    };
    console.warn = (...args: any[]) => {
        process.stderr.write(`[WARN] ${args.join(' ')}\n`);
    };

    try {
        // 1. Trend Research — busca conteúdo viral no nicho do perfil
        //    Opcional: se falhar, o Copywriter continua apenas com a metodologia
        let trendResearch: TrendResearch | null = null;
        try {
            process.stdout.write(`[STEP] Pesquisando tendencias e conteudo viral no nicho (últimos ${maxAgeDays} dias)...\n`);
            const researcher = new TrendResearcherAgent();
            trendResearch = await researcher.research(plan, preselectedKeywords, maxAgeDays);
            const found = trendResearch.posts_analyzed;
            const terms = trendResearch.keywords_searched.join(', ');
            process.stdout.write(`[STEP] Analise de tendencias concluida: ${found} posts virais para "${terms}"\n`);

            // Alerta de poucos resultados — emite [LOW_RESULTS] para a rota SSE capturar
            if (found < 4) {
                const DATE_LADDER = [45, 60, 90, 120];
                const nextAge = DATE_LADDER.find(d => d > maxAgeDays) ?? 120;
                process.stdout.write(`[LOW_RESULTS] ${found}:${nextAge}\n`);
            }

            // Emite os dados completos (incluindo URLs de referência) para a rota capturar
            process.stdout.write('[TREND_DATA_START]\n');
            process.stdout.write(JSON.stringify(trendResearch));
            process.stdout.write('\n[TREND_DATA_END]\n');
        } catch (err: any) {
            process.stderr.write(`[WARN] Trend research nao disponivel (continuando sem): ${err.message}\n`);
        }

        // 2. Copywriter — gera roteiros usando metodologia + tendências reais do nicho
        process.stdout.write('[STEP] Gerando roteiros com base nas tendencias e metodologia Maverick...\n');
        const copywriter = new CopywriterAgent();
        const scripts = await copywriter.generateScripts(plan, trendResearch ?? undefined);

        process.stdout.write('[SCRIPTS_START]\n');
        process.stdout.write(scripts);
        process.stdout.write('\n[SCRIPTS_END]\n');
    } catch (error: any) {
        process.stderr.write(`[ERROR] ${error.message}\n`);
        process.exit(1);
    }
}

runScripts();
