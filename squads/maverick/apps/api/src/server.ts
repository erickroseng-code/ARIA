import express from 'express';
// Trigger restart
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { generateWithFallback, extractJSON } from './utils/ai';
import { FrameworkLoader } from './services/copywriter';
import { BriefGenerator, matchPattern, AnalysisData, HookPattern } from './services/brief-generator';
import { validate as viralValidate } from './services/brief-generator/viral-validator';

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

// Rota: Gerar Roteiro (@maverick-copywriter — 3-Layer Master Pipeline)
app.post('/api/generate-script', async (req, res) => {
  try {
    const { topic, angle, tone, creatorProfile, awarenessLevel, referencePost, trendInsights, analysisContext } = req.body;
    console.log(`[Maverick Copywriter] Generating script for: "${topic}"`);

    // ── Layer 1: Framework + Knowledge Assets ─────────────────────────────
    const loader = new FrameworkLoader();
    const framework = loader.selectFramework(topic, angle || '');
    const frameworkBlock = framework ? loader.toPromptBlock(framework, creatorProfile, awarenessLevel, referencePost) : null;
    const masterBlock = loader.getMasterPrinciplesBlock();
    const copyDirectives = loader.loadCopyDirectives();
    const goldenScripts = loader.loadGoldenScripts(framework?.name);
    const approvedExamples = framework ? loader.loadApprovedExamples(framework.name) : '';
    const brainPrinciples = loader.loadBrainPrinciples();

    if (framework) {
      console.log(`[Maverick Copywriter] Framework: ${framework.full_name} | Directives: ${copyDirectives ? 'OK' : 'missing'} | Golden: ${goldenScripts ? 'OK' : 'empty'} | Brain: ${brainPrinciples ? 'OK' : 'empty'}`);
    }

    // ── Layer 2: Trend Insights (passados pelo frontend ou buscados via Scholar) ──
    let trendBlock = '';
    if (trendInsights && Array.isArray(trendInsights) && trendInsights.length > 0) {
      // Frontend passed trend data from Scout/Strategist phase
      trendBlock = `CONTEÚDO VIRAL DE REFERÊNCIA DO NICHO (pesquisa real — use como calibração de qualidade do gancho):
${trendInsights.slice(0, 3).map((ins: any, i: number) =>
  `Ref ${i + 1}: "${ins.example_hook || ins.hook}" → Padrão: ${ins.hook_pattern || ins.pattern} | Sinal: ${ins.engagement_signal || ins.signal}`
).join('\n')}

INSTRUÇÃO: Não copie esses ganchos. Adapte o PADRÃO deles ao tema específico do roteiro.`;
      console.log(`[Maverick Copywriter] Trend insights: ${trendInsights.length} viral refs injected.`);
    }

    // ── Stage 0: Signal Synthesis — Brief Generator ───────────────────────
    let briefText = '';
    let selectedPattern: HookPattern | null = null;
    let viralScore = 0;
    let validationIssues: string[] = [];

    try {
      const analysisData: AnalysisData | undefined = analysisContext
        ? {
            pilares_conteudo: analysisContext.pilares_conteudo,
            pontos_melhoria: analysisContext.pontos_melhoria,
            content_tilt: analysisContext.content_tilt,
            top_posts: analysisContext.top_posts,
          }
        : undefined;

      selectedPattern = matchPattern(topic, analysisData);
      console.log(`[BriefGenerator] Pattern selected: ${selectedPattern.name}`);

      const generator = new BriefGenerator();
      briefText = await generator.generate({
        topic,
        angle,
        tone,
        pattern: selectedPattern,
        analysisData,
      });
      console.log(`[BriefGenerator] Brief gerado: ${briefText.split(' ').length} palavras`);
    } catch (e: any) {
      console.warn('[BriefGenerator] Falhou, continuando sem brief:', e.message);
    }

    // ── Layer 3: Pass 1 — Structure Draft (framework-first) ───────────────
    console.log(`[Maverick Copywriter] Pass 1: Building structured draft...`);

    // Pick the single best golden example for this framework to anchor Pass 1
    const bestExample = goldenScripts
      ? goldenScripts.split('━━━')[1]?.trim() || ''
      : '';

    const frameworkStages = framework
      ? Object.values(framework.structure)
          .map((s: any, i: number) => `${i + 1}. ${s.label.toUpperCase()}${s.duration ? ` (${s.duration})` : ''}: ${s.instruction}`)
          .join('\n')
      : '';

    const prompt1 = `Você é um roteirista especialista em conteúdo viral para Instagram Reels e TikTok.

TAREFA: Escreva um roteiro estruturado para o tema abaixo, seguindo EXATAMENTE o framework indicado.

TEMA: "${topic}"
ÂNGULO: ${angle || 'Contra-intuitivo e provocativo'}
TOM: ${tone || 'Direto, coloquial, sem linguagem de guru'}
${creatorProfile ? `CONTEXTO DO CRIADOR: ${creatorProfile}\n` : ''}${briefText ? `\nBRIEF CRIATIVO (síntese do público e padrão de gancho — USE COMO BASE):\n${briefText}\n` : trendBlock ? `\n${trendBlock}\n` : ''}
${frameworkStages ? `ESTRUTURA OBRIGATÓRIA (siga cada etapa em ordem):
${frameworkStages}
` : ''}${bestExample ? `REFERÊNCIA DE QUALIDADE (estude o padrão: especificidade, gancho, ritmo):
${bestExample}
` : ''}${approvedExamples ? `\nEXEMPLOS APROVADOS PELO CRIADOR:
${approvedExamples}\n` : ''}
FORMATO DE SAÍDA — use exatamente esses rótulos:

[GANCHO]
(primeiros 3 segundos — frase que para o scroll)

[DESENVOLVIMENTO]
(corpo do roteiro seguindo a estrutura do framework)

[CTA]
(chamada para ação única e específica)

REGRAS:
- Mínimo 220 palavras, máximo 400
- Sem clichês, sem linguagem de coach/guru
- Hiper-específico: use números, nomes, situações reais
- Escreva APENAS o roteiro — sem explicações ou comentários

Escreva agora:`;

    const completion1 = await generateWithFallback([{ role: 'user', content: prompt1 }]);
    const draft = completion1.choices[0]?.message?.content || '';

    if (!draft) throw new Error('Failed to generate initial draft.');

    // ── Layer 4: Pass 2 — Quality Polish (directives + masters) ────────────
    console.log(`[Maverick Copywriter] Pass 2: Applying quality polish...`);
    const prompt2 = `Você é o Diretor de Criação de uma agência de copywriting de resposta direta.
Receba o rascunho abaixo e aplique os princípios dos mestres para torná-lo irresistível.

RASCUNHO:
${draft}

${copyDirectives ? `PRINCÍPIOS DOS MESTRES (aplique cada um):\n${copyDirectives}\n` : ''}${masterBlock ? `${masterBlock}\n` : ''}${referencePost ? `VOZ DE REFERÊNCIA (faça o roteiro soar EXATAMENTE assim):\n${referencePost}\n` : ''}${goldenScripts ? `TAMANHO E QUALIDADE DE REFERÊNCIA (estes roteiros virais reais definem o padrão — entre 220 e 320 palavras, estrutura GANCHO/DESENVOLVIMENTO/CTA):\n${goldenScripts}\n` : ''}
PRINCÍPIOS POR SEÇÃO (aplique cada princípio na seção correta):

[GANCHO] — primeiros 3 segundos, para o scroll:
${brainPrinciples.hook}

[DESENVOLVIMENTO] — corpo do roteiro, narrativa e persuasão:
${brainPrinciples.body}

[CTA] — fechamento e conversão:
${brainPrinciples.cta}

REESCREVA aplicando obrigatoriamente:
1. GANCHO: máximo 15 palavras, aplique os princípios de hook acima
2. DESENVOLVIMENTO: mínimo 215 palavras, desenvolva bem o argumento — não encurte, expanda os exemplos
3. CTA: 1 ação única com palavra-gatilho, aplique os princípios de closing acima
4. ESPECIFICIDADE: substitua qualquer generalidade por número/nome/situação real
5. TOM HUMANO: linguagem de WhatsApp, frases curtas, sem adjetivos vazios
${framework ? `\nMantenha as seções [GANCHO] / [DESENVOLVIMENTO] / [CTA] do framework ${framework.name}.\n` : ''}
Responda APENAS com o roteiro final polido. Sem metadados, sem comentários.

Escreva o roteiro final agora:`;

    const completion2 = await generateWithFallback([{ role: 'user', content: prompt2 }]);
    let finalScript = completion2.choices[0]?.message?.content || draft;

    // ── Stage 2.5: Gancho Guard — corrige gancho ANTES da validação ──────
    const ganchoMatchRaw = finalScript.match(/\[GANCHO\]([\s\S]*?)\[DESENVOLVIMENTO\]/);
    if (ganchoMatchRaw) {
      const ganchoTextRaw = ganchoMatchRaw[1].trim();
      const ganchoWordCountRaw = ganchoTextRaw.split(/\s+/).filter(Boolean).length;
      if (ganchoWordCountRaw > 15) {
        console.log(`[GanchoGuard] Gancho longo (${ganchoWordCountRaw}) — reescrevendo...`);
        const ganchoFixPrompt = `Tarefa: escrever 1 (UMA) frase de gancho para Instagram Reels com NO MÁXIMO 15 palavras.

TEMA: ${topic}
GANCHO ATUAL (${ganchoWordCountRaw} palavras — MUITO LONGO): ${ganchoTextRaw}

ESCREVA UMA FRASE COM MÁXIMO 15 PALAVRAS:
(Use afirmação com número. Exemplo: "90% dos empreendedores cometem este erro no primeiro ano.")
Responda APENAS com a frase — sem rótulo, sem explicação:`;

        let newGancho = '';
        try {
          const ganchoFix = await generateWithFallback([{ role: 'user', content: ganchoFixPrompt }]);
          newGancho = (ganchoFix.choices[0]?.message?.content || '').trim()
            .replace(/^\[GANCHO\]\s*/i, '').replace(/^["']|["']$/g, '').trim();
        } catch { /* non-fatal */ }

        // Fallback determinístico: truncar primeiros 13 tokens se LLM retornou longo
        if (!newGancho || newGancho.split(/\s+/).filter(Boolean).length > 15) {
          const firstSentence = ganchoTextRaw.split(/[.!?]/)[0].trim();
          const truncWords = firstSentence.split(/\s+/).filter(Boolean);
          newGancho = truncWords.slice(0, 13).join(' ') + '.';
          console.log(`[GanchoGuard] Fallback truncamento: "${newGancho}"`);
        }

        finalScript = finalScript.replace(ganchoMatchRaw[0], `[GANCHO]\n${newGancho}\n\n[DESENVOLVIMENTO]`);
        console.log(`[GanchoGuard] Corrigido: "${newGancho}" (${newGancho.split(/\s+/).filter(Boolean).length} palavras)`);
      }
    }

    // ── Stage 3: Viral Validator ──────────────────────────────────────────
    const validation = viralValidate(finalScript);
    viralScore = validation.score;
    validationIssues = validation.issues;
    console.log(`[ViralValidator] Score: ${validation.score}/5 — issues: ${validation.issues.join(' | ') || 'nenhum'}`);

    const hasWordCountIssue = validation.issues.some(i => i.includes('curto demais'));
    if (!validation.passed && (validation.score < 4 || hasWordCountIssue)) {
      console.log('[ViralValidator] Expandindo DESENVOLVIMENTO...');
      const fixPrompt = `O roteiro abaixo está curto. Expanda o DESENVOLVIMENTO sem alterar o tema.

ROTEIRO ATUAL:
${finalScript}

PROBLEMAS:
${validation.issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

REGRAS:
- Mantenha exatamente as seções [GANCHO] / [DESENVOLVIMENTO] / [CTA]
- Mantenha o GANCHO exatamente como está
- DESENVOLVIMENTO: expanda com mais exemplos e detalhes — mínimo 200 palavras só nesta seção
- Total do roteiro: mínimo 220 palavras
- Sem palavras: transformação, jornada, incrível, poderoso, revolucionário, guru

Escreva o roteiro expandido agora:`;

      try {
        const completion3 = await generateWithFallback([{ role: 'user', content: fixPrompt }]);
        const corrected = completion3.choices[0]?.message?.content || finalScript;
        const correctedWords = corrected.trim().split(/\s+/).length;
        const originalWords = finalScript.trim().split(/\s+/).length;
        if (correctedWords > originalWords) {
          const reValidation = viralValidate(corrected);
          console.log(`[ViralValidator] Após expansão — Score: ${reValidation.score}/5 | ${correctedWords} palavras`);
          finalScript = corrected;
          viralScore = reValidation.score;
          validationIssues = reValidation.issues;
        }
      } catch { /* non-fatal */ }
    }

    // Garantia final: se gancho ficou longo após Pass 3, trunca deterministicamente
    const ganchoFinalMatch = finalScript.match(/\[GANCHO\]([\s\S]*?)\[DESENVOLVIMENTO\]/);
    if (ganchoFinalMatch) {
      const ganchoFinalText = ganchoFinalMatch[1].trim();
      const ganchoFinalWords = ganchoFinalText.split(/\s+/).filter(Boolean).length;
      if (ganchoFinalWords > 15) {
        const truncWords = ganchoFinalText.split(/[.!?]/)[0].trim().split(/\s+/).filter(Boolean);
        const truncated = truncWords.slice(0, 13).join(' ') + '.';
        finalScript = finalScript.replace(ganchoFinalMatch[0], `[GANCHO]\n${truncated}\n\n[DESENVOLVIMENTO]`);
        console.log(`[GanchoGuard Final] Truncado para ${truncated.split(/\s+/).length} palavras`);
        const finalVal = viralValidate(finalScript);
        viralScore = finalVal.score;
        validationIssues = finalVal.issues;
      }
    }

    res.json({
      success: true,
      script: finalScript,
      meta: {
        framework: framework?.full_name || 'base',
        frameworkId: framework?.name || '',
        copyDirectivesLoaded: !!copyDirectives,
        brainPrinciplesLoaded: !!brainPrinciples,
        goldenScriptsLoaded: !!goldenScripts,
        trendInsightsUsed: !!trendBlock,
        approvedExamplesUsed: !!approvedExamples,
        twoPassPipeline: true,
        awarenessLevel: awarenessLevel || 3,
        voiceCalibrated: !!referencePost,
        briefGenerated: !!briefText,
        hookPattern: selectedPattern?.name || '',
        viralScore,
        validationIssues,
        pipelineVersion: 'v3.5-ganchoguard',
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
    const { type, pillar, analysisContext, awarenessLevel, referencePost, topic, angle, trendInsights } = req.body;
    console.log(`[Maverick Copywriter] Generating ${type} for pillar: "${pillar}"`);

    // ── Layer 1: Knowledge Assets ─────────────────────────────────────
    const loader = new FrameworkLoader();
    const masterBlock = loader.getMasterPrinciplesBlock();
    const copyDirectives = loader.loadCopyDirectives();
    const brainPrinciples = loader.loadBrainPrinciples();

    // Golden scripts: for reel_script use general examples, for others use framework-matched
    const frameworkForType = type === 'reel_script' ? 'PAS'
      : type === 'carousel_slides' ? 'VENDAS'
      : undefined;
    const goldenScripts = loader.loadGoldenScripts(frameworkForType);

    // ── Layer 2: Trend Insights ───────────────────────────────────────
    let trendBlock = '';
    if (trendInsights && Array.isArray(trendInsights) && trendInsights.length > 0) {
      trendBlock = `PALAVRAS-CHAVE DO NICHO (extraídas da análise do perfil):\n${trendInsights.map((t: any) => `- ${t.example_hook || t}`).join('\n')}\n\nAdapte o conteúdo para resonar com esse nicho específico.`;
    }

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

    // ── Layer 4: Generation ─────────────────────────────────────────────
    const prompt = `Você é o @maverick-copywriter — o maior especialista em copywriting estratégico.
Sua escrita é específica, visceral, e converte. Zero papinho de IA, zero jargões genéricos.

${masterBlock ? `PRINCÍPIOS DOS MESTRES:\n${masterBlock}\n` : ''}${copyDirectives ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DIRETIVAS DE COPYWRITING (aplique todas):
${copyDirectives}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}${goldenScripts ? `${goldenScripts}\n` : ''}PRINCÍPIOS POR SEÇÃO:
[GANCHO]: ${brainPrinciples.hook ? brainPrinciples.hook.slice(0, 800) + '...' : ''}
[DESENVOLVIMENTO]: ${brainPrinciples.body ? brainPrinciples.body.slice(0, 1200) + '...' : ''}
[CTA]: ${brainPrinciples.cta ? brainPrinciples.cta.slice(0, 800) + '...' : ''}

CONTEXTO DA ANÁLISE:
${JSON.stringify(analysisContext?.brief_estrategico || analysisContext?.resumo_executivo || 'Crie com base na pauta.', null, 2)}

PAUTA / PILAR: "${pillar || topic}"
FORMATO EXIGIDO: ${type.toUpperCase().replace('_', ' ')}

${structuralInstructions}

${trendBlock ? `${trendBlock}\n` : ''}${awarenessBlock}
${voiceBlock}
${type === 'reel_script' ? '\nTAMANHO OBRIGATÓRIO: mínimo 220 palavras, máximo 400 palavras.' : ''}

TAREFA FINAL: Entrega o conteúdo pronto para uso. Sem saudações de IA. Vá direto para o conteúdo.
`;

    const completion = await generateWithFallback([{ role: 'user', content: prompt }]);
    const finalContent = completion.choices[0]?.message?.content || '';

    if (!finalContent) throw new Error('Falha ao gerar conteúdo.');

    res.json({
      success: true,
      content: finalContent,
      meta: {
        type,

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
      analysisData = JSON.parse(extractJSON(content));
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

    // Extract niche keywords from analysis to be used in script generation
    const nicheKeywords: string[] = [];
    try {
      const pillars = (analysisData as any)?.brief_estrategico?.pilares_conteudo || [];
      pillars.forEach((p: any) => { if (p.nome) nicheKeywords.push(p.nome); });
      const contentTilt = (analysisData as any)?.brief_estrategico?.content_tilt;
      if (contentTilt) nicheKeywords.push(contentTilt);
      const pontosMelhoria = (analysisData as any)?.pontos_melhoria || [];
      pontosMelhoria.slice(0, 2).forEach((p: string) => { if (p) nicheKeywords.push(p); });
    } catch { /* non-fatal */ }

    res.json({
      success: true,
      analysis: analysisData,
      source,
      snapshotId,
      nicheKeywords: nicheKeywords.slice(0, 5)
    });

  } catch (error: any) {
    console.error("Error analyzing profile:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

import { CanvaService, CarouselSlide } from './services/canva';

// Instância única para manter estado PKCE entre /auth e /callback
const canvaService = new CanvaService();

// Rota: Iniciar OAuth com o Canva
app.get('/api/canva/auth', (req, res) => {
  try {
    if (!process.env.CANVA_CLIENT_ID || !process.env.CANVA_CLIENT_SECRET) {
      return res.status(500).json({ success: false, error: 'CANVA_CLIENT_ID e CANVA_CLIENT_SECRET não configurados no .env' });
    }
    const authUrl = canvaService.buildAuthUrl();
    console.log('[Canva OAuth] Redirecting to Canva authorization page...');
    res.redirect(authUrl);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rota: Callback OAuth do Canva
app.get('/api/canva/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query as Record<string, string>;
    if (error) return res.status(400).send(`Canva OAuth error: ${error}`);
    if (!code) return res.status(400).send('Missing code from Canva OAuth callback.');

    await canvaService.exchangeCode(code, state);
    console.log('[Canva OAuth] Access token obtained and saved successfully!');

    // Redireciona para o frontend com sucesso
    res.send(`
      <html><body style="font-family:sans-serif; text-align:center; padding-top:80px; background:#0f0f0f; color:#fff;">
        <h2>✅ Canva conectado com sucesso!</h2>
        <p>Você já pode fechar esta janela e voltar ao Maverick.</p>
        <script>setTimeout(() => window.close(), 3000);</script>
      </body></html>
    `);
  } catch (error: any) {
    console.error('[Canva OAuth] Callback error:', error);
    res.status(500).send(`Erro ao conectar Canva: ${error.message}`);
  }
});

// Rota: Status da conexão com o Canva
app.get('/api/canva/status', (req, res) => {
  res.json({
    success: true,
    authenticated: canvaService.isAuthenticated(),
    templateConfigured: !!process.env.CANVA_BRAND_TEMPLATE_ID,
  });
});

// Rota: Exportar design existente direto (sem autofill) — para testes e plano free
app.post('/api/export-design', async (req, res) => {
  try {
    const { design_id } = req.body as { design_id: string };

    if (!design_id) {
      return res.status(400).json({ success: false, error: 'design_id é obrigatório.' });
    }

    if (!canvaService.isAuthenticated()) {
      return res.status(401).json({ success: false, error: 'Não autenticado com o Canva.', authUrl: '/api/canva/auth' });
    }

    console.log(`[Maverick Canva] Exporting design ${design_id} directly...`);

    // Move to folder first (non-fatal)
    await canvaService.moveToFolder(design_id);

    const imageUrls = await canvaService.exportDesign(design_id);
    res.json({ success: true, images: imageUrls, count: imageUrls.length });
  } catch (error: any) {
    console.error('[Maverick Canva] Error exporting design:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rota: Gerar imagens de carrossel via Canva
// - Se informar design_id: exporta direto (sem autofill, plano free)
// - Se não informar: usa autofill com Brand Template (requer Canva Teams)
app.post('/api/generate-carousel-images', async (req, res) => {
  try {
    const { slides, design_id } = req.body as { slides: CarouselSlide[]; design_id?: string };

    if (!canvaService.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        error: 'Não autenticado com o Canva.',
        authUrl: '/api/canva/auth',
      });
    }

    let imageUrls: string[];

    if (design_id) {
      // ── Modo direto: export sem autofill ─────────────────────────────
      console.log(`[Maverick Canva] Direct export mode for design ${design_id}`);
      await canvaService.moveToFolder(design_id);
      imageUrls = await canvaService.exportDesign(design_id);
    } else {
      // ── Modo autofill: requer Brand Template (Canva Teams) ────────────
      if (!slides || !Array.isArray(slides) || slides.length === 0) {
        return res.status(400).json({ success: false, error: 'Informe slides[] para autofill ou design_id para export direto.' });
      }
      console.log(`[Maverick Canva] Autofill mode — ${slides.length} slide(s)...`);
      imageUrls = await canvaService.generateCarouselImages(slides);
    }

    res.json({ success: true, images: imageUrls, count: imageUrls.length });
  } catch (error: any) {
    console.error('[Maverick Canva] Error generating carousel images:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Maverick API server running at http://localhost:${port}`);
});


