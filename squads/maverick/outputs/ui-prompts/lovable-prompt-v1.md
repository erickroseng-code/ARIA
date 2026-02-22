# Prompt para Geração de Interface (Lovable.dev) - Squad Maverick

**Objetivo:** Criar um Dashboard "Raio-X Disruptivo" para Criadores de Conteúdo (High-Tech, Clean, Foco em Dados).

---

## 🎨 Prompt Principal (Copie e Cole no Lovable)

### 1. Persona & Contexto
"Atue como um Designer de Interface Sênior especializado em Dashboards para Criadores de Conteúdo. Estamos criando o 'Maverick', uma plataforma que analisa perfis sociais e sugere estratégias de viralização baseadas em dados, não em 'achismos'. O usuário é o Alex (28 anos, Tech Creator), que precisa de clareza imediata e insights acionáveis."

### 2. Estrutura da Aplicação (Layout)
"Crie uma aplicação React (Vite) moderna usando **Shadcn UI** e **Tailwind CSS**.
- **Tema:** Dark Mode profundo (slate-950), com acentos em Neon Purple (#8b5cf6) e Cyan (#06b6d4) para destacar métricas de viralidade.
- **Tipografia:** Inter (limpa e legível) para textos, Space Grotesk para títulos e números grandes.
- **Navegação (Sidebar Esquerda):**
  - Logo: Ícone de Águia (Maverick) + Texto 'Maverick'.
  - Menu: Dashboard (Raio-X), Insights, Content Planner, Roteiros, Configurações.
  - Perfil do Usuário no rodapé da sidebar."

### 3. Tela Principal: Dashboard "Raio-X Diário"
"O foco central é o 'Raio-X Diário'. Divida a tela em 3 seções principais:

#### A. O Diagnóstico (Topo - Hero Section)
- Um Card grande com gradiente sutil.
- Título: 'Raio-X de Hoje: 21 Fev'.
- Status Grande: '⚠️ ATENÇÃO' (Amarelo) ou '🚀 ALTA PERFORMANCE' (Verde).
- Texto de Análise (Simulado): 'Sua audiência está cansada do formato X. A retenção caiu 15% nos últimos 3 posts comparado à média do nicho.'
- Botão de Ação Primária: 'Ver Análise Detalhada'."

#### B. As 3 Estratégias Disruptivas (Meio - Cards Horizontais)
- Título da Seção: 'Caminhos Recomendados para Hoje'.
- Crie 3 Cards lado a lado, cada um representando uma estratégia diferente:
  1.  **Card 1 (Ousado):** Ícone de Fogo. Título: 'O Ângulo Oposto'. Descrição: 'Critique a ferramenta que todos estão elogiando.'. Tag: 'Potencial Viral: Alto'. Botão: 'Gerar Roteiro'.
  2.  **Card 2 (Analítico):** Ícone de Gráfico. Título: 'Data-Driven'. Descrição: 'Mostre o gráfico que ninguém viu sobre o mercado.'. Tag: 'Autoridade: Alta'. Botão: 'Ver Dados'.
  3.  **Card 3 (Híbrido):** Ícone de Robô. Título: 'Tech + Humor'. Descrição: 'Tutorial sério com plot twist engraçado.'. Tag: 'Engajamento: Médio'. Botão: 'Explorar'.
- Use micro-interações (hover effects) suaves nos cards."

#### C. Métricas de Impacto (Rodapé - Grid 4 Colunas)
- Pequenos cards com números grandes:
  - 'Viral Score Atual': 7.8/10
  - 'Retenção Média': 45s (+12%)
  - 'Economia de Tempo': 3h 20m (Semana)
  - 'Próximo Trend': 'IA Generativa em Áudio' (Tendência subindo)"

### 4. Funcionalidades Interativas (Mockup)
- Ao clicar em 'Gerar Roteiro' (Card 1), abra um **Modal ou Drawer Lateral**.
- O Modal deve mostrar:
  - Título da Estratégia.
  - Estrutura do Roteiro (Gancho, Corpo, CTA).
  - Botão 'Copiar para Notion' e 'Gerar Imagens'."

### 5. Estilo Visual (Geral)
- Use **Glassmorphism** sutil nos cards sobre o fundo escuro.
- Bordas finas e elegantes (border-slate-800).
- Sombras coloridas (glow) apenas nos elementos de alta viralidade.
- Ícones: Lucide React (simples e modernos)."

---

## 🛠️ Instruções Técnicas para o Lovable
- "Use componentes funcionais do React."
- "Use Tailwind para todo o estilo."
- "Use Framer Motion para animações de entrada suaves."
- "Mocke os dados em um arquivo separado (data.ts) para facilitar a integração com API real depois."
- "Garanta responsividade (Mobile-first)."

---

**Dica Extra:** Se o Lovable perguntar sobre cores específicas, peça "Cyberpunk Clean" ou "Futuristic Dashboard".
