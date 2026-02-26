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
   * Gera roteiros via Copywriter Master Agent (2-Pass Pipeline)
   */
  async generateScript(topic: string, angle: string, tone: string, creatorProfile: string, awarenessLevel: number, referencePost: string = ""): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/generate-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, angle, tone, creatorProfile, awarenessLevel, referencePost })
      });
      if (!response.ok) throw new Error('Falha ao gerar roteiro');
      return await response.json();
    } catch (error) {
      console.error('Erro na API generateScript:', error);
      return { success: false, error: 'Falha de comunicação com o Copywriter.' };
    }
  },

  /**
   * Gera diferentes tipos de conteúdo embasados na análise e no RAG (Carrossel, Legenda, Roteiros)
   */
  async generateContent(payload: {
    type: 'reel_script' | 'carousel_slides' | 'caption' | 'stories_sequence';
    pillar: string;
    topic?: string;
    analysisContext: any;
    awarenessLevel?: number;
    referencePost?: string;
  }): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/generate-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Falha ao gerar conteúdo');
      return await response.json();
    } catch (error) {
      console.error('Erro na API generateContent:', error);
      return { success: false, error: 'Falha de comunicação com o Copywriter.' };
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
  },

  /**
   * Lista todas as análises salvas no histórico
   */
  async listHistory(): Promise<any[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/history`);
      if (!response.ok) throw new Error('Falha ao buscar histórico');
      const data = await response.json();
      return data.snapshots || [];
    } catch (error) {
      console.error('Erro na API listHistory:', error);
      return [];
    }
  },

  /**
   * Busca um snapshot específico pelo ID
   */
  async getSnapshot(id: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/history/${id}`);
      if (!response.ok) throw new Error('Falha ao buscar snapshot');
      const data = await response.json();
      return data.snapshot || null;
    } catch (error) {
      console.error('Erro na API getSnapshot:', error);
      return null;
    }
  },

  /**
   * Deleta um snapshot do histórico pelo ID
   */
  async deleteSnapshot(id: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/history/${id}`, { method: 'DELETE' });
      return response.ok;
    } catch (error) {
      console.error('Erro na API deleteSnapshot:', error);
      return false;
    }
  }
};

