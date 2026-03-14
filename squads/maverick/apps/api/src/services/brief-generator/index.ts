import { generateWithFallback } from '../../utils/ai';

export interface HookPattern {
    id: string;
    name: string;
    formula: string;
    whyItWorks: string;
    example: string;
    keywords: string[];
}

export const PATTERN_LIBRARY: HookPattern[] = [
    {
        id: 'dissonancia',
        name: 'Dissonância Cognitiva',
        formula: '[Afirmação contraintuitiva que contradiz o senso comum]',
        whyItWorks: 'O cérebro para para resolver a contradição. Cria tensão intelectual imediata.',
        example: 'Parar de postar todo dia foi o que mais cresceu meu Instagram',
        keywords: ['mito', 'erro', 'errado', 'contrário', 'parar', 'menos'],
    },
    {
        id: 'emocao_antecipada',
        name: 'Emoção Antecipada',
        formula: '[Emoção negativa que o público já sente] + [promessa de alívio implícita]',
        whyItWorks: 'Nomeia o sentimento exato que o público tem mas não consegue expressar.',
        example: 'Você sente que trabalha muito e não evolui? Isso tem um nome.',
        keywords: ['sentimento', 'frustração', 'cansaço', 'perdido', 'ansiedade', 'desmotivado'],
    },
    {
        id: 'indignacao_compartilhada',
        name: 'Indignação Compartilhada',
        formula: 'Problema coletivo injusto + [Culpado externo claro]',
        whyItWorks: 'Une o público contra um inimigo comum. Cria tribalismo e identificação imediata.',
        example: 'Por que ninguém te ensinou isso na escola? Porque não é do interesse deles.',
        keywords: ['injusto', 'mercado', 'sistema', 'ninguém fala', 'esconde', 'mentira'],
    },
    {
        id: 'aviso_negativo',
        name: 'Aviso / Previsão Negativa',
        formula: 'Se você [comportamento atual], vai [consequência negativa concreta]',
        whyItWorks: 'Loss aversion: medo de perder ativa mais do que a perspectiva de ganhar.',
        example: 'Se você continuar fazendo isso no seu perfil, vai perder seguidores toda semana.',
        keywords: ['cuidado', 'erro', 'perigo', 'prejudica', 'vai perder', 'continuar assim'],
    },
    {
        id: 'resultado_numero',
        name: 'Resultado Antecipado + Número Específico',
        formula: '[Número exato] + [Resultado específico] + [Tempo concreto]',
        whyItWorks: 'Especificidade cria credibilidade. Números ativam o modo analítico do cérebro.',
        example: 'Em 47 dias faturei R$12.800 com 3 posts por semana. Sem fazer Reels.',
        keywords: ['resultado', 'faturei', 'cresci', 'consegui', 'em x dias', 'clientes'],
    },
    {
        id: 'autoridade',
        name: 'Nome de Autoridade / Prova Social',
        formula: '[Nome/empresa conhecida] + [fez/disse algo surpreendente]',
        whyItWorks: 'Transferência de autoridade. O público aceita mais facilmente quando uma referência valida.',
        example: 'O que a Apple faz que 99% das marcas ignoram completamente',
        keywords: ['apple', 'google', 'estudo', 'pesquisa', 'especialistas', 'harvard', 'warren buffett'],
    },
    {
        id: 'desafio_vulnerabilidade',
        name: 'Desafio Pessoal + Vulnerabilidade',
        formula: '[Situação difícil real] + [Decisão que parecia loucura] + [O que aconteceu]',
        whyItWorks: 'Vulnerabilidade autentica o criador. O público se identifica e quer o resultado.',
        example: 'Larguei meu emprego de R$8k/mês sem ter nenhum cliente. O que aconteceu depois.',
        keywords: ['larguei', 'perdi', 'falhei', 'errei', 'decidi', 'apostei', 'minha história'],
    },
    {
        id: 'meta_transparencia',
        name: 'Meta Audaciosa + Transparência Radical',
        formula: 'Vou [meta ambiciosa com número] até [data]. Estou em [status atual].',
        whyItWorks: 'Cria accountability público. O público vira torcida — precisa saber como vai terminar.',
        example: 'Minha meta é chegar a 100k em 6 meses. Hoje tenho 3.200 seguidores.',
        keywords: ['meta', 'objetivo', 'vou chegar', 'desafio de', 'meu plano', 'transparente'],
    },
    {
        id: 'identidade_aspiracional',
        name: 'Identidade Aspiracional',
        formula: 'Se você é [identidade desejada], você precisa saber que [informação contraintuitiva]',
        whyItWorks: 'As pessoas compram identidade antes de comprar produto. Ativa o "eu quero ser assim".',
        example: 'Se você quer ser levado a sério como especialista, para de fazer isso agora.',
        keywords: ['especialista', 'profissional', 'sério', 'autoridade', 'referência', 'líder'],
    },
];

export interface AnalysisData {
    pilares_conteudo?: string[];
    pontos_melhoria?: string[];
    content_tilt?: string;
    top_posts?: Array<{ description: string }>;
}

export interface BriefInput {
    topic: string;
    angle?: string;
    tone?: string;
    pattern: HookPattern;
    analysisData?: AnalysisData;
    scholarChunk?: string;
}

export function matchPattern(topic: string, analysisData?: AnalysisData): HookPattern {
    const searchText = [
        topic,
        ...(analysisData?.pilares_conteudo || []),
        ...(analysisData?.pontos_melhoria || []),
        analysisData?.content_tilt || '',
        ...(analysisData?.top_posts?.map(p => p.description) || []),
    ].join(' ').toLowerCase();

    let bestPattern = PATTERN_LIBRARY[0];
    let bestScore = 0;

    for (const pattern of PATTERN_LIBRARY) {
        const score = pattern.keywords.filter(kw => searchText.includes(kw)).length;
        if (score > bestScore) {
            bestScore = score;
            bestPattern = pattern;
        }
    }

    if (bestScore === 0) {
        return PATTERN_LIBRARY.find(p => p.id === 'resultado_numero') || PATTERN_LIBRARY[0];
    }

    return bestPattern;
}

export class BriefGenerator {
    async generate(input: BriefInput): Promise<string> {
        const { topic, angle, tone, pattern, analysisData, scholarChunk } = input;

        const painPoints = analysisData?.pontos_melhoria?.slice(0, 3).join(', ') || '';
        const pillars = analysisData?.pilares_conteudo?.slice(0, 3).join(', ') || '';
        const tilt = analysisData?.content_tilt || '';
        const topPostHint = analysisData?.top_posts?.[0]?.description || '';

        const prompt = `Você é um diretor criativo de conteúdo digital.
Sintetize os dados abaixo em um brief criativo de 100-150 palavras para um roteiro de Reel.

TEMA: "${topic}"
ÂNGULO: ${angle || 'Contraintuitivo'}
TOM: ${tone || 'Direto, coloquial'}
DORES REAIS DO PÚBLICO: ${painPoints || 'Não informado'}
PILARES DO CRIADOR: ${pillars || 'Não informado'}
DIFERENCIAL (content tilt): ${tilt || 'Não informado'}
POST QUE MAIS ENGAJOU: ${topPostHint || 'Não informado'}
${scholarChunk ? `REFERÊNCIA DE COPYWRITING:\n${scholarChunk}` : ''}

PADRÃO DE GANCHO SELECIONADO: ${pattern.name}
Fórmula: ${pattern.formula}
Por que funciona: ${pattern.whyItWorks}
Exemplo: "${pattern.example}"

Escreva o brief criativo agora (100-150 palavras, em português, sem headers, texto corrido):
O brief deve incluir: qual dor específica atacar, o gancho usando a fórmula acima, o que o público vai aprender, e o tom exato a usar.`;

        const completion = await generateWithFallback([{ role: 'user', content: prompt }]);
        return completion.choices[0]?.message?.content?.trim() || '';
    }
}
