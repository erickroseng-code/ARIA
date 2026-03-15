import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const FRAMEWORKS_DIR = path.resolve(
    __dirname,
    '../../../../../data/knowledge/copywriting/frameworks'
);

const GOLDEN_SCRIPTS_PATH = path.resolve(
    __dirname,
    '../../../../../data/knowledge/copywriting/scripts/golden/penoni-scripts.json'
);

const COPY_DIRECTIVES_PATH = path.resolve(
    __dirname,
    '../../../../../data/knowledge/copywriting/frameworks/copy-directives.md'
);

const BRAIN_DIR = path.resolve(
    __dirname,
    '../../../../../data/knowledge/brain'
);

export interface CopyFramework {
    name: string;
    full_name: string;
    source: string;
    best_for: string[];
    structure: Record<string, { label: string; instruction: string; duration?: string }>;
    few_shot_example: string;
}

interface MasterPrinciple {
    name: string;
    lesson: string;
    prompt_instruction: string;
    adapted_for_digital: string;
}

interface MastersYaml {
    name: string;
    ogilvy_principle: MasterPrinciple;
    halbert_principle: MasterPrinciple;
    hopkins_principle: MasterPrinciple;
    sugarman_principle: MasterPrinciple;
    few_shot_example: string;
}

export class FrameworkLoader {
    private cache: Map<string, CopyFramework> = new Map();
    private masters: MastersYaml | null = null;

    loadAll(): CopyFramework[] {
        if (this.cache.size > 0) return Array.from(this.cache.values());

        if (!fs.existsSync(FRAMEWORKS_DIR)) {
            console.warn('[FrameworkLoader] Frameworks directory not found:', FRAMEWORKS_DIR);
            return [];
        }

        const yamlFiles = fs.readdirSync(FRAMEWORKS_DIR)
            .filter(f => f.endsWith('.yaml') && f !== 'masters.yaml');

        for (const file of yamlFiles) {
            try {
                const raw = fs.readFileSync(path.join(FRAMEWORKS_DIR, file), 'utf-8');
                const parsed = yaml.load(raw) as CopyFramework;
                if (parsed?.name && parsed?.structure) {
                    this.cache.set(parsed.name, parsed);
                }
            } catch (e) {
                console.warn(`[FrameworkLoader] Could not parse ${file}:`, e);
            }
        }

        // Load masters separately
        try {
            const mastersPath = path.join(FRAMEWORKS_DIR, 'masters.yaml');
            if (fs.existsSync(mastersPath)) {
                this.masters = yaml.load(fs.readFileSync(mastersPath, 'utf-8')) as MastersYaml;
            }
        } catch (e) {
            console.warn('[FrameworkLoader] Could not load masters.yaml:', e);
        }

        console.log(`[FrameworkLoader] Loaded ${this.cache.size} frameworks + masters.`);
        return Array.from(this.cache.values());
    }

    getByName(name: string): CopyFramework | undefined {
        this.loadAll();
        return this.cache.get(name);
    }

    // Build the master principles injection block — always injected regardless of framework
    getMasterPrinciplesBlock(): string {
        if (!this.masters) return '';
        const m = this.masters;
        return `PRINCÍPIOS DOS MESTRES DO COPYWRITING (aplique estes princípios ao roteiro):

【Ogilvy — ${m.ogilvy_principle.name}】
${m.ogilvy_principle.prompt_instruction}

【Halbert — ${m.halbert_principle.name}】
${m.halbert_principle.prompt_instruction}

【Hopkins — ${m.hopkins_principle.name}】
${m.hopkins_principle.prompt_instruction}

【Sugarman — ${m.sugarman_principle.name}】
${m.sugarman_principle.prompt_instruction}`;
    }

    // Convert a framework into a detailed prompt block
    toPromptBlock(framework: CopyFramework, creatorProfile?: string, awarenessLevel?: number, referencePost?: string): string {
        const stages = Object.values(framework.structure)
            .map(s => `**${s.label}**\nInstrução: ${s.instruction}${s.duration ? ` (duração: ${s.duration})` : ''}`)
            .join('\n\n');

        const profileBlock = creatorProfile
            ? `\nPERFIL DO CRIADOR (personalise o roteiro para este contexto):\n${creatorProfile}\n`
            : '';

        let awarenessBlock = '';
        if (awarenessLevel !== undefined) {
            const levels = [
                "Nível 1: Inconsciente (Unaware) — O leitor não sabe que tem um problema. O foco do roteiro DEVE ser no SINTOMA ou na identidade, sem mencionar problema ou solução logo de cara.",
                "Nível 2: Consciente do Problema (Problem Aware) — O leitor sabe que tem uma dor, mas não sabe que existe solução. O foco do roteiro DEVE ser em nomear e agitar a dor com extrema empatia.",
                "Nível 3: Consciente da Solução (Solution Aware) — O leitor sabe o que quer, mas não decidiu quem seguir/comprar. O foco do roteiro DEVE ser mostrar que existe um mecanismo novo ou prova de resultado.",
                "Nível 4: Consciente do Produto (Product Aware) — O leitor sabe o que você faz, mas ainda não comprou. O foco do roteiro DEVE ser na diferenciação do seu método contra os genéricos do mercado.",
                "Nível 5: Totalmente Consciente (Most Aware) — O leitor só precisa de um empurrão final. O foco do roteiro DEVE ser direto ao ponto, mostrando oferta, bônus ou removendo risco."
            ];
            const levelIdx = Math.max(0, Math.min(4, awarenessLevel - 1));
            awarenessBlock = `\nNÍVEL DE CONSCIÊNCIA DO PÚBLICO: ${levels[levelIdx]}\n> ADAPTE O TOM E O GANCHO PARA ESTE NÍVEL EXATO. NUNCA venda direto para nível 1 ou 2.\n`;
        }

        const voiceBlock = referencePost
            ? `\nCALIBRAÇÃO DE VOZ (Referência do Criador):\nO texto abaixo foi escrito pelo próprio criador e performou muito bem.\nVOCÊ DEVE: Analisar e mimetizar o vocabulário, o ritmo das frases curtas/longas, e as expressões usadas.\nO roteiro não pode parecer gerado por IA. Tem que parecer escrito por esta exata pessoa.\n[TEXTO DE REFERÊNCIA INÍCIO]\n${referencePost}\n[TEXTO DE REFERÊNCIA FIM]\n`
            : '';

        return `FRAMEWORK: ${framework.full_name}
Fonte: ${framework.source}
${profileBlock}${awarenessBlock}${voiceBlock}
ESTRUTURA OBRIGATÓRIA:
${stages}

EXEMPLO DE REFERÊNCIA DE QUALIDADE (nível de saída esperado):
${framework.few_shot_example}`;
    }

    // Select most suitable framework for a topic+angle
    selectFramework(topic: string, angle: string): CopyFramework | null {
        const frameworks = this.loadAll();
        if (frameworks.length === 0) return null;

        const topicLower = (topic + ' ' + angle).toLowerCase();

        const scores: { fw: CopyFramework; score: number }[] = frameworks.map(fw => {
            let score = 0;
            const hints = fw.best_for.join(' ').toLowerCase();

            if (topicLower.includes('vend') && hints.includes('vend')) score += 3;
            if (topicLower.includes('transfor') && hints.includes('transfor')) score += 3;
            if (topicLower.includes('histór') || topicLower.includes('histor')) {
                if (fw.name === 'HOOK_STORY_OFFER') score += 4;
            }
            if (topicLower.includes('antes') || topicLower.includes('depois') || topicLower.includes('resultado')) {
                if (fw.name === 'BAB') score += 4;
            }
            if (topicLower.includes('segredo') || topicLower.includes('revela') || topicLower.includes('ninguém')) {
                if (fw.name === 'OPEN_LOOP') score += 4;
            }
            if (topicLower.includes('dor') || topicLower.includes('problema') || topicLower.includes('luta')) {
                if (fw.name === 'PAS') score += 3;
            }
            if (topicLower.includes('lança') || topicLower.includes('oferta') || topicLower.includes('result')) {
                if (fw.name === 'AIDA') score += 3;
            }
            return { fw, score };
        });

        scores.sort((a, b) => b.score - a.score);
        const winner = scores[0];
        if (winner.score > 0) return winner.fw;
        return frameworks.find(f => f.name === 'PAS') || frameworks[0];
    }

    // Load distilled copywriting directives (always injected — replaces raw RAG chunks)
    loadCopyDirectives(): string {
        try {
            if (fs.existsSync(COPY_DIRECTIVES_PATH)) {
                return fs.readFileSync(COPY_DIRECTIVES_PATH, 'utf-8');
            }
        } catch (e) {
            console.warn('[FrameworkLoader] Could not load copy-directives.md:', e);
        }
        return '';
    }

    // Load golden scripts as few-shot examples, prioritizing framework match
    // Strategy: up to 3 from the matched framework type + 1-2 from other types as contrast
    loadGoldenScripts(frameworkName?: string, maxTotal = 4): string {
        try {
            if (!fs.existsSync(GOLDEN_SCRIPTS_PATH)) return '';
            const data = JSON.parse(fs.readFileSync(GOLDEN_SCRIPTS_PATH, 'utf-8'));
            const scripts: any[] = data.scripts || [];
            if (scripts.length === 0) return '';

            const frameworkMap: Record<string, string[]> = {
                'PAS':             ['AIDA', 'VENDAS'],
                'AIDA':            ['AIDA', 'VENDAS'],
                'BAB':             ['STORYTELLING', 'ROTINA'],
                'HOOK_STORY_OFFER':['STORYTELLING'],
                'OPEN_LOOP':       ['STORYTELLING', 'TREND'],
                'VOSS':            ['VENDAS', 'AIDA'],
            };

            const fwUpper = (frameworkName || '').toUpperCase();
            const primaryTypes = frameworkMap[fwUpper] || [];

            // Primary: all scripts matching the framework type (max 3)
            const primary = primaryTypes.length > 0
                ? scripts.filter(s => primaryTypes.includes(s.framework)).slice(0, 3)
                : scripts.slice(0, 3);

            // Secondary: fill remaining slots from other types (diversity of style)
            const primaryIds = new Set(primary.map((s: any) => s.id));
            const secondary = scripts
                .filter(s => !primaryIds.has(s.id))
                .slice(0, maxTotal - primary.length);

            const selected = [...primary, ...secondary];
            if (selected.length === 0) return '';

            return `ROTEIROS VIRAIS VALIDADOS — ${selected.length} exemplos reais com performance comprovada
(Analise: especificidade dos números, ritmo das frases, tom coloquial, força do gancho, precisão do CTA)

${selected.map((s: any, i: number) => `━━━ Exemplo ${i + 1}/${selected.length} — ${s.framework} | ${s.topic}
🎣 GANCHO: "${s.hook}"
📐 PADRÃO: ${s.hook_pattern}
📝 ROTEIRO:
${s.full_script}
📣 CTA: ${s.cta}
💡 POR QUE FUNCIONA: ${s.notes}
`).join('\n')}
INSTRUÇÃO CRÍTICA: Esses roteiros viralizaram de verdade. Estude o nível de especificidade (números exatos, nomes reais, situações concretas), o ritmo conversacional e a estrutura. Seu roteiro DEVE atingir esse mesmo nível — ou superar.`
        } catch (e) {
            console.warn('[FrameworkLoader] Could not load golden scripts:', e);
            return '';
        }
    }

    // Save an approved script as a new few-shot example
    saveApprovedScript(
        topic: string,
        frameworkName: string,
        script: string
    ): void {
        const approvedDir = path.resolve(
            __dirname,
            '../../../../../data/knowledge/copywriting/approved'
        );
        if (!fs.existsSync(approvedDir)) fs.mkdirSync(approvedDir, { recursive: true });

        const timestamp = Date.now();
        const entry = {
            topic,
            framework: frameworkName,
            script,
            approvedAt: new Date().toISOString(),
        };
        fs.writeFileSync(
            path.join(approvedDir, `approved_${timestamp}.json`),
            JSON.stringify(entry, null, 2),
            'utf-8'
        );
        console.log(`[FrameworkLoader] Saved approved script for framework: ${frameworkName}`);
    }

    // Load brain principles relevant to the current topic/angle
    // Matches brain/ .md files by use_when frontmatter keywords
    loadBrainPrinciples(): { hook: string; body: string; cta: string } {
        const load = (filename: string): string => {
            const filePath = path.join(BRAIN_DIR, filename);
            if (!fs.existsSync(filePath)) return '';
            try {
                const raw = fs.readFileSync(filePath, 'utf-8');
                return raw.replace(/^---[\s\S]*?---\n/, '').trim();
            } catch {
                return '';
            }
        };

        return {
            hook: load('hooks.md'),
            body: [load('storytelling.md'), load('persuasion.md'), load('audience.md'), load('virality.md')]
                .filter(Boolean).join('\n\n---\n\n'),
            cta: load('closing.md'),
        };
    }

    // Load approved scripts as additional few-shot examples (max 3)
    loadApprovedExamples(frameworkName: string): string {
        const approvedDir = path.resolve(
            __dirname,
            '../../../../../data/knowledge/copywriting/approved'
        );
        if (!fs.existsSync(approvedDir)) return '';

        try {
            const files = fs.readdirSync(approvedDir).filter(f => f.endsWith('.json'));
            const matching = files
                .map(f => JSON.parse(fs.readFileSync(path.join(approvedDir, f), 'utf-8')))
                .filter((e: any) => e.framework === frameworkName)
                .slice(-3); // last 3 approved

            if (matching.length === 0) return '';
            return `EXEMPLOS APROVADOS PELO CRIADOR (roteiros reais que funcionaram — use como referência de tom e estilo):\n\n` +
                matching.map((e: any, i: number) => `[Aprovado ${i + 1}] Tópico: "${e.topic}"\n${e.script}`).join('\n\n---\n\n');
        } catch {
            return '';
        }
    }
}
