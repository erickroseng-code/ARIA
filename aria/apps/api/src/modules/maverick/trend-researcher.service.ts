
export interface TrendInsight {
  hook_pattern: string;
  angle: string;
  engagement_signal: string;
  example_hook: string;
  format: string;
}

export interface TrendReferencePost {
  url: string;
  caption_preview: string;
  likes?: number;
  comments?: number;
  views?: number;
  type: string;
}

export interface TrendResearch {
  keywords_searched: string[];
  posts_analyzed: number;
  insights: TrendInsight[];
  dominant_formats: string[];
  niche_summary: string;
  reference_posts: TrendReferencePost[];
}

const INSIGHTS_SCHEMA = `{
  "insights": [
    {
      "hook_pattern": "nome do padrão",
      "angle": "ângulo narrativo",
      "engagement_signal": "princípio comportamental",
      "example_hook": "trecho do post real",
      "format": "Reels|Carrossel"
    }
  ],
  "dominant_formats": ["Reels", "Carrossel"],
  "niche_summary": "Resumo de tendências..."
}`;

async function llmChat(prompt: string, system: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY não configurada');

  const models = ['deepseek/deepseek-v3.2', 'minimax/minimax-m2.5'];
  for (const model of models) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://aria-api.onrender.com',
        },
        body: JSON.stringify({ model, temperature: 0, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }),
      });
      const data = await res.json() as any;
      if (data?.choices?.[0]?.message?.content) return data.choices[0].message.content;
    } catch { /* try next */ }
  }
  throw new Error('LLM failed');
}

export async function runTrendResearch(plan: string, onStep?: (msg: string) => void, maxAgeDays = 45, preselectedKeywords?: string[]): Promise<TrendResearch> {
  let keywords: string[] = [];

  if (preselectedKeywords && preselectedKeywords.length > 0) {
    keywords = preselectedKeywords.map(k => k.trim().replace(/^#/, '')).filter(Boolean);
    onStep?.(`🔍 Usando palavras-chave definidas: ${keywords.join(', ')}`);
  } else {
    onStep?.('🔍 Extraindo palavras-chave para pesquisa de tendências...');
    const keywordsPrompt = `Extraia exatamente 3 termos de busca para o Instagram baseados no perfil abaixo. Retorne apenas JSON: { "keywords": ["termo1", "termo2", "termo3"] }. \n\nPLANO:\n${plan.slice(0, 1500)}`;
    const keywordsRaw = await llmChat(keywordsPrompt, 'Retorne apenas JSON.');
    try {
      const match = keywordsRaw.match(/\{[\s\S]*\}/);
      keywords = JSON.parse(match?.[0] ?? '{}').keywords || [];
    } catch (e) {
      keywords = ['dicas', 'viral', 'tutorial'];
    }
    keywords = keywords.map(k => k.trim().replace(/^#/, '')).filter(Boolean);
  }

  let topPosts: any[] = [];

  // PLAYWRIGHT: abre o navegador local e busca posts virais por keyword
  onStep?.(`🌐 Abrindo navegador para buscar posts virais: ${keywords.join(', ')}...`);
  try {
    const { InstagramScraper } = await import('./tools/instagramScraper');
    const scraper = new InstagramScraper();
    const viralPosts = await scraper.scrapeMultipleHashtags(keywords, 100_000, 10, maxAgeDays, 'click');
    topPosts = viralPosts.map(p => ({
      url: p.url,
      caption: p.caption,
      videoPlayCount: p.views,
      likesCount: p.likes,
      commentsCount: p.comments,
      type: p.type === 'Reel' || p.type === 'Video' ? 'Video' : 'Image',
    }));
    if (topPosts.length > 0) {
      onStep?.(`✅ Navegador extraiu ${topPosts.length} posts virais!`);
    } else {
      throw new Error('Playwright retornou 0 posts virais.');
    }
  } catch (err: any) {
    console.warn('[TRENDS] Playwright falhou:', err?.message ?? err);
    onStep?.(`⚠️ Navegador falhou: ${err?.message?.slice(0, 100) ?? 'erro desconhecido'}`);
  }

  if (topPosts.length === 0) {
    onStep?.('⚠️ Não foi possível coletar posts reais, gerando insights genéricos a partir do modelo...');
  } else {
    onStep?.(`📊 Analisando padrões comportamentais nos posts coletados...`);
  }

  // Usa o LLMService antigo refatorado p/ extrair hooks diretamente?
  // Neste caso vamos usar o mesmo LLM local e garantir que retorna a interface que o copywriter espera.
  const postsFormatted = topPosts.map((p: any, i: number) => {
    const likes = p.likesCount || 0;
    const views = p.videoPlayCount || 0;
    const type = p.type === 'Video' ? 'Reels' : 'Post';
    return `[Post ${i+1}][${type}] ${likes} likes, ${views} views\nLegenda: ${(p.caption || '').slice(0, 200)}`;
  }).join('\n\n');

  const analyzePrompt = `Analise os posts do nicho e extraia tendências, hooks que funcionam e formatos dominantes.\nKEYWORDS: ${keywords.join(', ')}\nPOSTS:\n${postsFormatted || 'Sem posts reais disponíveis. Recorra à sua base de conhecimento.'}\n\nRetorne APENAS JSON no formato:\n${INSIGHTS_SCHEMA}`;
  
  const analysisRaw = await llmChat(analyzePrompt, 'Você é um estrategista viral. Retorne APENAS JSON válido.');
  let parsed: any = {};
  
  try {
    const match = analysisRaw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match?.[0] ?? '{}');
  } catch (e) {
    console.error('[TRENDS] Falha ao fazer parse do JSON de insights', e);
  }

  return {
    keywords_searched: keywords,
    posts_analyzed: topPosts.length,
    insights: parsed.insights || [],
    dominant_formats: parsed.dominant_formats || [],
    niche_summary: parsed.niche_summary || 'Resumo de tendências não gerado.',
    reference_posts: topPosts.slice(0, 5).map(p => ({
      url: p.url,
      caption_preview: (p.caption || '').slice(0, 100),
      likes: p.likesCount,
      views: p.videoPlayCount,
      type: p.type === 'Video' ? 'Reels' : 'Post'
    }))
  };
}
