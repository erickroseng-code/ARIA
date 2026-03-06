import { LLMService } from '../core/llm';

/**
 * Pattern Analyzer - Extrai padrões de vídeos virais via LLM
 *
 * Analisa:
 * - Hook pattern (primeiras frases)
 * - Tema principal
 * - Formato/estrutura
 * - Call-to-action
 * - Padrão de storytelling
 */

export interface VideoPattern {
  url: string;
  views: number;
  engagement: {
    likes: number;
    comments: number;
  };
  viral_score: number;

  analysis: {
    hook: string;           // Primeiras frases que prendem
    theme: string;          // Tema principal
    format: string;         // Tipo de conteúdo (Storytelling, Pergunta, Revelação, etc)
    cta: string;            // Call-to-action
    pattern: string;        // Padrão narrativo (Problem-Solution-Action, etc)
    emotional_trigger: string; // Trigger emocional (medo, desejo, vergonha, etc)
  };
}

interface RawPost {
  url: string;
  caption?: string;
  views?: number;
  likes?: number;
  comments?: number;
  type?: string;
  viral_score?: number;
}

export class PatternAnalyzer {
  private llm: LLMService;

  constructor() {
    this.llm = new LLMService('deepseek');
  }

  /**
   * Analisa padrões de um conjunto de vídeos virais
   */
  async analyzeVirtualPosts(posts: RawPost[]): Promise<VideoPattern[]> {
    process.stdout.write(`\n📊 ANALISANDO PADRÕES DE ${posts.length} VÍDEOS VIRAIS...\n\n`);

    const results: VideoPattern[] = [];

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];

      try {
        process.stdout.write(`[${i + 1}/${posts.length}] Analisando padrão...\n`);

        const pattern = await this.analyzeSinglePost(post);
        results.push(pattern);

      } catch (error: any) {
        process.stderr.write(`[PATTERN] Erro ao analisar ${post.url}: ${error.message}\n`);
      }
    }

    return results;
  }

  /**
   * Analisa um único vídeo via LLM
   */
  private async analyzeSinglePost(post: RawPost): Promise<VideoPattern> {
    const caption = post.caption || '(sem descrição)';
    const engagement = (post.likes || 0) + (post.comments || 0);

    // Prompt para LLM analisar
    const prompt = `
Você é um especialista em análise de conteúdo viral do Instagram. Analise o seguinte vídeo:

**Caption:**
${caption}

**Engajamento:**
- Views: ${(post.views || 0).toLocaleString('pt-BR')}
- Likes: ${post.likes || 0}
- Comments: ${post.comments || 0}

**Tarefa:** Extraia EXATAMENTE os seguintes campos em JSON:

1. **hook**: Primeiras 1-2 frases que prendem atenção (máximo 100 chars)
2. **theme**: Tema principal em 1-2 palavras (ex: "produtividade", "copywriting", "mentalidade")
3. **format**: Tipo de formato entre: "Storytelling", "Pergunta", "Dissonância", "Revelação", "Comparação", "Tópicos", "Outro"
4. **cta**: Call-to-action identificado (ex: "Salva esse vídeo", "Compartilha com alguém", "Comente suas dúvidas")
5. **pattern**: Padrão narrativo entre: "Problem-Solution-Action", "Before-After", "Hook-Story-CTA", "List-Tips", "Question-Answer", "Outro"
6. **emotional_trigger**: Emoção principal despertada: "Fear", "Desire", "Shame", "Curiosity", "Anger", "Hope", "Inspiration"

Responda APENAS com JSON válido, sem explicações adicionais.

{
  "hook": "",
  "theme": "",
  "format": "",
  "cta": "",
  "pattern": "",
  "emotional_trigger": ""
}
    `;

    try {
      const analysis = await this.llm.analyzeJson<{
        hook: string;
        theme: string;
        format: string;
        cta: string;
        pattern: string;
        emotional_trigger: string;
      }>(prompt, `{
  "hook": "string (primeiras frases que prendem, max 100 chars)",
  "theme": "string (tema principal em 1-2 palavras)",
  "format": "string (um de: Storytelling, Pergunta, Dissonância, Revelação, Comparação, Tópicos, Outro)",
  "cta": "string (call-to-action identificado)",
  "pattern": "string (um de: Problem-Solution-Action, Before-After, Hook-Story-CTA, List-Tips, Question-Answer, Outro)",
  "emotional_trigger": "string (uma de: Fear, Desire, Shame, Curiosity, Anger, Hope, Inspiration)"
}`);

      return {
        url: post.url,
        views: post.views || 0,
        engagement: {
          likes: post.likes || 0,
          comments: post.comments || 0,
        },
        viral_score: post.viral_score || 0,
        analysis: {
          hook: analysis.hook || '(não identificado)',
          theme: analysis.theme || '(não identificado)',
          format: analysis.format || 'Outro',
          cta: analysis.cta || '(não identificado)',
          pattern: analysis.pattern || 'Outro',
          emotional_trigger: analysis.emotional_trigger || 'Curiosity',
        },
      };

    } catch (error: any) {
      process.stderr.write(`[LLM] Erro na análise: ${error.message}\n`);

      // Fallback: análise simples se LLM falhar
      return {
        url: post.url,
        views: post.views || 0,
        engagement: {
          likes: post.likes || 0,
          comments: post.comments || 0,
        },
        viral_score: post.viral_score || 0,
        analysis: {
          hook: caption.slice(0, 100),
          theme: 'análise não disponível',
          format: 'Outro',
          cta: 'análise não disponível',
          pattern: 'Outro',
          emotional_trigger: 'Curiosity',
        },
      };
    }
  }

  /**
   * Extrai tendências gerais dos padrões
   */
  extractTrends(patterns: VideoPattern[]): {
    top_hooks: string[];
    top_themes: string[];
    top_formats: string[];
    top_ctas: string[];
    top_triggers: string[];
  } {
    return {
      top_hooks: [...new Set(patterns.map(p => p.analysis.hook))].slice(0, 5),
      top_themes: [...new Set(patterns.map(p => p.analysis.theme))].slice(0, 5),
      top_formats: [...new Set(patterns.map(p => p.analysis.format))].slice(0, 3),
      top_ctas: [...new Set(patterns.map(p => p.analysis.cta))].slice(0, 5),
      top_triggers: [...new Set(patterns.map(p => p.analysis.emotional_trigger))].slice(0, 3),
    };
  }
}
