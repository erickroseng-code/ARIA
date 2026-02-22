import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Configuração do CORS
app.use(cors());
app.use(bodyParser.json());

// Configuração do Cliente OpenAI (OpenRouter)
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "YOUR_OPENROUTER_KEY",
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "Maverick AIOS",
    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`
  }
});

// Rota de Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Maverick API' });
});

// Rota: Gerar Roteiro (Simula @maverick-copywriter)
app.post('/api/generate-script', async (req, res) => {
  try {
    const { topic, angle, tone } = req.body;

    console.log(`[Maverick API] Generating script for topic: "${topic}" with angle: "${angle}"`);

    // Prompt para o Modelo (Llama 3, Gemini Flash, etc via OpenRouter)
    const prompt = `
      Atue como um Copywriter Especialista em Conteúdo Viral (@maverick-copywriter).
      
      Gere um roteiro curto para Instagram Reels/TikTok sobre: "${topic}".
      
      Estratégia:
      - Ângulo: ${angle || "Disruptivo"}
      - Tom de Voz: ${tone || "Direto e Polêmico"}
      
      Estrutura Obrigatória:
      1. GANCHO (0-3s): Algo que pare o scroll.
      2. RETENÇÃO (3-15s): O problema ou curiosidade.
      3. CORPO (15-50s): A solução ou insight.
      4. CTA (Final): Chamada para ação clara.
      
      Responda APENAS com o roteiro formatado.
    `;

    const completion = await openai.chat.completions.create({
      model: "google/gemini-2.0-flash-exp:free", // Modelo Gratuito (ajustável)
      messages: [{ role: "user", content: prompt }],
    });

    const script = completion.choices[0]?.message?.content || "Erro ao gerar roteiro.";

    res.json({ success: true, script });

  } catch (error: any) {
    console.error("Error generating script:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

import { ScoutAgent } from './services/scout';
import { StrategistAgent } from './services/strategist';

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

    const completion = await openai.chat.completions.create({
      model: "google/gemini-2.0-flash-exp:free",
      messages: apiMessages,
    });

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

    // 2. Análise Estratégica com IA (Gemini)
    // Se tiver dados reais, usa eles. Se não, pede para simular com base no erro.
    const prompt = `
      Atue como um Especialista em Crescimento de Redes Sociais (@maverick-scout).
      
      OBJETIVO: Analisar o perfil @${handle}.
      
      DADOS COLETADOS (Scraper):
      ${scrapedData ? JSON.stringify(scrapedData, null, 2) : "Não foi possível acessar os dados reais (Provável perfil privado ou erro de login). SIMULE uma análise baseada no nicho provável do nome."}
      
      ${scrapeError ? `NOTA DE ERRO: Ocorreu um erro na coleta: ${scrapeError}. Considere isso na análise (sugerindo verificar privacidade, etc).` : ""}

      Com base APENAS nesses dados (ou na simulação se falhou), gere um relatório JSON estrito:
      
      {
        "bio": { 
            "title": "Bio e Destaques", 
            "description": "Análise da Bio ('${scrapedData?.bio?.text || 'N/A'}') e Destaques." 
        },
        "conteudo": { 
            "title": "Conteúdo Recente", 
            "description": "Análise dos últimos posts detectados: ${scrapedData?.recent_posts?.length || 0} posts encontrados. Cite exemplos dos textos se houver." 
        },
        "posicionamento": { 
            "title": "Posicionamento", 
            "description": "Qual a vibe do perfil baseada nos dados? (Autoridade, Vendas, Lifestyle?)" 
        },
        "pontos_melhoria": ["Ponto 1", "Ponto 2", "Ponto 3", "Ponto 4"],
        "pontos_fortes": ["Ponto 1", "Ponto 2", "Ponto 3", "Ponto 4"]
      }

      Seja crítico e estratégico.
      Responda APENAS o JSON.
    `;

    const completion = await openai.chat.completions.create({
      model: "google/gemini-2.0-flash-exp:free",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0]?.message?.content;
    const analysisData = JSON.parse(content || "{}");

    res.json({
      success: true,
      analysis: analysisData,
      source: scrapedData ? "real_scraping" : "ai_simulation"
    });

  } catch (error: any) {
    console.error("Error analyzing profile:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Maverick API server running at http://localhost:${port}`);
});
