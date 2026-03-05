/**
 * Instagram Content Format Definitions
 * Used by the CopywriterAgent to intelligently select the best format
 * for each content theme and objective.
 */

export interface ContentFormat {
    id: string;
    category: 'Reels' | 'Carrossel';
    name: string;
    description: string;
    bestFor: string[];
    avoid: string[];
    hookStyle: string;
    scriptStructure: string;
    filmingInstructions: string;
    energyLevel: 'baixa' | 'média' | 'alta';
    productionComplexity: 'simples' | 'média' | 'complexa';
    reachPotential: 'local' | 'médio' | 'viral';
}

export const CONTENT_FORMATS: ContentFormat[] = [

    // ─── REELS ───────────────────────────────────────────────────────────────

    {
        id: 'reels_react',
        category: 'Reels',
        name: 'Reels React',
        description: 'Criador reage a algo — uma opinião, situação, texto na tela, comportamento alheio ou tendência. A reação facial e emocional é o produto.',
        bestFor: [
            'opiniões fortes e polarizadoras',
            'erros comuns que o público comete',
            'controvérsias do nicho',
            '"você faz isso?" (identificação)',
            'reagir a conteúdo de terceiros ou tendências',
            'humor + ensinamento',
        ],
        avoid: [
            'conteúdo técnico complexo que precisa de explicação longa',
            'tutoriais passo a passo',
        ],
        hookStyle: 'Mostrar o estímulo (texto, situação) na tela primeiro — a reação do criador vem logo após como punch. Ex: [texto na tela: "Pessoas de sucesso acordam às 5h"] → reação surpresa/discordância/concordância exagerada.',
        scriptStructure: `1. SETUP (0-3s): Texto ou imagem do estímulo aparece na tela
2. REAÇÃO (3-8s): Expressão facial + frase de gancho verbal
3. DESENVOLVIMENTO (8-25s): Explica o porquê da reação — 2-3 pontos rápidos
4. CONCLUSÃO + CTA (25-30s): Frase de encerramento + pede comentário/salvar`,
        filmingInstructions: 'Câmera FRONTAL (selfie). Fique próximo ao rosto — expressão facial é tudo. Filmagem casual, luz natural ou ring light. Texto sobreposto na edição aparece antes da reação verbal. Cortes rápidos entre pontos.',
        energyLevel: 'alta',
        productionComplexity: 'simples',
        reachPotential: 'viral',
    },

    {
        id: 'reels_caixinha',
        category: 'Reels',
        name: 'Reels Caixinha de Pergunta',
        description: 'Responde perguntas que o público enviou via caixinha de perguntas no Stories. A pergunta aparece na tela (screenshot ou reproduzida), criador responde.',
        bestFor: [
            'dúvidas frequentes da audiência',
            'humanização e bastidores',
            'FAQ do nicho',
            'mostrar que se importa com a audiência',
            'conteúdo de autoridade sem parecer prepotente',
            'séries recorrentes ("Respondo tudo")',
        ],
        avoid: [
            'quando ainda não tem audiência engajada para enviar perguntas reais',
            'temas que exigem resposta muito longa e complexa',
        ],
        hookStyle: 'A pergunta NA TELA já é o hook — deve ser uma pergunta que o público em geral também quer saber. Ex: "Você me perguntou isso e eu PRECISO responder..." ou simplesmente mostrar a pergunta + expressão curiosa/divertida.',
        scriptStructure: `1. EXIBIÇÃO DA PERGUNTA (0-3s): Screenshot da pergunta ou texto na tela
2. GANCHO VERBAL (3-6s): "Essa pergunta eu recebo TODO DIA..." ou reação à pergunta
3. RESPOSTA DIRETA (6-25s): Resposta objetiva em 3-4 pontos ou história
4. EXPANSÃO (opcional, 25-35s): Contexto adicional, nuance
5. CTA (últimos 3s): "Manda sua pergunta lá no Stories"`,
        filmingInstructions: 'Câmera FRONTAL (selfie). Tom casual e acolhedor, como se fosse uma conversa privada. Pode ser sentado, em movimento leve. A pergunta é sobreposta na edição. Sem necessidade de tripé — pode ser segurado na mão.',
        energyLevel: 'média',
        productionComplexity: 'simples',
        reachPotential: 'médio',
    },

    {
        id: 'reels_terceira_pessoa',
        category: 'Reels',
        name: 'Reels Terceira Pessoa (Câmera Traseira)',
        description: 'Gravado com câmera traseira mostrando o ambiente, cena ou processo. O criador aparece de costas, de lado, ou não aparece. Narração em off ou textos na tela contam a história.',
        bestFor: [
            'lifestyle e bastidores do dia a dia',
            'processos e rotinas ("um dia na minha vida")',
            'transformações e resultados visíveis',
            'conteúdo aspiracional',
            'demonstração de produto/serviço em uso real',
            'ambiente de trabalho ou criação',
        ],
        avoid: [
            'quando o argumento principal depende da expressão facial',
            'conteúdo que exige olho no olho com o espectador',
        ],
        hookStyle: 'Cena visualmente impactante ou inesperada nos primeiros 3s. O espectador precisa querer saber o que está acontecendo. Texto na tela complementa: "Isso mudou tudo..." ou "O que ninguém te mostra..."',
        scriptStructure: `1. CENA DE ABERTURA (0-3s): Visual impactante, texto intrigante na tela
2. CONTEXTO (3-8s): Onde estou / o que está acontecendo (narração off ou texto)
3. DESENVOLVIMENTO (8-25s): A história/processo em imagens + texto explicativo
4. CLÍMAX/RESULTADO (25-35s): O ponto culminante — resultado, insight, transformação
5. CTA (últimos 3s): Texto na tela ou narração`,
        filmingInstructions: 'Câmera TRASEIRA. Explore o ambiente com movimento natural. Estabilizador ajuda mas não é obrigatório — movimento orgânico é autêntico. Use cortes no ritmo da música. Textos na tela substituem ou complementam a narração.',
        energyLevel: 'baixa',
        productionComplexity: 'média',
        reachPotential: 'médio',
    },

    {
        id: 'reels_primeira_pessoa',
        category: 'Reels',
        name: 'Reels Primeira Pessoa (Selfie Íntimo)',
        description: 'Câmera frontal próxima ao rosto, formato confessional e íntimo. O criador fala diretamente ao espectador como se fosse uma conversa um a um.',
        bestFor: [
            'histórias pessoais e vulnerabilidade',
            'confissões e revelações',
            'conselhos de coração a coração',
            'motivação pessoal',
            'antes/depois emocional',
            'momentos de virada ou aprendizado',
        ],
        avoid: [
            'conteúdo técnico ou educacional frio',
            'quando o ambiente/produto é o protagonista',
        ],
        hookStyle: 'Frase direta, pessoal e impactante nos primeiros 2s. Sem introdução. Ex: "Eu fui demitido e foi a melhor coisa que aconteceu na minha vida." — o espectador precisa sentir que vai ouvir algo genuíno.',
        scriptStructure: `1. FRASE DE ABERTURA (0-3s): Revelação ou confissão direta — sem enrolação
2. CONTEXTO RÁPIDO (3-8s): "Deixa eu te contar o que aconteceu..."
3. HISTÓRIA/PONTO CENTRAL (8-30s): A narrativa em ordem cronológica ou por impacto
4. VIRADA/INSIGHT (30-40s): O que aprendeu / como mudou
5. CTA EMOCIONAL (últimos 3s): "Se você passou por isso, salva esse vídeo"`,
        filmingInstructions: 'Câmera FRONTAL, bem próxima ao rosto (menos de 50cm). Segure na mão — leve tremido é autêntico. Pode ser deitado, andando, no carro. Tom de voz íntimo e baixo. Evite cenário elaborado — o foco é o rosto e a emoção.',
        energyLevel: 'média',
        productionComplexity: 'simples',
        reachPotential: 'viral',
    },

    {
        id: 'reels_talking_head',
        category: 'Reels',
        name: 'Reels Talking Head (Câmera Fixa)',
        description: 'Câmera travada em tripé, criador fala diretamente para câmera com autoridade. Formato mais estruturado, educacional e formal. O criador é o apresentador.',
        bestFor: [
            'educação e conteúdo de nicho técnico',
            'explicações que precisam de contexto',
            'autoridade e posicionamento de especialista',
            'anúncios e lançamentos',
            'refutação de mitos',
        ],
        avoid: [
            'quando quer parecer espontâneo e casual',
            'humor e entretenimento leve',
            'histórias pessoais emocionais',
        ],
        hookStyle: 'Promessa direta e específica: "Nos próximos 30 segundos você vai aprender X que vai te economizar Y." Ou pergunta provocativa: "Por que 90% dos [nicho] cometem esse erro básico?"',
        scriptStructure: `1. PROMESSA/HOOK (0-5s): O que o espectador vai ganhar assistindo até o fim
2. PONTO 1 (5-15s): Argumento principal com dado ou exemplo
3. PONTO 2 (15-25s): Segundo argumento ou aprofundamento
4. PONTO 3 / VIRADA (25-35s): O insight que muda tudo
5. CTA (últimos 5s): Ação específica e clara`,
        filmingInstructions: 'Câmera FIXA em tripé, altura dos olhos. Boa iluminação frontal. Fundo limpo ou relevante ao nicho. Contato visual constante com a câmera. Roupagem adequada ao nível de autoridade do nicho.',
        energyLevel: 'média',
        productionComplexity: 'média',
        reachPotential: 'médio',
    },

    {
        id: 'reels_tutorial',
        category: 'Reels',
        name: 'Reels Tutorial / Demonstração',
        description: 'Mostra um processo, técnica ou como fazer algo. O resultado final ou transformação é geralmente revelado no início como "spoiler" para prender a atenção.',
        bestFor: [
            '"como fazer" qualquer coisa do nicho',
            'antes e depois visual',
            'demonstração de produto ou ferramenta',
            'receitas, montagens, processos',
            'hacks e atalhos',
        ],
        avoid: [
            'processos que levam muito tempo e não ficam bons em 30-60s',
            'quando não há resultado visual claro',
        ],
        hookStyle: 'Mostrar o RESULTADO FINAL nos primeiros 2s, depois volta ao início do processo: "Vou te mostrar como chegar aqui em 3 passos." O espectador fica para ver COMO chegar naquele resultado.',
        scriptStructure: `1. RESULTADO FINAL (0-3s): Spoiler do que vai ser ensinado
2. "AQUI ESTÁ COMO" (3-6s): Transição para o início do processo
3. PASSO A PASSO (6-35s): Cada etapa com legenda/texto na tela
4. RESULTADO REPETIDO (35-40s): Mostra o resultado de novo
5. CTA (últimos 3s): "Salva pra não perder" ou "Comenta se quiser o passo X"`,
        filmingInstructions: 'Câmera mista — mãos, produto, tela, ambiente. Use câmera traseira para mostrar o processo. Texto na tela em cada etapa. Cortes rápidos entre passos. Música animada no fundo.',
        energyLevel: 'média',
        productionComplexity: 'média',
        reachPotential: 'médio',
    },

    {
        id: 'reels_broll_texto',
        category: 'Reels',
        name: 'Reels B-roll + Texto na Tela',
        description: 'Imagens de cobertura (b-roll) com copy poderosa na tela. Pode ter narração em off ou ser só visual + texto. Altamente estético e compartilhável.',
        bestFor: [
            'frases de impacto e reflexões',
            'motivação e inspiração',
            'conteúdo aspiracional e lifestyle',
            'citações aplicadas ao nicho',
            'anúncios e lançamentos com estética premium',
        ],
        avoid: [
            'quando a explicação verbal é essencial para entender',
            'conteúdo técnico que precisa de contexto falado',
        ],
        hookStyle: 'A primeira frase na tela precisa ser o hook mais forte — parar o scroll imediatamente. Ex: "A maioria das pessoas não vai chegar lá. E eu sei exatamente por quê." Enquanto uma cena bonita aparece.',
        scriptStructure: `1. FRASE GANCHO NA TELA (0-3s): Texto + visual impactante
2. DESENVOLVIMENTO EM TEXTO (3-25s): Ideia desenvolvida em 3-5 frases curtas, uma por vez
3. FRASE DE VIRADA (25-35s): O insight principal
4. CTA NA TELA (últimos 3s): Ação clara`,
        filmingInstructions: 'Câmera TRASEIRA em movimento suave ou cenas do dia a dia. Foco no ambiente e estética. Texto centralizado na tela, fontes elegantes. Música ambiente que combine com o tom. Pode usar imagens de arquivo ou b-roll próprio.',
        energyLevel: 'baixa',
        productionComplexity: 'média',
        reachPotential: 'viral',
    },

    {
        id: 'reels_trend_meme',
        category: 'Reels',
        name: 'Reels Trend / Meme',
        description: 'Usa áudio em tendência, formato de meme viral ou template popular e adapta ao nicho. O humor e a identificação são os vetores de compartilhamento. Alta chance de alcance orgânico.',
        bestFor: [
            'crescimento rápido de seguidores (topo de funil)',
            'humor aplicado ao nicho',
            'situações de identificação ("isso sou eu")',
            'humanização da marca/criador',
            'aproveitar ondas de tendência',
            'alcançar não-seguidores via Explorar',
        ],
        avoid: [
            'quando a marca tem posicionamento muito formal/sério',
            'quando o meme está passando do pico de popularidade',
            'sem adaptar ao nicho — meme genérico não converte',
        ],
        hookStyle: 'O próprio formato do meme/trend JÁ É o hook — o espectador reconhece o template e quer ver a versão do criador. O diferencial está na adaptação CRIATIVA ao nicho: quanto mais específica e precisa, mais engajamento.',
        scriptStructure: `1. SETUP DO MEME/TREND (0-3s): Reproduz a estrutura conhecida do formato
2. ADAPTAÇÃO AO NICHO (3-15s): Onde o humor/identificação se aplica especificamente ao público
3. PUNCH / VIRADA (15-25s): O momento de maior identificação ou humor
4. CTA LEVE (últimos 3s): "Marca quem é assim" / "Salva esse" / "Você se identificou?"`,
        filmingInstructions: 'Câmera FRONTAL, expressivo e rápido. Adapte exatamente o áudio trending — timing é tudo. Legenda na tela obrigatória para acessibilidade. Cortes rápidos no beat da música. Expressão exagerada funciona melhor.',
        energyLevel: 'alta',
        productionComplexity: 'simples',
        reachPotential: 'viral',
    },

    // ─── CARROSSEL ────────────────────────────────────────────────────────────

    {
        id: 'carrossel_educativo',
        category: 'Carrossel',
        name: 'Carrossel Educativo (Lista / Passo a Passo)',
        description: 'Ensina algo estruturado em slides. Cada slide é uma etapa, dica ou ponto. Gera salvamentos — a métrica mais valiosa para o algoritmo do feed.',
        bestFor: [
            'listas de dicas, erros, recursos',
            'tutoriais visuais passo a passo',
            '"X coisas que você precisa saber sobre Y"',
            'comparações e rankings',
            'conteúdo que o público vai querer consultar depois (→ salvar)',
        ],
        avoid: [
            'histórias emocionais que perdem impacto fragmentadas em slides',
            'quando há apenas 1 ponto a fazer',
        ],
        hookStyle: 'Slide 1: Promessa clara com número específico. "7 erros que estão te impedindo de [resultado]." O número cria expectativa e o problema identificado gera urgência.',
        scriptStructure: `Slide 1: TÍTULO/HOOK — promessa + número
Slides 2-N: 1 ponto por slide — título + explicação em 1-2 linhas + visual
Penúltimo slide: RESUMO ou insight mais poderoso
Último slide: CTA + perfil/logo`,
        filmingInstructions: 'Design consistente com identidade visual. Hierarquia tipográfica clara. Slide 1 tem que parar o scroll sozinho. Máximo 10 slides — cada um autossuficiente. Use ícones e elementos visuais para facilitar a leitura rápida.',
        energyLevel: 'baixa',
        productionComplexity: 'média',
        reachPotential: 'médio',
    },

    {
        id: 'carrossel_narrativo',
        category: 'Carrossel',
        name: 'Carrossel Narrativo (Storytelling)',
        description: 'Conta uma história em slides. Conflito → desenvolvimento → resolução. Cada slide aumenta a tensão ou curiosidade, forçando o deslize.',
        bestFor: [
            'histórias de transformação e casos reais',
            'jornada do criador ou cliente',
            'estudos de caso',
            'narrativas de superação aplicadas ao nicho',
            '"como eu passei de X para Y"',
        ],
        avoid: [
            'conteúdo que não tem arco narrativo claro',
            'listas de dicas sem conexão emocional',
        ],
        hookStyle: 'Slide 1: Começa pela VIRADA ou resultado final — "Em 6 meses, passei de [ponto A] para [ponto B]. Aqui está o que ninguém te conta sobre essa jornada."',
        scriptStructure: `Slide 1: RESULTADO/VIRADA — começa pelo clímax
Slide 2: "Mas nem sempre foi assim..." — o ponto de partida (gera empatia)
Slides 3-N: A jornada com seus obstáculos e aprendizados
Penúltimo: O insight ou virada decisiva
Último: Onde está hoje + CTA para quem está na mesma jornada`,
        filmingInstructions: 'Design mais emocional e visual, menos técnico. Fotos pessoais/reais aumentam a conexão. Tipografia expressiva. Cada slide deve terminar com uma frase que convida ao próximo deslize.',
        energyLevel: 'média',
        productionComplexity: 'média',
        reachPotential: 'médio',
    },

    {
        id: 'carrossel_antes_depois',
        category: 'Carrossel',
        name: 'Carrossel Antes / Depois',
        description: 'Mostra a transformação de forma visual e direta. O contraste entre o estado inicial e o resultado final é o principal argumento.',
        bestFor: [
            'resultados de clientes e provas sociais',
            'transformações visíveis (estética, design, finanças)',
            'comparação de abordagem errada vs. certa',
            'evolução de produto/marca',
        ],
        avoid: [
            'quando a transformação não é visual ou tangível',
            'sem resultado real para mostrar',
        ],
        hookStyle: 'Slide 1: Mostra o DEPOIS (resultado) em destaque. A curiosidade sobre o "antes" puxa o deslize. Ou coloca ambos side by side no primeiro slide para impacto imediato.',
        scriptStructure: `Slide 1: RESULTADO/DEPOIS em destaque
Slide 2: O ANTES — o problema ou ponto de partida
Slides 3-N: O QUE MUDOU e como — a transformação explicada
Penúltimo: Os resultados em números/dados
Último: CTA — "Quer esse resultado? [ação]"`,
        filmingInstructions: 'Imagens de alta qualidade para o antes e depois. Consistência visual entre os slides. Dados e números em destaque. Depoimento do cliente se disponível.',
        energyLevel: 'baixa',
        productionComplexity: 'média',
        reachPotential: 'médio',
    },

    {
        id: 'carrossel_opinion',
        category: 'Carrossel',
        name: 'Carrossel de Opinião / Manifesto',
        description: 'Toma uma posição forte e a defende com argumentos ao longo dos slides. Gera debate, comentários e salvamentos de quem concorda.',
        bestFor: [
            'posicionamento e autoridade de nicho',
            'contrariar a narrativa comum do mercado',
            'reflexões e manifestos',
            '"o que ninguém quer ouvir sobre X"',
            'gerar comentários e debate',
        ],
        avoid: [
            'quando não há convicção genuína sobre o tema',
            'nichos onde a audiência é muito homogênea e não gera debate',
        ],
        hookStyle: 'Slide 1: A opinião mais forte e direta, sem rodeios. "X está errado. E vou provar com dados." O slide 1 de um manifesto precisa ser polarizador o suficiente para fazer o espectador deslizar para ver a defesa.',
        scriptStructure: `Slide 1: TESE FORTE — a opinião sem filtro
Slides 2-3: Os argumentos principais com evidências
Slide N-2: O contra-argumento (mostra que pensou nos dois lados)
Slide N-1: A refutação do contra-argumento
Último: Conclusão + CTA que convida ao debate ("Você concorda? Comenta."`,
        filmingInstructions: 'Design assertivo e limpo. Tipografia forte no slide 1. Menos imagens, mais texto impactante. A identidade visual deve passar autoridade e confiança.',
        energyLevel: 'média',
        productionComplexity: 'simples',
        reachPotential: 'viral',
    },
];

/** Get format by id */
export function getFormat(id: string): ContentFormat | undefined {
    return CONTENT_FORMATS.find(f => f.id === id);
}

/** Build a compact format menu for the LLM to choose from */
export function buildFormatMenu(): string {
    const reels = CONTENT_FORMATS.filter(f => f.category === 'Reels');
    const carrosseis = CONTENT_FORMATS.filter(f => f.category === 'Carrossel');

    const formatEntry = (f: ContentFormat) =>
        `  • ${f.id}: "${f.name}" — ${f.description.split('.')[0]}.\n    Melhor para: ${f.bestFor.slice(0, 3).join(', ')}.\n    Alcance: ${f.reachPotential} | Produção: ${f.productionComplexity}`;

    return `REELS (${reels.length} tipos):
${reels.map(formatEntry).join('\n')}

CARROSSEL (${carrosseis.length} tipos):
${carrosseis.map(formatEntry).join('\n')}`;
}

/** Build full format instructions for a specific format_id */
export function buildFormatInstructions(formatId: string): string {
    const f = getFormat(formatId);
    if (!f) return '';

    return `FORMATO SELECIONADO: ${f.name} (${f.category})
Descrição: ${f.description}

COMO GRAVAR:
${f.filmingInstructions}

ESTRUTURA DO ROTEIRO:
${f.scriptStructure}

ESTILO DO GANCHO:
${f.hookStyle}

Nível de energia: ${f.energyLevel} | Complexidade de produção: ${f.productionComplexity} | Potencial de alcance: ${f.reachPotential}`;
}
