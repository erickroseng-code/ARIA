import { ScoutAgent, ProfileAnalysis } from '../scout/index';
import { ScholarEngine } from '../scholar/engine';
import { LLMService } from '../core/llm';

export class StrategistAgent {
    private scout: ScoutAgent;
    private scholar: ScholarEngine;
    private llm: LLMService;

    constructor() {
        this.scout = new ScoutAgent();
        this.scholar = new ScholarEngine();
        this.llm = new LLMService();
    }

    async createStrategicPlan(username: string): Promise<string> {
        console.log(`🧠 Strategist: Iniciando plano para @${username}...`);

        // 1. Coleta de Dados (A Realidade)
        console.log("--- Passo 1: Scout (Análise de Perfil) ---");
        let profileData: ProfileAnalysis;
        try {
            profileData = await this.scout.analyzeProfile(username);
        } catch (error) {
            return `❌ Erro Crítico no Scout: ${error}`;
        }

        // 2. Busca de Conhecimento (O Ideal)
        console.log("--- Passo 2: Scholar (Busca de Referências) ---");
        await this.scholar.loadKnowledgeBase();
        
        // Query baseada na promessa detectada na bio + palavras chave gerais
        const query = (profileData.bio.detected_promise || "") + " estratégia conteúdo autoridade vendas";
        
        // Aumentando o contexto para 10 fragmentos para dar mais material ao LLM
        const knowledge = this.scholar.search(query, 10);
        const knowledgeText = knowledge.map(k => `[Fonte: ${k.source}] ${k.content}`).join("\n\n");

        // 3. Geração do Plano (O Diagnóstico com IA)
        console.log("--- Passo 3: Raciocínio Estratégico (LLM) ---");
        
        const prompt = `
        VOCÊ É O MAVERICK STRATEGIST. Um consultor que segue estritamente a metodologia do expert abaixo.
        
        CONHECIMENTO DO EXPERT (Sua Bíblia):
        ${knowledgeText || "Nenhum conhecimento específico encontrado. Use princípios de marketing de autoridade."}

        ANÁLISE O PERFIL (O Cliente):
        - Username: @${profileData.username}
        - Bio: "${profileData.bio.text}"
        - Destaques: ${profileData.highlights.titles.join(", ")}
        - Posts Recentes: ${JSON.stringify(profileData.recent_posts.map(p => p.caption))}

        TAREFA:
        Gere um "Plano de Ação Maverick" em Markdown.
        
        REGRAS CRÍTICAS:
        1. CRITIQUE o perfil usando os conceitos do Expert. (Ex: "O Expert diz X em [Fonte], mas você faz Y").
        2. NÃO use "dicas genéricas de marketing". Use o vocabulário e os princípios do texto acima.
        3. CITE a fonte do conceito usado (ex: "Segundo o Manifesto...").
        
        ESTRUTURA DO OUTPUT:
        # 🦅 Plano de Ação Maverick: @${username}
        ## 1. O Diagnóstico (Gap entre Bio e Realidade)
        ## 2. A Estratégia (Baseada no Expert)
           - Conceito Chave Aplicado: [Nome do Conceito]
           - Citação: "[Trecho do texto base]"
        ## 3. Próximos Passos (3 Ideias de Roteiros Práticos)
        `;

        return await this.llm.chat(prompt);
    }
}
