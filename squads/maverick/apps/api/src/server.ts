import express from 'express';
// Trigger restart
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { generateWithFallback } from './utils/ai';
import { FrameworkLoader } from './services/copywriter';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Configuração do CORS
app.use(cors());
app.use(bodyParser.json());

// Rota de Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Maverick API' });
});

// Rota: Gerar Roteiro (@maverick-copywriter — 2-Pass Master Pipeline)
app.post('/api/generate-script', async (req, res) => {
  try {
    const { topic, angle, tone, creatorProfile, awarenessLevel, referencePost } = req.body;
    console.log(`[Maverick Copywriter] Generating script for: "${topic}"`);

    // ── Layer 1: Framework Selection & Config ─────────────────────────────
    const loader = new FrameworkLoader();
    const framework = loader.selectFramework(topic, angle || '');
    const frameworkBlock = framework ? loader.toPromptBlock(framework, creatorProfile, awarenessLevel, referencePost) : null;
    const masterBlock = loader.getMasterPrinciplesBlock();
    const approvedExamples = framework ? loader.loadApprovedExamples(framework.name) : '';
    if (framework) {
      console.log(`[Maverick Copywriter] Selected framework: ${framework.full_name}`);
    }

    // ── Layer 2: Scholar RAG — Book enrichment ─────────────────────────────
    let ragContext = '';
    try {
      const { ScholarAgent } = await import('./services/scholar');
      const scholar = new ScholarAgent();
      const ragQuery = framework
        ? `${framework.name} ${framework.full_name} técnica para: ${topic} ${angle || ''}`
        : `copywriting persuasão gancho para: ${topic}`;
      const chunks = await scholar.searchKnowledge(ragQuery, 3, 'copywriting');
      if (chunks.length > 0) {
        ragContext = chunks.map(c => `[${c.source}]: ${c.text}`).join('\n\n---\n\n');
        console.log(`[Maverick Copywriter] RAG: ${chunks.length} book chunks retrieved.`);
      }
    } catch (ragErr: any) {
      console.warn('[Maverick Copywriter] RAG unavailable:', ragErr.message);
    }

    // ── Layer 3: Pass 1 — Generate First Draft ─────────────────────────────
    console.log(`[Maverick Copywriter] Pass 1: Generating initial draft...`);
    const prompt1 = `Você é o @maverick-copywriter — o maior especialista em copywriting para criadores de conteúdo digital do Brasil.
Sua escrita é específica, visceral, e converte. Você NUNCA escreve genérico.

${masterBlock ? `╔══════════════════════════════════════════════╗
${masterBlock}
╚══════════════════════════════════════════════╝

` : ''}${frameworkBlock ? `═══════════════════════════════════════════════
${frameworkBlock}
═══════════════════════════════════════════════

` : ''}${approvedExamples ? `${approvedExamples}
---
` : ''}${ragContext ? `TEORIA DE APOIO (extraída dos livros da base de conhecimento — use para enriquecer a escrita):
${ragContext}
---
` : ''}TAREFA: Escreva a PRIMEIRA VERSÃO do roteiro completo para Instagram Reels/TikTok.

Tópico: "${topic}"
Ângulo: ${angle || 'Contra-intuitivo e provocativo'}
Tom: ${tone || 'Autoridade direta — sem enrolação, sem linguagem de guru'}
${creatorProfile ? `Perfil do Criador: ${creatorProfile}` : ''}

REGRAS CRÍTICAS:
- Siga EXATAMENTE a estrutura do framework acima, seção por seção
- Aplique os princípios dos mestres
- Seja ESPECÍFICO
- NÃO adicione explicações sobre o roteiro — apenas o roteiro

Escreva a primeira versão agora:`;

    const completion1 = await generateWithFallback([{ role: 'user', content: prompt1 }]);
    const draft = completion1.choices[0]?.message?.content || '';

    if (!draft) throw new Error('Failed to generate initial draft.');

    // ── Layer 4: Pass 2 — Creative Director Critique & Rewrite ─────────────
    console.log(`[Maverick Copywriter] Pass 2: Creative Director rewriting...`);
    const prompt2 = `Você é o Diretor de Criação Sênior da maior agência de resposta direta do mundo.
Seu trabalho é pegar o primeiro rascunho de um roteiro e torná-lo 10x mais magnético, coloquial e invisivelmente persuasivo, garantindo que ele mimetize o tom real de um humano.

RASCUNHO INICIAL:
${draft}

${referencePost ? `
REFERÊNCIA DE VOZ EXIGIDA (O RASCUNHO TEM QUE SOAR ASSIM):
${referencePost}
` : ''}

CRITÉRIOS DE AVALIAÇÃO E REESCRITA (APLIQUE AGORA):
1. O gancho (primeira frase) é impossível de ignorar? Se for fraco ou clichê, corte e comece com um soco no estômago.
2. A linguagem soa como um "guru" ou IA? Troque palavras difíceis/poéticas pela forma crua como as pessoas falam no WhatsApp. Reduza adjetivos.
3. As transições são invisíveis? O roteiro tem que fluir como uma conversa de bar com um amigo muito foda, não como uma palestra.
4. O final pede uma ação clara? Se a promessa de CTA for genérica, force clareza cirúrgica ("comenta X", "clica no link da bio", etc).
${framework ? `\nLembre-se: preserve a estrutura de etapas do framework '${framework.name}'.\n` : ''}

Sua resposta NÃO DEVE conter críticas ou metadados de diretor de criação.
Sua resposta DEVE SER EXATAMENTE E SOMENTE O ROTEIRO REESCRITO FINAL, pronto para o ator gravar.

Escreva o roteiro polido agora:`;

    const completion2 = await generateWithFallback([{ role: 'user', content: prompt2 }]);
    const finalScript = completion2.choices[0]?.message?.content || draft;

    res.json({
      success: true,
      script: finalScript,
      meta: {
        framework: framework?.full_name || 'base',
        frameworkId: framework?.name || '',
        ragChunks: ragContext ? 3 : 0,
        masterPrinciples: masterBlock ? true : false,
        approvedExamplesUsed: approvedExamples ? true : false,
        twoPassPipeline: true,
        awarenessLevel: awarenessLevel || 3,
        voiceCalibrated: !!referencePost
      }
    });

  } catch (error: any) {
    console.error('Error generating script:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rota: Gerar roteiros e conteúdos estendidos (Carrossel, Post, Roteiro curto, Roteiro longo)
app.post('/api/generate-content', async (req, res) => {
  try {
    const { type, pillar, analysisContext, awarenessLevel, referencePost, topic, angle } = req.body;
    console.log(`[Maverick Copywriter] Generating ${type} for pillar: "${pillar}"`);

    // ── Layer 1: Context & RAG Enrichment ─────────────────────────────
    let ragContext = '';
    try {
      const { ScholarAgent } = await import('./services/scholar');
      const scholar = new ScholarAgent();

      const searchTerms = type === 'carousel_slides'
        ? 'carrossel instigante, retenção de slides, conteúdo denso'
        : type === 'caption'
          ? 'legenda engajadora, storytelling curto, CTA'
          : type === 'stories_sequence'
            ? 'sequência de stories, engajamento, vulnerabilidade, venda'
            : 'copywriting persuasão gancho retenção';

      const ragQuery = `${searchTerms} ${pillar || topic || ''} ${angle || ''}`;
      const chunks = await scholar.searchKnowledge(ragQuery, 3, 'copywriting');
      if (chunks.length > 0) {
        ragContext = chunks.map(c => `[${c.source}]: ${c.text}`).join('\n\n---\n\n');
      }
    } catch (ragErr: any) {
      console.warn('[Maverick Copywriter] RAG unavailable:', ragErr.message);
    }

    const loader = new FrameworkLoader();
    const masterBlock = loader.getMasterPrinciplesBlock();

    // ── Layer 2: Formatting instructions based on type ──────────────────
    let structuralInstructions = '';
    if (type === 'reel_script') {
      structuralInstructions = `Crie um roteiro de vídeo curto (Reels/TikTok) com: 1) GANCHO (0-3s), 2) RETENÇÃO (corpo ágil), e 3) CTA (chamada para ação clara).`;
    } else if (type === 'carousel_slides') {
      structuralInstructions = `Crie um Carrossel para o Instagram (3 a 7 slides). Estruture EXATAMENTE assim:
Slide 1 (Capa): Título impossível de ignorar.
Slide 2 (Contexto): Quebra de expectativa ou dor.
Slides do meio: O "miolo" do valor, passo a passo ou lições.
Último Slide: Chamada para ação clara.`;
    } else if (type === 'caption') {
      structuralInstructions = `Crie uma legenda longa (Long-form post) para Instagram ou LinkedIn. Use parágrafos curtos, um gancho textual forte na primeira linha, e quebras de linha limpas. Termine com uma pergunta ou CTA.`;
    } else if (type === 'stories_sequence') {
      structuralInstructions = `Crie uma sequência de Stories (3 a 6 telas). Indique o que vai escrito na tela e/ou o que o criador deve falar/mostrar.
Story 1: Abertura / Enquete inicial.
Stories do meio: Desenvolvimento rápido e vulnerável.
Último Story: Link / Venda / Ação.`;
    } else {
      structuralInstructions = `Crie uma peça persuasiva curta.`;
    }

    let awarenessBlock = '';
    if (awarenessLevel !== undefined) {
      const levels = [
        "1: Inconsciente — foque no sintoma invisível.",
        "2: Consciente do Problema — nomeie a dor e agite-a com empatia visceral.",
        "3: Consciente da Solução — foque no mecanismo transformador novo.",
        "4: Consciente do Produto — diferencie-se dos concorrentes.",
        "5: Totalmente Consciente — vá direto para a oferta irresistível."
      ];
      awarenessBlock = `Nível de Consciência: ${levels[Math.max(0, Math.min(4, awarenessLevel - 1))]}`;
    }

    const voiceBlock = referencePost
      ? `\nCALIBRAÇÃO DE VOZ (Referência do Criador - MIMETIZE ESSE TOM):\n${referencePost}\n`
      : '';

    // ── Layer 3: Generation ─────────────────────────────────────────────
    const prompt = `Você é o @maverick-copywriter — o maior especialista em copywriting estratégico.
Sua escrita é específica, visceral, e converte. Zero papinho de IA, zero jargões genéricos.

CONFRONTE ESTES DADOS (OFERTA & CONTEXTO DA ANÁLISE):
${JSON.stringify(analysisContext?.brief_estrategico || analysisContext?.resumo_executivo || 'Sem análise, crie com base na pauta.', null, 2)}

PAUTA / PILAR: "${pillar || topic}"
FORMATO EXIGIDO: ${type.toUpperCase().replace('_', ' ')}

${structuralInstructions}

${masterBlock ? `\n\nPRINCÍPIOS:\n${masterBlock}` : ''}
${ragContext ? `\n\nTEORIA (Enriqueça o texto baseando-se nisto):\n${ragContext}` : ''}
${awarenessBlock}
${voiceBlock}

TAREFA FINAL: Entrega o texto/roteiro pronto para uso. Não coloque saudações de IA (ex: "Aqui está o roteiro"). Vá direto para o conteúdo.
`;

    const completion = await generateWithFallback([{ role: 'user', content: prompt }]);
    const finalContent = completion.choices[0]?.message?.content || '';

    if (!finalContent) throw new Error('Falha ao gerar conteúdo.');

    res.json({
      success: true,
      content: finalContent,
      meta: {
        type,
        ragChunks: ragContext ? 3 : 0,
        voiceCalibrated: !!referencePost
      }
    });

  } catch (error: any) {
    console.error('Error generating content:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rota: Salvar script aprovado (feedback loop 👍)
app.post('/api/script-feedback', (req, res) => {
  try {
    const { topic, frameworkId, script, approved } = req.body;
    if (!approved) {
      return res.json({ success: true, message: 'Feedback negativo registrado.' });
    }
    const loader = new FrameworkLoader();
    loader.saveApprovedScript(topic, frameworkId, script);
    res.json({ success: true, message: 'Roteiro salvo como exemplo aprovado! Será usado nas próximas gerações.' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});


import { ScoutAgent } from './services/scout';
import { StrategistAgent } from './services/strategist';
import { ScholarAgent } from './services/scholar';
import { StorageService } from './services/storage';

const storage = new StorageService();

// Rota: Listar Histórico de Análises
app.get('/api/history', (req, res) => {
  try {
    const snapshots = storage.listSnapshots();
    res.json({ success: true, snapshots });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rota: Obter um Snapshot específico
app.get('/api/history/:id', (req, res) => {
  try {
    const snapshot = storage.getSnapshot(req.params.id);
    if (!snapshot) return res.status(404).json({ success: false, error: 'Snapshot not found' });
    res.json({ success: true, snapshot });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rota: Deletar um Snapshot
app.delete('/api/history/:id', (req, res) => {
  try {
    const deleted = storage.deleteSnapshot(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, error: 'Snapshot not found' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// Rota: Busca Semântica (Simula @maverick-scholar RAG)
app.post('/api/search-knowledge', async (req, res) => {
  try {
    const { query, limit } = req.body;
    if (!query) return res.status(400).json({ error: "Missing query parameter." });

    console.log(`[Maverick API] Searching knowledge base for: "${query}"`);
    const scholar = new ScholarAgent();
    const results = await scholar.searchKnowledge(query, limit || 3);

    res.json({ success: true, results });
  } catch (error: any) {
    console.error('[Maverick API] Error searching knowledge:', error);
    res.status(500).json({ success: false, error: "Falha ao buscar no banco de conhecimento." });
  }
});

// Rota: Gerar Estratégias (Simula @maverick-strategist)
app.post('/api/generate-strategy', async (req, res) => {
  try {
    const { profileData } = req.body;
    console.log(`[Maverick API] Starting Strategist generation for profile data.`);

    const strategist = new StrategistAgent();
    // Em uma implementação real, o Strategist cruzaria isso com os dados do Scholar (RAG)
    const actionPlan = await strategist.generateActionPlan(profileData);

    res.json({ success: true, strategies: actionPlan });
  } catch (error: any) {
    console.error("Error generating strategy:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rota: Chat livre com o Agente
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, context } = req.body;

    // Injeta o contexto da análise no system prompt
    const systemPrompt = `
      Você é o @maverick, o agente inteligente da plataforma Maverick AIOS.
      O usuário acabou de fazer uma análise de perfil social.
      
      CONTEXTO DA ANÁLISE ATUAL:
      ${JSON.stringify(context, null, 2)}
      
      Sua missão é responder às dúvidas do usuário sobre essa análise de forma consultiva,
      direta e disruptiva. Foque em crescimento, autoridade e conversão.
      Seja conciso.
    `;

    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: any) => ({ role: m.role, content: m.text }))
    ];

    const completion = await generateWithFallback(apiMessages);

    res.json({ success: true, response: completion.choices[0]?.message?.content });
  } catch (error: any) {
    console.error("Error in chat:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rota: Analisar Perfil (Real com Puppeteer + IA)
app.post('/api/analyze-profile', async (req, res) => {
  try {
    const { handle } = req.body;
    console.log(`[Maverick API] Starting Scout for: @${handle}`);

    // 1. Coleta de Dados Reais (Puppeteer)
    const scout = new ScoutAgent();
    let scrapedData = null;
    let scrapeError = null;

    try {
      scrapedData = await scout.analyzeProfile(handle);
      console.log(`[Maverick API] Scraped data success for @${handle}`);
    } catch (e: any) {
      console.warn(`[Maverick API] Scraping failed, falling back to AI simulation: ${e.message}`);
      scrapeError = e.message;
    }

    // 2. Scholar RAG: Busca chunks relevantes de múltiplos ângulos
    console.log(`[Maverick API] Querying Scholar for book knowledge...`);
    const scholar = new ScholarAgent();
    const [chunksIdentidade, chunksConteudo, chunksDistribuicao] = await Promise.allSettled([
      scholar.searchKnowledge('identidade visual, padrão estético, coerência de marca e reconhecimento cerebral', 3),
      scholar.searchKnowledge('conteúdo viral, moeda social, gatilhos de compartilhamento, copywriting persuasivo', 3),
      scholar.searchKnowledge('distribuição de conteúdo, crescimento de audiência, content tilt, posicionamento único', 3),
    ]);

    const bookContext = [
      ...(chunksIdentidade.status === 'fulfilled' ? chunksIdentidade.value : []),
      ...(chunksConteudo.status === 'fulfilled' ? chunksConteudo.value : []),
      ...(chunksDistribuicao.status === 'fulfilled' ? chunksDistribuicao.value : []),
    ].map(c => `[${c.source}]: ${c.text}`).join('\n\n---\n\n');

    console.log(`[Maverick API] Scholar retrieved ${bookContext.split('---').length} book passages.`);

    // 3. Prompt de Análise Profunda (nível especialista)
    const profileRaw = scrapedData
      ? JSON.stringify(scrapedData, null, 2)
      : `Perfil @${handle} — dados reais indisponíveis${scrapeError ? ` (${scrapeError})` : ''}. Simule uma análise plausível para um perfil deste nicho.`;

    const prompt = `Você é o @maverick-scout — o mais cirúrgico especialista em diagnóstico de marcas pessoais digitais do mundo.
Você leu profundamente e internalizou os seguintes livros de marketing, psicologia e crescimento:
- Contágio (Jonah Berger) — Framework STEPPS, Moeda Social, Gatilhos
- Hit Makers (Derek Thompson) — Efeito MAYA, Mera Exposição, Fluência vs. Disfluência
- Neuromarketing (Bridger) — Neuroestética, Complexidade de Kolmogorov
- Content Inc. (Joe Pulizzi) — Sweet Spot, Content Tilt, Monetização de Audiência
- A Única Coisa (Gary Keller) — Foco 80/20, Hábito 66 dias
- O Lado Difícil das Situações Difíceis (Ben Horowitz) — Storytelling de Vulnerabilidade
- Negocie Como Se... (Chris Voss) — Empatia Tática, Perguntas Calibradas
- A lógica do Cisne Negro (Nassim Taleb) — Extremistão, Estratégia Barbell
- O Animal Social (Elliot Aronson) — Prova Social, Relações Parasociais
- Neurovendas (Simon Hazeldine) — Sistema 1 e 2, Decisões Inconscientes
- Marketing 6.0 (Kotler) — Metamarketing, Phygital, Gen Z

DADOS BRUTOS DO PERFIL @${handle}:
${profileRaw}

EXTRATOS RELEVANTES DA BASE DE CONHECIMENTO (cite os livros pelo nome):
${bookContext || 'Base de conhecimento em carregamento. Use seu conhecimento interno dos livros listados.'}

---
TAREFA: Produza um BLUEPRINT ESTRATÉGICO completo de nível agência especializada. 
Este documento vai direto para o criador de conteúdo e serve como seu guia dos próximos 30 dias.
Seja EXTREMAMENTE ESPECÍFICO. Cite posts reais, números, patterns de legenda quando tiver dados.
Cite os LIVROS PELO NOME ao aplicar conceitos.

Retorne EXATAMENTE este JSON (sem markdown, sem texto fora do JSON):
{
  "resumo_executivo": "2-3 frases de diagnóstico direto e honesto do estado atual do perfil. Seja cirúrgico.",
  "metricas": {
    "posts": "número ou N/A",
    "seguidores": "número formatado (ex: 12.5k) ou N/A",
    "seguindo": "número ou N/A",
    "bio_atual": "texto da bio ou N/A",
    "taxa_engajamento_estimada": "percentual estimado com base em likes+comentários/seguidores ou N/A",
    "foto_perfil": "URL da foto de perfil ou null"
  },
  "analise_conteudo": {
    "top_posts": [
      {
        "rank": 1,
        "tipo": "Video | Carousel | Image",
        "caption_preview": "primeiros 100 chars da legenda do post",
        "likes": 0,
        "comments": 0,
        "views": 0,
        "taxa_engajamento": "X.X%",
        "por_que_funcionou": "Análise do gatilho: qual dos 6 elementos STEPPS ou qual princípio de Hit Makers/Neuromarketing fez este post performar acima da média do perfil. Seja específico."
      }
    ],
    "padroes_detectados": "Quais formatos, estilos de abertura, comprimento de legenda ou temas dominam os posts de melhor performance. Seja específico com os dados.",
    "tom_de_voz_atual": "3-4 adjetivos que descrevem com precisão o tom atual do criador",
    "frequencia_media": "X posts/semana estimado",
    "gap_de_conteudo": "O que o público claramente quer (baseado nos posts que mais engajam) mas o criador ainda não está entregando de forma sistemática"
  },
  "o_que_funciona": [
    {
      "titulo": "Nome curto do ponto forte",
      "descricao": "Explicação detalhada do que está funcionando e POR QUÊ funciona. Cite o conceito de marketing/psicologia envolvido e o livro."
    }
  ],
  "o_que_precisa_mudar": [
    {
      "numero": 1,
      "titulo": "Nome do problema",
      "diagnostico": "Diagnóstico detalhado e específico do problema observado no perfil.",
      "embasamento": "Cite o livro/autor e o conceito exato que explica por que isso é um erro e por que a correção funciona.",
      "acao_corretiva": "O que exatamente fazer para corrigir ESTA SEMANA",
      "livro_referencia": "Nome do Livro (Autor)"
    }
  ],
  "brief_estrategico": {
    "posicionamento_ideal": "Uma frase cristalina: [QUEM VOCÊ É] + [PARA QUEM] + [QUAL RESULTADO ÚNICO]",
    "content_tilt": "O ângulo único que só você pode trazer. Conceito de Content Inc. (Pulizzi). Ex: 'Marketing decodificado pela neurociência do comportamento humano'",
    "pilares_conteudo": [
      {
        "nome": "Nome do pilar",
        "percentual": "40%",
        "objetivo": "o que este pilar constrói (autoridade, conexão, conversão)",
        "formatos": ["Reel", "Carousel"],
        "gatilho_emocional": "Admiração | Identificação | Respeito",
        "metrica_principal": "Saves | Comentários | Compartilhamentos"
      }
    ],
    "calendario_4_semanas": [
      {
        "semana": 1,
        "tema_foco": "tema da semana",
        "pautas": [
          { "dia": "Segunda", "formato": "Reel 30s", "pauta": "tema específico do post com gancho sugerido" },
          { "dia": "Quarta", "formato": "Carousel", "pauta": "tema específico do post com gancho sugerido" },
          { "dia": "Sexta", "formato": "Reel 60s", "pauta": "tema específico do post com gancho sugerido" }
        ]
      }
    ]
  },
  "escada_monetizacao": {
    "nivel_atual": "Atenção | Confiança | Autoridade | Escala | Impacto",
    "seguidores_referencia": "faixa de seguidores do nível atual",
    "proximos_passos_monetizacao": "O que fazer para subir ao próximo nível: que produto, que preço, que formato",
    "prazo_estimado": "estimativa realista de tempo para atingir próximo nível com execução consistente"
  },
  "acoes_urgentes": [
    {
      "prioridade": 1,
      "acao": "Descrição clara e acionável do que fazer ESTA SEMANA",
      "impacto_esperado": "Qual resultado concreto isso deve gerar",
      "tempo_necessario": "X horas ou X minutos"
    }
  ],
  "pontos_melhoria": ["string array item 1", "string array item 2", "string array item 3"],
  "pontos_fortes": ["string array item 1", "string array item 2", "string array item 3"]
}

Regras críticas:
- Retorne um JSON estrito, perfeitamente formatado.
- Arrays como 'pontos_melhoria' e 'pontos_fortes' OBRIGATORIAMENTE devem conter apenas strings simples, nunca objetos. Ex: ["item 1", "item 2"].
- Mínimo 3 top_posts em analise_conteudo (use os dados do Apify se disponíveis, estima se não)
- Mínimo 3 pilares em brief_estrategico.pilares_conteudo
- Calendario com 4 semanas completas
- Mínimo de 4 itens em o_que_precisa_mudar e 3 em o_que_funciona
- Mínimo de 5 acoes_urgentes com tempo estimado
- NUNCA deixe campos genéricos — adapte tudo ao perfil específico
- Responda APENAS o JSON`;

    let analysisData = {};
    let content = "";
    try {
      const completion = await generateWithFallback(
        [{ role: "user", content: prompt }],
        { response_format: { type: "json_object" } }
      );
      content = completion.choices[0]?.message?.content || "{}";

      // Remove markdown formatting if the model leaked it despite instructions
      if (content.startsWith("\`\`\`json")) {
        content = content.replace(/^\`\`\`json/g, "").replace(/\`\`\`$/g, "");
      }

      analysisData = JSON.parse(content);
    } catch (parseErr: any) {
      console.error("[Maverick API] Fatal JSON Parse Error:", parseErr.message);
      console.error("[Maverick API] Raw Content was:", content);
      return res.status(500).json({ success: false, error: "A inteligência artificial retornou um formato inválido. Tente gerar novamente.", raw_output: content });
    }
    const source = scrapedData ? "real_scraping" : "ai_simulation";

    // Auto-save the snapshot for History
    let snapshotId: string | null = null;
    try {
      const snapshot = storage.saveSnapshot(handle, analysisData, [], source);
      snapshotId = snapshot.id;
    } catch (saveErr: any) {
      console.warn('[Maverick Storage] Failed to save snapshot:', saveErr.message);
    }

    res.json({
      success: true,
      analysis: analysisData,
      source,
      snapshotId
    });

  } catch (error: any) {
    console.error("Error analyzing profile:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Maverick API server running at http://localhost:${port}`);
});

