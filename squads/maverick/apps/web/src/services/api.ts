// Arquivo: src/services/api.ts

const API_BASE_URL = 'http://localhost:3000/api';

export interface AnalysisSection {
  title: string;
  description: string;
}

export interface AnalysisResult {
  bio: AnalysisSection;
  conteudo: AnalysisSection;
  posicionamento: AnalysisSection;
  pontos_melhoria: string[];
  pontos_fortes: string[];
}

interface ScriptResult {
  success: boolean;
  script: string;
}

export const MaverickAPI = {
  /**
   * Realiza o 'Raio-X' do perfil (Simulado ou Real)
   */
  async analyzeProfile(handle: string): Promise<AnalysisResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/analyze-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle })
      });

      if (!response.ok) throw new Error('Falha na análise do perfil');

      const data = await response.json();
      return data.analysis;
    } catch (error) {
      console.error('Erro na API analyzeProfile:', error);
      // Fallback para dados de exemplo em caso de erro
      return {
        bio: { title: "Erro na Análise", description: "Não conseguimos conectar com o agente de análise." },
        conteudo: { title: "Tente novamente", description: "Verifique sua conexão." },
        posicionamento: { title: "Sem dados", description: "..." },
        pontos_melhoria: ["Erro de conexão"],
        pontos_fortes: ["Tente novamente mais tarde"]
      };
    }
  },

  /**
   * Gera um roteiro disruptivo com IA
   */
  async generateScript(topic: string, angle: string): Promise<ScriptResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/generate-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, angle })
      });

      if (!response.ok) throw new Error('Falha ao gerar roteiro');

      return await response.json();
    } catch (error) {
      console.error('Erro na API generateScript:', error);
      return { success: false, script: 'Erro ao gerar roteiro. Verifique o console.' };
    }
  },

  /**
   * Pede ao Strategist para gerar um Plano de Ação (3 Estratégias)
   */
  async generateStrategy(profileData: AnalysisResult): Promise<{ success: boolean; strategies?: any[]; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/generate-strategy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileData })
      });

      if (!response.ok) throw new Error('Falha ao gerar estratégias');

      return await response.json();
    } catch (error) {
      console.error('Erro na API generateStrategy:', error);
      return { success: false, error: 'Erro ao gerar estratégias. Verifique o console.' };
    }
  },

  /**
   * Envia uma mensagem de chat para o agente com contexto
   */
  async sendChatMessage(messages: { role: string; text: string }[], context: AnalysisResult | null): Promise<{ success: boolean; response?: string; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, context })
      });

      if (!response.ok) throw new Error('Falha ao enviar mensagem');

      return await response.json();
    } catch (error) {
      console.error('Erro na API sendChatMessage:', error);
      return { success: false, error: 'Erro de conexão com o agente.' };
    }
  }
};
