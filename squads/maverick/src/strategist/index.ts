import { ScoutAgent, ProfileAnalysis } from '../scout/index';
import { ScholarEngine } from '../scholar/engine';

export class StrategistAgent {
    private scout: ScoutAgent;
    private scholar: ScholarEngine;

    constructor() {
        this.scout = new ScoutAgent();
        this.scholar = new ScholarEngine();
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
        
        // Query baseada na promessa detectada na bio
        const query = profileData.bio.detected_promise || "estratégia de conteúdo";
        const knowledge = this.scholar.search(query);
        const bestConcept = knowledge[0]?.content || "Conceito genérico de autoridade e constância.";

        // 3. Geração do Plano (O Diagnóstico)
        console.log("--- Passo 3: Compilando Plano de Ação ---");
        return this.generateMarkdown(profileData, bestConcept);
    }

    private generateMarkdown(profile: ProfileAnalysis, coreConcept: string): string {
        const date = new Date().toLocaleDateString('pt-BR');
        const postsList = profile.recent_posts.map(p => `- [${p.type}] ${p.caption}`).join('\n');
        
        // Lógica simples de "Nota de Coerência"
        const coherenceScore = profile.highlights.has_highlights ? 7 : 4;
        const gapAnalysis = coherenceScore < 6 
            ? "O perfil promete muito na Bio mas entrega pouco contexto visual (sem destaques claros)."
            : "O perfil tem boa estrutura, mas precisa alinhar os posts à promessa da bio.";

        return `
# 🦅 Plano de Ação Maverick: @${profile.username}
**Data:** ${date}
**Status:** 🟡 Aguardando Aprovação

---

## 1. O Diagnóstico (A Realidade Atual)

### 📸 A Promessa (Bio & Destaques)
- **Bio:** "${profile.bio.text}"
- **Promessa Identificada:** ${profile.bio.detected_promise}
- **Destaques:** ${profile.highlights.has_highlights ? "✅ Possui destaques" : "❌ Sem destaques (Falha Grave)"}
- **Resumo Visual:** ${profile.highlights.key_summary || "Nenhum resumo disponível."}

### 📢 A Entrega (Análise dos Posts)
*Últimos conteúdos analisados:*
${postsList}

- **Coerência:** ${coherenceScore}/10
- **O Gap:** ${gapAnalysis}

---

## 2. A Estratégia (O Caminho do Expert)

Baseado no conceito da Base de Conhecimento:
> *"${coreConcept}"*

### 🎯 O Novo Posicionamento
- **Ação Imediata:** Ajustar a linha editorial para refletir a promessa de "${profile.bio.detected_promise}".
- **Destaques Obrigatórios:** Criar um destaque "Comece Aqui" explicando sua metodologia.

### 🗓️ Pilares de Conteúdo Sugeridos
1. **Prova Social:** Mostrar resultados (que validam a Bio).
2. **Bastidores:** Mostrar o processo (que gera conexão, conforme o manifesto).
3. **Técnico:** Ensinar o "como fazer" (para gerar autoridade).

---

## 3. Próximos Passos (Para Aprovação)

O **Maverick Copywriter** está pronto para escrever:

1. **Roteiro 1 (Reels):** "Como eu atingi [Promessa da Bio] em 30 dias."
2. **Roteiro 2 (Carrossel):** "O erro que todo iniciante comete em [Nicho]."
3. **Roteiro 3 (Stories):** Sequência de abertura de caixa de perguntas.

> **Comando:** Digite "Aprovado" para gerar os roteiros acima.
`;
    }
}
