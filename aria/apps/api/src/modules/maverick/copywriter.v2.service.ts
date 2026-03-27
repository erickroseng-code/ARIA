import fs from 'fs';
import path from 'path';

// Diretório raiz do Cérebro Modular
const BRAIN_PATH = path.resolve(
  __dirname,
  '../../../../../../squads/maverick/data/knowledge/brain'
);

// ─── Leitura do Cérebro ──────────────────────────────────────────────────────

function readBrainFile(relativePath: string): string {
  try {
    const fullPath = path.join(BRAIN_PATH, relativePath);
    return fs.readFileSync(fullPath, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Carrega o cérebro completo na hierarquia DNS:
 * P1 (ABSOLUTE OVERRIDE): 06_constraints + 10_vetoes
 * P2 (Voz): 09_tone + 07_persona
 * P3 (Execução): 03_hooks → 01_virality → 04_storytelling → 08_persuasion → 05_closing
 */
function loadBrainDNS(): {
  constraints: string;
  vetoes: string;
  tone: string;
  persona: string;
  hooks: string;
  virality: string;
  storytelling: string;
  persuasion: string;
  closing: string;
} {
  return {
    constraints:  readBrainFile('06_constraints.md'),
    vetoes:       readBrainFile('10_vetoes.md'),
    tone:         readBrainFile('09_tone.md'),
    persona:      readBrainFile('07_persona.md'),
    hooks:        readBrainFile('03_hooks.md'),
    virality:     readBrainFile('01_virality.md'),
    storytelling: readBrainFile('04_storytelling.md'),
    persuasion:   readBrainFile('08_persuasion.md'),
    closing:      readBrainFile('05_closing.md'),
  };
}

function readAllFormulas(): { name: string; content: string }[] {
  const formulasDir = path.join(BRAIN_PATH, 'formulas');
  try {
    const files = fs.readdirSync(formulasDir).filter(f => f.endsWith('.md'));
    return files.map(f => ({
      name: f.replace('.md', ''),
      content: fs.readFileSync(path.join(formulasDir, f), 'utf-8'),
    }));
  } catch {
    return [];
  }
}

function readSwipeFiles(): { name: string; content: string }[] {
  const swipesDir = path.join(BRAIN_PATH, 'swipes');
  try {
    const files = fs.readdirSync(swipesDir).filter(f => f.endsWith('.md'));
    return files.map(f => ({
      name: f.replace('.md', ''),
      content: fs.readFileSync(path.join(swipesDir, f), 'utf-8'),
    }));
  } catch {
    return [];
  }
}

// ─── Seletor de Fórmulas (Router rápido determinístico) ──────────────────────

function selectFormulasForTopic(topic: string, count = 3): string[] {
  const all = readAllFormulas();
  if (all.length === 0) return [];

  // Heurística simples: rotacionar baseado no hash do tópico para variedade
  const hash = topic.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const shuffled = [...all].sort((a, b) =>
    ((hash + a.name.length) % 7) - ((hash + b.name.length) % 7)
  );

  return shuffled.slice(0, count).map(f => f.content);
}

function selectSwipeForFormat(format: string): string {
  const swipes = readSwipeFiles();
  if (swipes.length === 0) return '';

  // Preferência por nome de arquivo que mencione o formato
  const match = swipes.find(s => s.name.toLowerCase().includes(format.toLowerCase()));
  return match ? match.content : swipes[0].content;
}

// ─── Modelos ──────────────────────────────────────────────────────────────────

const MODEL_FAST   = 'claude-haiku-4-5-20251001';  // dossiê, ideação, pirâmide
const MODEL_WRITER = 'claude-sonnet-4-6';           // roteiros finais

// ─── Anthropic — chamada simples com Prompt Caching ──────────────────────────
// O system prompt (brain files) é marcado com cache_control: ephemeral.
// Primeira call: escreve cache (25% mais caro). Calls seguintes: lê cache (10% do custo).

async function callAnthropic(systemPrompt: string, userPrompt: string, model: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurado');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic error (${response.status}): ${err}`);
  }

  const data = await response.json() as any;
  return data.content?.[0]?.text ?? '';
}

// ─── Anthropic — streaming com Prompt Caching ────────────────────────────────

async function* callAnthropicStream(systemPrompt: string, userPrompt: string, model: string): AsyncGenerator<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurado');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      stream: true,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok || !response.body) {
    const err = await response.text();
    throw new Error(`Anthropic stream error (${response.status}): ${err}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('event:')) continue;
      if (trimmed.startsWith('data: ')) {
        try {
          const chunk = JSON.parse(trimmed.slice(6));
          if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
            yield chunk.delta.text;
          }
        } catch { /* skip malformed chunk */ }
      }
    }
  }
}

// ─── Serviço de Onboarding: Gera a Pirâmide de Conteúdo ─────────────────────

export interface OnboardingInput {
  niche: string;
  targetAudience: string;
}

export interface ContentPyramid {
  pillars: {
    name: string;
    topics: string[];
  }[];
}

export async function generateContentPyramid(input: OnboardingInput): Promise<ContentPyramid> {
  const brain = loadBrainDNS();

  const systemPrompt = `<CONSTRAINTS_AND_VETOES>
${brain.constraints}

---

${brain.vetoes}
</CONSTRAINTS_AND_VETOES>

<PERSONA>
${brain.persona}
</PERSONA>

Você está na FASE 1 (O ESTRATEGISTA). Sua missão: analisar o nicho e público fornecidos
e construir uma Pirâmide de Conteúdo com Pilares que refletem o Inimigo Comum,
a Dor Latejante e o Desejo Inconfessável daquele nicho.
Retorne APENAS um JSON válido, sem markdown, sem explicações extras.`;

  const userPrompt = `Nicho: ${input.niche}
Público-alvo: ${input.targetAudience}

Crie uma pirâmide de conteúdo com 3 Pilares Macro estratégicos e 5 Micro-temas por pilar.
Os temas devem ser ultra-específicos — não genéricos. Use números, situações e personagens concretos.
Retorne neste formato JSON exato:
{
  "pillars": [
    { "name": "Nome do Pilar", "topics": ["tema específico 1", "tema específico 2", "tema específico 3", "tema específico 4", "tema específico 5"] }
  ]
}`;

  const raw = await callAnthropic(systemPrompt, userPrompt, MODEL_FAST);

  // Extrair JSON da resposta
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Resposta de onboarding inválida');
  return JSON.parse(jsonMatch[0]) as ContentPyramid;
}

// ─── Serviço de Ideação: Gera Cards de Ângulos ───────────────────────────────

export interface IdeatorInput {
  niche: string;
  targetAudience: string;
  topic: string;
}

export interface IdeaCard {
  id: string;
  angle: string;
  hook: string;
}

export async function generateIdeaCards(input: IdeatorInput): Promise<IdeaCard[]> {
  const brain = loadBrainDNS();

  // Selecionar 3 fórmulas rotativas para injetar
  const formulas = selectFormulasForTopic(input.topic, 3);
  const formulasText = formulas.length > 0
    ? formulas.map((f, i) => `## FÓRMULA ${i + 1}\n${f}`).join('\n\n---\n\n')
    : 'Use técnicas de copywriting persuasivo e específico.';

  const systemPrompt = `<CONSTRAINTS_AND_VETOES>
${brain.constraints}

---

${brain.vetoes}
</CONSTRAINTS_AND_VETOES>

<PERSONA>
${brain.persona}
</PERSONA>

Você está na FASE 2 (O IDEATOR). Sua missão: NUNCA inventar ângulos do zero.
Injetar o tema nas FÓRMULAS e usar as TÉCNICAS DE HOOK para garantir ganchos de parada de scroll.

<HOOKS_REFERENCE>
${brain.hooks}
</HOOKS_REFERENCE>

<FORMULAS>
${formulasText}
</FORMULAS>

REGRAS ABSOLUTAS:
- Hook: NUNCA pergunta retórica. Começa com fato, reação crua ou número. Máximo 20 palavras.
- Ângulo: máximo 1 linha. Ultra-específico. Com número, personagem ou situação concreta.
- Zero palavras da Veto List. Zero clichês de IA.
- Retorne APENAS JSON válido, sem markdown.`;

  const userPrompt = `Nicho: ${input.niche}
Público-alvo: ${input.targetAudience}
Tema: ${input.topic}

Gere 5 cards de ângulo com personagens e situações ultra-específicas. Cada card deve ser radicalmente diferente em abordagem.
Retorne neste formato JSON exato:
{
  "cards": [
    { "id": "1", "angle": "Título do ângulo específico", "hook": "A frase de abertura (1-2 linhas max)" }
  ]
}`;

  const raw = await callAnthropic(systemPrompt, userPrompt, MODEL_FAST);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Resposta do Ideator inválida');

  const parsed = JSON.parse(jsonMatch[0]);
  return parsed.cards as IdeaCard[];
}

// ─── Serviço de Geração: O Copywriter RAG ────────────────────────────────────

export interface GenerateInput {
  niche: string;
  targetAudience: string;
  angle: string;
  hook: string;
  format: 'reels' | 'carousel' | 'sales_page';
}

export async function* generateScript(input: GenerateInput): AsyncGenerator<string> {
  const brain = loadBrainDNS();
  const swipe = selectSwipeForFormat(input.format);
  const formulas = selectFormulasForTopic(input.angle, 2);
  const formulasText = formulas.map((f, i) => `### FÓRMULA DE ESTRUTURA ${i + 1}\n${f}`).join('\n\n');

  const formatStructure = input.format === 'reels'
    ? `[HOOK] (máx. 20 palavras — fato, reação crua ou número. NUNCA pergunta)
[CORPO] (200–220 palavras total. Bullets curtos. Ritmo estacato. 1 técnica por camada)
[CTA] (1 única ação)`
    : input.format === 'carousel'
    ? `[SLIDE 1] Headline — fato contraintuitivo + dado. Sem pergunta.
[SLIDE 2] Custo — o que a pessoa perde por não saber isso.
[SLIDE 3] a [SLIDE 6] — 1 insight acionável por slide. Título curto + 2-3 linhas cruas.
[SLIDE 7] Resumo — feito para ser salvo.
[SLIDE 8] CTA — 1 única ação.`
    : `Headline: Mecanismo Único + Resultado Desejado
Lead: Narrativa de transformação concreta
Oferta: o que é, para quem, bônus, garantia
FAQ: quebra das 3 maiores objeções com prova social`;

  const systemPrompt = `<CONSTRAINTS_AND_VETOES>
${brain.constraints}

---

${brain.vetoes}
</CONSTRAINTS_AND_VETOES>

<VOICE_AND_PERSONA>
${brain.tone}

---

${brain.persona}
</VOICE_AND_PERSONA>

<HOOKS>
${brain.hooks}
</HOOKS>

<FORMULAS>
${formulasText}
</FORMULAS>

<SWIPE_FILE_SKELETON>
Referência de ritmo e cadência — NÃO copie o conteúdo. Copie a proporção de blocos e tamanho de frases.
${swipe}
</SWIPE_FILE_SKELETON>

<FORMAT_STRUCTURE>
${formatStructure}
</FORMAT_STRUCTURE>

REGRA FINAL: 1 técnica por camada (hook, corpo, persuasão, fechamento). Entregue APENAS a copy. Sem títulos de seção, sem meta-comentários.`;

  const userPrompt = `NICHO: ${input.niche}
PÚBLICO-ALVO: ${input.targetAudience}
ÂNGULO ESCOLHIDO: ${input.angle}
GANCHO INICIAL: ${input.hook}

Escreva a copy completa seguindo a FORMAT_STRUCTURE. Voz do Maverick: analista sênior em ligação de consultoria — direto, cético, zero clichê.`;

  yield* callAnthropicStream(systemPrompt, userPrompt, MODEL_WRITER);
}

// ─── Serviço de Dossiê: Estratégia + 3 Ganchos ───────────────────────────────

export type MaverickMode = 'content' | 'sales' | 'microcopy';

export interface ReferenceVideo {
  title: string;
  content: string;
  views: number;
}

export interface DossieInput {
  mode: MaverickMode;
  scopingAnswers: Record<string, string>;
  referenceVideos?: ReferenceVideo[];
}

export interface DossieOutput {
  strategy: string;
  hooks: string[];
}

export async function generateDossie(input: DossieInput): Promise<DossieOutput> {
  const brain = loadBrainDNS();

  const modeContext = input.mode === 'content'
    ? `MODO: Criador de Conteúdo (Reels/Carrossel)
Objetivo: ${input.scopingAnswers['objetivo'] ?? ''}
Tema e Inimigo Comum: ${input.scopingAnswers['temaInimigo'] ?? ''}
CTA Desejada: ${input.scopingAnswers['cta'] ?? ''}`
    : input.mode === 'sales'
    ? `MODO: Página de Vendas
Produto e Valor: ${input.scopingAnswers['produto'] ?? ''}
Mecanismo Único: ${input.scopingAnswers['mecanismo'] ?? ''}
Maior Objeção: ${input.scopingAnswers['objecao'] ?? ''}`
    : `MODO: Micro-Copy
Local da Copy: ${input.scopingAnswers['local'] ?? ''}
Contexto/Gatilho: ${input.scopingAnswers['contexto'] ?? ''}
Ação Imediata: ${input.scopingAnswers['acao'] ?? ''}`;

  const systemPrompt = `<CONSTRAINTS_AND_VETOES>
${brain.constraints}

---

${brain.vetoes}
</CONSTRAINTS_AND_VETOES>

<PERSONA>
${brain.persona}
</PERSONA>

Você está gerando o DOSSIÊ MAVERICK. Seu trabalho:
1. Estratégia: 1 frase curta e cirúrgica. Sem adjetivos.
2. 3 ganchos com técnicas dramaticamente diferentes entre si.

<HOOKS_REFERENCE>
${brain.hooks}
</HOOKS_REFERENCE>

REGRAS DOS GANCHOS:
- NUNCA pergunta retórica. Começa com fato, reação crua ou número.
- Máximo 20 palavras por gancho.
- Técnicas diferentes: ex. Contraste Extremo, Inimigo Comum, Especificidade Cirúrgica.
- Zero palavras da Veto List.
- Retorne APENAS JSON válido, sem markdown.`;

  const referenceBlock = (input.referenceVideos && input.referenceVideos.length > 0)
    ? `\n\nVÍDEOS REAIS QUE VIRALIZARAM NO INSTAGRAM (use as estruturas como referência):
${input.referenceVideos.map((v, i) =>
  `[${i + 1}] "${v.title}"${v.views > 0 ? ` — ${(v.views / 1000).toFixed(0)}K views` : ''}\n${v.content}`
).join('\n\n')}

Use esses vídeos como referência de estrutura e ângulo para os ganchos. Espelhe o que funcionou.`
    : '';

  const userPrompt = `${modeContext}${referenceBlock}

Gere o dossiê estratégico.
Retorne neste formato JSON exato:
{
  "strategy": "A estratégia de ataque em 1 frase",
  "hooks": [
    "Gancho 1 (técnica: Contraste)",
    "Gancho 2 (técnica: Inimigo Comum)",
    "Gancho 3 (técnica: Especificidade Numérica)"
  ]
}`;

  const raw = await callAnthropic(systemPrompt, userPrompt, MODEL_FAST);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Resposta do Dossiê inválida');
  return JSON.parse(jsonMatch[0]) as DossieOutput;
}

// ─── Serviço de Geração V2 (modo + scoping + hook escolhido) ─────────────────

export interface GenerateV2Input {
  mode: MaverickMode;
  scopingAnswers: Record<string, string>;
  chosenHook: string;
}

export async function* generateScriptV2(input: GenerateV2Input): AsyncGenerator<string> {
  const brain = loadBrainDNS();

  const format = input.mode === 'content' ? 'reels' : input.mode === 'sales' ? 'sales_page' : 'microcopy';
  const swipe = selectSwipeForFormat(format);
  const formulas = selectFormulasForTopic(input.chosenHook, 2);
  const formulasText = formulas.map((f, i) => `### FÓRMULA ${i + 1}\n${f}`).join('\n\n');

  // Sub-protocolo por modo + objetivo — estrutura + técnicas ativas
  const objetivo = input.scopingAnswers['objetivo'] ?? '';
  const contentSubProtocol = objetivo.includes('Viral')
    ? `SUB-PROTOCOLO: REELS - VIRALIZAR
OBJETIVO: Máximo alcance orgânico. O algoritmo pune o tédio — cada frase deve gerar reação emocional de alta excitação (raiva, espanto, indignação).

ESTRUTURA OBRIGATÓRIA — use exatamente esses marcadores no output:
[HOOK] — 00-03s. Tese oposta a uma "verdade sagrada" do nicho. Máx. 20 palavras. Começa com fato ou reação visceral. NUNCA pergunta.
[CORPO] — 03-45s. Bullets curtos, máx. 8 palavras por linha. Ritmo estacato. 200-220 palavras no total. Leve a tese ao extremo absoluto — sem meio-termo.
[CTA] — 1 única ação. Peça para enviar para um grupo/comunidade, não "curtir e salvar".

Técnicas ativas (1 por camada — escolha a mais forte):
- Hook: Polarização Calculada (01_virality #1) ou Ancoragem nos Extremos (01_virality #2)
- Corpo: Engenharia de Alta Excitação — emoção dominante = raiva ou espanto (01_virality #3)
- Persuasão: Inimigo Comum Oculto — retire a culpa do usuário (08_persuasion #3)
- Fechamento: Ilusão Viral — mande para grupo/comunidade (01_virality #5)`
    : objetivo.includes('Autoridade')
    ? `SUB-PROTOCOLO: REELS - EDUCAR
OBJETIVO: Posicionar como especialista. O analista revela o que o mercado ignora — sem hype, com dados.

ESTRUTURA OBRIGATÓRIA — use exatamente esses marcadores no output:
[HOOK] — 00-03s. Fato contraintuitivo ou número que quebra crença. Máx. 20 palavras. Começa com dado, não com pergunta.
[CORPO] — 03-45s. Bullets curtos, máx. 8 palavras por linha. Ritmo estacato. 200-220 palavras no total. 1 mecanismo nomeado explicado com clareza cirúrgica.
[CTA] — 1 única ação. Peça para salvar — justifique com "porque" (05_closing #1).

Técnicas ativas (1 por camada — escolha a mais forte):
- Hook: Especificidade Cirúrgica com número ímpar (03_hooks #3) ou MAYA de Familiaridade (03_hooks #9)
- Corpo: Mecanização da Solução — dê nome tático ao processo (08_persuasion #1)
- Persuasão: Tradução Radical do "E depois?" — característica → benefício primitivo (08_persuasion #8)
- Fechamento: Gatilho da Justificativa Automática — "Salve porque..." (05_closing #1)`
    : `SUB-PROTOCOLO: REELS - VENDER
OBJETIVO: Converter visualização em lead ou compra. Diagnóstico em tempo real — o analista faz o espectador sentir a dor e apresenta a saída óbvia.

ESTRUTURA OBRIGATÓRIA — use exatamente esses marcadores no output:
[HOOK] — 00-03s. Cenário catastrófico → transição → realidade acessível. Máx. 20 palavras.
[CORPO] — 03-45s. Bullets curtos, máx. 8 palavras por linha. Ritmo estacato. 200-220 palavras no total. Agite a dor → apresente mecanismo → quebre 1 objeção.
[CTA] — 1 única ação. "Se você [dor validada], então [próximo passo único]." Direto para oferta.

Técnicas ativas (1 por camada — escolha a mais forte):
- Hook: Ancoragem por Contraste Extremo (03_hooks #1) ou Promessa Imperativa (03_hooks #5)
- Corpo: Injeção de Fracasso — pinte a tragédia futura sem a solução (08_persuasion #5)
- Persuasão: Inimigo Comum Oculto — culpa é do mercado, não do usuário (08_persuasion #3)
- Fechamento: Sintaxe do Compromisso Lógico — "Se... então..." (05_closing #3)`;

  const subProtocol = input.mode === 'content'
    ? contentSubProtocol
    : input.mode === 'sales'
    ? `SUB-PROTOCOLO: CARROSSEL - VENDER
[SLIDE 1] Headline — mecanismo da dor + custo real de ignorar.
[SLIDE 2] Agitação — cena específica do problema no dia a dia.
[SLIDES 3-5] Prova — antes × depois com números reais.
[SLIDE 6] Oferta — o que é, em 3 linhas. Sem adjetivo. Sem hype.
[SLIDE 7] Objeção — 1 objeção real respondida de forma cirúrgica.
[SLIDE 8] CTA — "Se você [dor validada], então [próximo passo único]."

Técnicas ativas (1 por camada):
- Hook: Ancoragem por Contraste Extremo (03_hooks #1)
- Corpo: Enquadramento de Magnitude (04_storytelling)
- Persuasão: Inimigo Comum Oculto (08_persuasion #3)
- Fechamento: Sintaxe do Compromisso Lógico (05_closing #3)`
    : `SUB-PROTOCOLO: MICRO-COPY
Gere 5 variações da copy para o local informado.
Cada variação usa 1 técnica diferente: Contraste, Urgência, Especificidade Numérica, Prova Social, FOMO.
Máximo 1-2 linhas por variação. Zero adjetivos. Zero palavra da Veto List.`;

  const modeContext = input.mode === 'content'
    ? `Objetivo: ${input.scopingAnswers['objetivo'] ?? ''}\nTema/Inimigo: ${input.scopingAnswers['temaInimigo'] ?? ''}\nCTA: ${input.scopingAnswers['cta'] ?? ''}`
    : input.mode === 'sales'
    ? `Produto: ${input.scopingAnswers['produto'] ?? ''}\nMecanismo: ${input.scopingAnswers['mecanismo'] ?? ''}\nMaior Objeção: ${input.scopingAnswers['objecao'] ?? ''}`
    : `Local: ${input.scopingAnswers['local'] ?? ''}\nContexto: ${input.scopingAnswers['contexto'] ?? ''}\nAção: ${input.scopingAnswers['acao'] ?? ''}`;

  const systemPrompt = `<CONSTRAINTS_AND_VETOES>
${brain.constraints}

---

${brain.vetoes}
</CONSTRAINTS_AND_VETOES>

<VOICE_AND_PERSONA>
${brain.tone}

---

${brain.persona}
</VOICE_AND_PERSONA>

<HOOKS>
${brain.hooks}
</HOOKS>

<FORMULAS>
${formulasText}
</FORMULAS>

<SWIPE_FILE_SKELETON>
Referência de ritmo e cadência — NÃO copie o conteúdo. Copie a proporção de blocos e tamanho de frases.
${swipe}
</SWIPE_FILE_SKELETON>

<SUB_PROTOCOL>
${subProtocol}
</SUB_PROTOCOL>

CHECKLIST PRÉ-OUTPUT (aplique silenciosamente antes de entregar):
[ ] Hook tem 20 palavras ou menos?
[ ] Hook começa com fato, reação crua ou número? (NUNCA pergunta)
[ ] [CORPO] está entre 200-220 palavras? Contar antes de entregar.
[ ] 1 técnica por camada — e só ela?
[ ] Alguma frase soa como slide de agência? → reescrever
[ ] Tem palavra da Veto List? → substituir por dado concreto
[ ] CTA pede uma única ação?

FORMATO DE OUTPUT OBRIGATÓRIO:
O roteiro DEVE ser entregue com exatamente estes 3 marcadores de seção, em linhas separadas:

[HOOK]
<texto do hook aqui>

[CORPO]
<texto do corpo aqui>

[CTA]
<texto do CTA aqui>

Sem meta-comentários, sem explicações, sem texto fora das 3 seções.`;

  const userPrompt = `MODO: ${input.mode.toUpperCase()}
${modeContext}

GANCHO ESCOLHIDO (use como abertura literal): ${input.chosenHook}

Escreva a copy completa. Voz do Maverick: analista sênior em ligação de consultoria — direto, cético, zero clichê.`;

  yield* callAnthropicStream(systemPrompt, userPrompt, MODEL_WRITER);
}

