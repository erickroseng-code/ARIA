import { LLMService } from '../core/llm';
import { ScholarEngine } from '../scholar/engine';
import { loadMaverickMethodology } from '../knowledge/methodology';
import { buildFormatMenu, buildFormatInstructions } from '../knowledge/content-formats';
import { TrendResearch } from '../trend-researcher/index';
import * as fs from 'fs';
import * as path from 'path';

const BRAIN_DIR = path.resolve(__dirname, '../../data/knowledge/brain');

function loadBrain(filename: string): string {
    const filePath = path.join(BRAIN_DIR, filename);
    if (!fs.existsSync(filePath)) return '';
    try {
        return fs.readFileSync(filePath, 'utf-8').replace(/^---[\s\S]*?---\n/, '').trim();
    } catch { return ''; }
}

function loadBrainPrinciples(): { constraints: string; hook: string; body: string; cta: string } {
    return {
        constraints: loadBrain('constraints.md'),
        hook: loadBrain('hooks.md'),
        body: [loadBrain('storytelling.md'), loadBrain('persuasion.md'), loadBrain('audience.md'), loadBrain('virality.md')]
            .filter(Boolean).join('\n\n---\n\n'),
        cta: loadBrain('closing.md'),
    };
}

/** Carrega cada arquivo brain individualmente para uso no PASSO 1 (seleção de técnica) */
function loadBrainFiles(): {
    constraints: string;
    hooks: string;
    storytelling: string;
    persuasion: string;
    audience: string;
    virality: string;
    closing: string;
} {
    return {
        constraints: loadBrain('constraints.md'),
        hooks: loadBrain('hooks.md'),
        storytelling: loadBrain('storytelling.md'),
        persuasion: loadBrain('persuasion.md'),
        audience: loadBrain('audience.md'),
        virality: loadBrain('virality.md'),
        closing: loadBrain('closing.md'),
    };
}

/** PASSO 1 — Bloco obrigatório de seleção de técnicas antes de gerar o roteiro */
export interface StrategySetup {
    audience_awareness_level: 'Frio' | 'Morno' | 'Quente';  // Nível de consciência do público
    dominant_behavioral_profile: 'Verde' | 'Azul' | 'Vermelho' | 'Ouro';  // Perfil comportamental DISC
    selected_hook_technique: string;       // Nome + número da técnica de hook escolhida
    selected_storytelling_technique: string; // Nome + número da técnica de storytelling
    selected_persuasion_technique: string;  // Nome + número da técnica de persuasão
    selected_virality_technique: string;    // Nome + número da técnica de viralidade
    selected_closing_technique: string;     // Nome + número da técnica de closing
    constraints_check: string;             // Confirmação: tom cru? vocabulário ok? teste do bar?
}

export interface ScriptOutput {
    strategy_setup: StrategySetup;  // PASSO 1 — Chain of Thought obrigatório
    title: string;
    format: string;           // "Reels" | "Carrossel"
    format_type: string;      // ex: "reels_react", "carrossel_educativo"
    format_name: string;      // ex: "Reels React", "Carrossel Educativo"
    funnel_stage: string;     // "TOFU" | "MOFU" | "BOFU"
    funnel_goal: string;      // objetivo específico deste conteúdo no funil
    conversion_angle: string; // ângulo de conversão — o que este conteúdo faz o espectador PENSAR/SENTIR/FAZER
    why_format: string;       // por que este formato para este tema
    framework: string;
    why_framework: string;
    hook: string;
    body: string;
    visual_cues: string[];
    filming_tip: string;      // instrução prática de como gravar
    cta: string;
}

const SCRIPT_SCHEMA = `{
  "strategy_setup": {
    "audience_awareness_level": "Frio|Morno|Quente",
    "dominant_behavioral_profile": "Verde|Azul|Vermelho|Ouro",
    "selected_hook_technique": "Nome exato da técnica de hook (ex: 3. A LEI DA ESPECIFICIDADE CIRÚRGICA)",
    "selected_storytelling_technique": "Nome exato da técnica de storytelling",
    "selected_persuasion_technique": "Nome exato da técnica de persuasão",
    "selected_virality_technique": "Nome exato da técnica de viralidade",
    "selected_closing_technique": "Nome exato da técnica de closing",
    "constraints_check": "string curta confirmando: tom cru ✓ | vocabulário proibido eliminado ✓ | frase passa no Teste do Bar ✓"
  },
  "title": "string — título criativo do roteiro",
  "format": "Reels|Carrossel",
  "format_type": "id do formato escolhido (ex: reels_react, carrossel_educativo)",
  "format_name": "nome legível do formato (ex: Reels React, Carrossel Educativo)",
  "funnel_stage": "TOFU|MOFU|BOFU",
  "funnel_goal": "string — objetivo específico deste conteúdo no funil (ex: gerar alcance, construir autoridade, captar lead)",
  "conversion_angle": "string — o ângulo de conversão: o que este conteúdo faz o espectador PENSAR/SENTIR/FAZER após assistir",
  "why_format": "string — 1 frase explicando por que este formato específico é o melhor para este tema",
  "framework": "nome exato do framework de copywriting (ex: PAS, AIDA, HOOK_STORY_OFFER)",
  "why_framework": "string — 1 frase explicando por que este framework para este formato e objetivo",
  "hook": "string — gancho COMPLETO dos primeiros 3 segundos ou slide 1. Deve ser brutal e irresistível. MÁXIMO 15 PALAVRAS.",
  "body": "string — corpo completo do roteiro. MÍNIMO 200 PALAVRAS. Com indicações [Visual: ...] e [Tom: ...] intercaladas. Aplique EXCLUSIVAMENTE a técnica selecionada no strategy_setup.",
  "visual_cues": ["indicação de produção 1", "indicação de câmera ou edição 2"],
  "filming_tip": "string — instrução prática e objetiva de como gravar/produzir este conteúdo específico",
  "cta": "string — chamada para ação específica, concreta e irresistível. Deve ser coerente com o funnel_stage. MÍNIMO 20 PALAVRAS."
}`;

export class CopywriterAgent {
    private llm: LLMService;
    private scholar: ScholarEngine;
    private methodology: string;

    constructor() {
        this.llm = new LLMService('deepseek', 'minimax');
        this.scholar = new ScholarEngine();
        this.methodology = loadMaverickMethodology();
    }

    async generateScripts(strategicPlan: string, trendResearch?: TrendResearch): Promise<string> {
        const formatMenu = buildFormatMenu();

        // Formata os insights de tendência para injetar nos prompts
        const trendContext = trendResearch && trendResearch.posts_analyzed > 0
            ? `\nTENDÊNCIAS REAIS DO NICHO (pesquisa em ${trendResearch.keywords_searched.join(', ')} — ${trendResearch.posts_analyzed} posts virais analisados):
O que está dominando: ${trendResearch.niche_summary}
Formatos com melhor performance: ${trendResearch.dominant_formats.join(', ')}
${trendResearch.insights.slice(0, 4).map((ins, i) =>
    `[Tendência ${i+1}] Padrão: ${ins.hook_pattern} | Ângulo: ${ins.angle}\nHook viral: "${ins.example_hook}"\nPor que funciona: ${ins.engagement_signal}`
).join('\n')}`
            : '';

        // 1. Extract script ideas + choose format, funnel stage and framework
        const ideas = await this.llm.analyzeJson<{
            title: string;
            context: string;
            format_type: string;
            funnel_stage: string;
            funnel_goal: string;
            recommended_framework: string;
        }[]>(
            `Analise o plano estratégico abaixo e extraia as ideias de roteiros sugeridas.
Para cada ideia, escolha o formato mais adequado ao tema e defina o estágio de funil correto.
${trendContext ? `\nUSE AS TENDÊNCIAS REAIS DO NICHO abaixo para calibrar os formatos e ângulos — prefira ideias que alinhem com o que está funcionando no mercado agora.\n${trendContext}` : ''}

FORMATOS DISPONÍVEIS:
${formatMenu}

ESTÁGIOS DE FUNIL:
- TOFU (Top of Funnel): Conteúdo de descoberta e alcance. Objetivo: atrair novos seguidores que ainda não te conhecem. Tom: educativo, surpreendente, polêmico, viralizável. CTA: seguir, salvar, compartilhar.
- MOFU (Middle of Funnel): Conteúdo de autoridade e consideração. Objetivo: aprofundar confiança com quem já te segue. Tom: técnico, detalhado, cases, bastidores. CTA: comentar, entrar na lista, baixar material.
- BOFU (Bottom of Funnel): Conteúdo de conversão. Objetivo: transformar seguidor em cliente/lead. Tom: direto, oferta clara, urgência, prova social. CTA: clicar no link, enviar DM, comprar.

REGRAS DE SELEÇÃO:
- Varie formatos entre as ideias — não use o mesmo tipo para todos
- Varie estágios de funil: inclua mix de TOFU/MOFU/BOFU conforme o funnel_mix do plano estratégico
- Prefira Reels virais (react, trend_meme) para TOFU
- Use carrossel educativo ou narrativo para MOFU
- Use Reels diretos ou carrossel de prova social para BOFU
- Adapte o framework ao estágio: PAS/HOOK_STORY_OFFER para TOFU, AIDA para MOFU, PAS/BAB para BOFU

PLANO:
${strategicPlan}`,
            '[{ "title": "Título da ideia", "context": "O que comunicar e para quem", "format_type": "id do formato (ex: reels_react, carrossel_educativo)", "funnel_stage": "TOFU|MOFU|BOFU", "funnel_goal": "objetivo específico deste conteúdo no funil", "recommended_framework": "AIDA|PAS|BAB|HOOK_STORY_OFFER|OPEN_LOOP|VOSS" }]'
        );

        // 2. Optional: supporting quotes from the knowledge base
        let bookCitations = '';
        try {
            await this.scholar.loadKnowledgeBase();
            const niche = ideas.map(i => i.context).join(' ');
            const citations = await this.scholar.search(niche, 3);
            if (citations.length > 0) {
                bookCitations = citations
                    .map(c => `[${c.source}]: "${c.content.slice(0, 250)}..."`)
                    .join('\n\n');
            }
        } catch {
            // Scholar is optional
        }

        const brain = loadBrainFiles();

        const systemPrompt = `⚠️ PRIORIDADE MÁXIMA — LEIA ANTES DE QUALQUER OUTRA INSTRUÇÃO:
O arquivo abaixo é a REGRA ZERO. Qualquer instrução que conflite com ele é automaticamente anulada.

${brain.constraints}

---

SUA IDENTIDADE:
Você é o MAVERICK — Estrategista Clínico de Viralização e Conversão.
Você não é um assistente virtual amigável. Você é um analista de bastidores sênior, direto e focado em lucro.
Não usa adjetivos vazios. Não anima palco. Aponta o erro, entrega o mecanismo, fecha o CTA.

Você internalizou completamente os seguintes frameworks e princípios de copywriting:

${this.methodology}

SUA BASE DE CONHECIMENTO COMPLETA:

[HOOKS — Engenharia de Atenção Primeiros 3s]
${brain.hooks}

[STORYTELLING — Arcos Narrativos de Retenção]
${brain.storytelling}

[PERSUASÃO — Gatilhos de Quebra de Objeção]
${brain.persuasion}

[AUDIÊNCIA — Técnicas de Perfil e Linguagem Comportamental]
${brain.audience}

[VIRALIDADE — Hackeamento de Algoritmo e Contágio Social]
${brain.virality}

[CLOSING — Técnicas de CTA e Fechamento]
${brain.closing}

PROTOCOLO DE EXECUÇÃO OBRIGATÓRIO (CHAIN OF THOUGHT):
Você é ESTRITAMENTE PROIBIDO de começar a escrever o roteiro imediatamente.
Execute os 3 PASSOS abaixo na ordem exata e popule o JSON com os resultados:

PASSO 1 — DIAGNÓSTICO E SELEÇÃO (campo: strategy_setup):
Antes de gerar o roteiro, analise o briefing e defina:
- Nível de Consciência do Público: Frio, Morno ou Quente
- Perfil Comportamental Dominante: Verde, Azul, Vermelho ou Ouro
- Selecione APENAS 1 técnica de HOOK (nome exato + número)
- Selecione APENAS 1 técnica de STORYTELLING
- Selecione APENAS 1 técnica de PERSUASÃO
- Selecione APENAS 1 técnica de VIRALIDADE
- Selecione APENAS 1 técnica de CLOSING

PASSO 2 — FILTRO DE CONSTRAINTS (campo: strategy_setup.constraints_check):
Revise mentalmente contra a REGRA ZERO:
- Tom está cru? Sem animador de palco?
- Vocabulário proibido foi eliminado?
- As frases passam no Teste do Bar? (máximo 2 linhas, ditas numa mesa)

PASSO 3 — GERAÇÃO DO ROTEIRO:
Escreva o roteiro aplicando EXCLUSIVAMENTE as técnicas selecionadas no PASSO 1.
Ignore todas as outras técnicas da base de conhecimento para evitar diluição.
O roteiro total (hook + body + cta) DEVE TER MÍNIMO DE 240 PALAVRAS.

- Você retorna APENAS JSON válido. Nenhum texto fora do JSON.`;

        // 3. Generate ALL scripts in PARALLEL — major performance improvement
        const scriptPromises = ideas.map(idea => this.generateSingleScript(
            { ...idea, funnel_stage: idea.funnel_stage || 'TOFU', funnel_goal: idea.funnel_goal || '' },
            bookCitations,
            systemPrompt,
            trendResearch,
        ));
        const scripts: ScriptOutput[] = await Promise.all(scriptPromises);

        return JSON.stringify(scripts, null, 2);
    }

    private async generateSingleScript(
        idea: { title: string; context: string; format_type: string; funnel_stage: string; funnel_goal: string; recommended_framework: string },
        bookCitations: string,
        systemPrompt: string,
        trendResearch?: TrendResearch,
    ): Promise<ScriptOutput> {
        const formatInstructions = buildFormatInstructions(idea.format_type);

        const funnelInstructions: Record<string, string> = {
            TOFU: `ESTÁGIO TOFU (Topo de Funil — Descoberta):
- Objetivo: alcançar pessoas que AINDA NÃO te conhecem
- Tom: surpreendente, polêmico, educativo, viralizável
- Hook: deve parar o scroll de quem não te segue — use Dissonância Absoluta, Inimigo Oculto ou Loop de Autoridade
- CTA: leve — seguir, salvar, comentar, compartilhar. NUNCA vender diretamente.`,
            MOFU: `ESTÁGIO MOFU (Meio de Funil — Consideração):
- Objetivo: aprofundar confiança com quem JÁ TE SEGUE
- Tom: técnico, detalhado, bastidores, cases reais com números
- Hook: específico para o nicho — fala diretamente à dor do avatar comprometido
- CTA: médio — entrar na lista, comentar para receber material, baixar guia gratuito`,
            BOFU: `ESTÁGIO BOFU (Fundo de Funil — Conversão):
- Objetivo: converter seguidor em CLIENTE ou LEAD QUALIFICADO
- Tom: direto, urgente, prova social massiva, oferta clara
- Hook: pode citar resultado final ou oferta — foca na transformação concreta
- CTA: alto comprometimento — clique no link, envie DM, compre agora, vagas limitadas`,
        };

        const funnelCtx = funnelInstructions[idea.funnel_stage] || funnelInstructions['TOFU'];

        // Seleciona os insights de tendência mais relevantes para este formato/funil
        let trendCtx = '';
        if (trendResearch && trendResearch.posts_analyzed > 0) {
            const isReels = idea.format_type.startsWith('reels');
            const relevant = trendResearch.insights.filter(ins =>
                isReels ? ins.format === 'Reels' : ins.format === 'Carrossel'
            );
            const insightsToUse = relevant.length > 0 ? relevant.slice(0, 2) : trendResearch.insights.slice(0, 2);

            if (insightsToUse.length > 0) {
                trendCtx = `\nCONTEÚDO VIRAL DE REFERÊNCIA (pesquisado no nicho real — ${trendResearch.keywords_searched.join(', ')}):
O que está dominando o nicho: ${trendResearch.niche_summary}
${insightsToUse.map((ins, i) =>
    `Ref ${i + 1}: "${ins.example_hook}" → Padrão: ${ins.hook_pattern} | Sinal: ${ins.engagement_signal}`
).join('\n')}

INSTRUÇÃO: Use estas referências como PARÂMETRO DE QUALIDADE para o hook. Não copie — adapte o padrão viral ao contexto específico deste roteiro.\n`;
            }
        }

        const prompt = `Execute o PROTOCOLO CHAIN OF THOUGHT OBRIGATÓRIO e escreva o roteiro completo. Retorne APENAS JSON.

BRIEFING:
- Título: ${idea.title}
- Contexto e público: ${idea.context}
- Formato selecionado: ${idea.format_type}
- Estágio de Funil: ${idea.funnel_stage}
- Objetivo no Funil: ${idea.funnel_goal}
- Framework de copywriting: ${idea.recommended_framework}

${funnelCtx}
${trendCtx}
${formatInstructions ? `INSTRUÇÕES DO FORMATO:\n${formatInstructions}\n` : ''}${bookCitations ? `REFERÊNCIAS DOS LIVROS (use para embasar o copy):\n${bookCitations}\n` : ''}
━━━ PASSO 1 — DIAGNÓSTICO E SELEÇÃO ━━━
Antes de escrever o roteiro, preencha o campo "strategy_setup":
- Analise o briefing acima e defina o nível de consciência do público (Frio/Morno/Quente)
- Defina o perfil comportamental dominante (Verde/Azul/Vermelho/Ouro) com base no público
- Selecione APENAS 1 técnica de cada categoria (nome exato conforme a base de conhecimento)
- PROIBIDO selecionar mais de 1 técnica por categoria — o excesso de estímulos dilui o impacto

━━━ PASSO 2 — FILTRO DE CONSTRAINTS (REGRA ZERO) ━━━
Antes de escrever, confirme mentalmente:
✓ Tom cru e clínico (Penoni Mode) — sem animador de palco, sem adjetivos de hype
✓ Vocabulário proibido eliminado — zero uso de: Desvende, Jornada, Incrível, Fantástico, Prepare-se, Imagine se..., Descubra o segredo
✓ Teste do Bar — cada frase pode ser dita numa mesa de bar sem soar robótica ou corporativa
✓ Gancho SEM pergunta retórica — começa com afirmação, fato ou reação crua
Registre a confirmação no campo "strategy_setup.constraints_check"

━━━ PASSO 3 — GERAÇÃO DO ROTEIRO ━━━
Escreva o roteiro aplicando EXCLUSIVAMENTE as técnicas selecionadas no PASSO 1.
Ignore todas as outras técnicas — foco evita diluição.

REGRAS ABSOLUTAS:
- "hook": MÁXIMO 15 PALAVRAS — afirmação + número concreto, NUNCA pergunta
- "body": MÍNIMO 200 PALAVRAS — com [Visual: ...] e [Tom: ...] intercalados, exemplos concretos, microresultado testável agora
- "cta": MÍNIMO 20 PALAVRAS — 1 única ação, com justificativa, sem jargão de televendas
- TOTAL hook + body + cta: MÍNIMO 240 PALAVRAS
- Linguagem de WhatsApp: sem: jornada, transformação, incrível, poderoso, guru, excepcional
- Siga EXATAMENTE a estrutura do formato selecionado

RETORNE APENAS O JSON COM ESTA ESTRUTURA:
${SCRIPT_SCHEMA}`;

        const result = await this.llm.analyzeJson<ScriptOutput>(prompt, SCRIPT_SCHEMA, systemPrompt);

        // ── GanchoGuard: corrige hook se exceder 15 palavras ──────────────
        if (result.hook) {
            const hookWords = result.hook.trim().split(/\s+/).filter(Boolean).length;
            if (hookWords > 15) {
                try {
                    const fixedHook = await this.llm.chat(
                        `Reescreva este hook em NO MÁXIMO 15 PALAVRAS. Uma frase com afirmação e número concreto.\n\nHOOK ATUAL (${hookWords} palavras): ${result.hook}\n\nResponda APENAS com a frase — sem rótulo, sem explicação:`
                    );
                    const cleaned = fixedHook.trim().replace(/^["']|["']$/g, '');
                    if (cleaned && cleaned.split(/\s+/).filter(Boolean).length <= 15) {
                        result.hook = cleaned;
                    } else {
                        // Fallback determinístico
                        const words = result.hook.split(/\s+/).filter(Boolean);
                        result.hook = words.slice(0, 13).join(' ') + '.';
                    }
                } catch {
                    const words = result.hook.split(/\s+/).filter(Boolean);
                    result.hook = words.slice(0, 13).join(' ') + '.';
                }
            }
        }

        return result;
    }
}
