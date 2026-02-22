export const dailyDiagnosis = {
  date: "21 Fev",
  status: "warning" as const, // "warning" | "high-performance"
  statusLabel: "⚠️ ATENÇÃO",
  analysis:
    "Sua audiência está cansada do formato X. A retenção caiu 15% nos últimos 3 posts comparado à média do nicho.",
};

export const strategies = [
  {
    id: 1,
    icon: "Flame",
    title: "O Ângulo Oposto",
    description: "Critique a ferramenta que todos estão elogiando.",
    tag: "Potencial Viral: Alto",
    tagType: "viral" as const,
    action: "Gerar Roteiro",
    hasScript: true,
    script: {
      hook: "Você conhece a ferramenta que todos dizem ser 'perfeita'? Eu achei 5 falhas graves que ninguém está falando.",
      body: "Apresente cada falha com dados e comparações reais. Use screen recordings para provar seus pontos. Mostre alternativas concretas para cada problema encontrado.",
      cta: "Salve este vídeo para quando alguém recomendar essa ferramenta sem pensar. E comente: qual outra ferramenta 'intocável' você quer que eu analise?",
    },
  },
  {
    id: 2,
    icon: "BarChart3",
    title: "Data-Driven",
    description: "Mostre o gráfico que ninguém viu sobre o mercado.",
    tag: "Autoridade: Alta",
    tagType: "high" as const,
    action: "Ver Dados",
    hasScript: false,
  },
  {
    id: 3,
    icon: "Bot",
    title: "Tech + Humor",
    description: "Tutorial sério com plot twist engraçado.",
    tag: "Engajamento: Médio",
    tagType: "medium" as const,
    action: "Explorar",
    hasScript: false,
  },
];

export const metrics = [
  {
    label: "Viral Score Atual",
    value: "7.8",
    suffix: "/10",
    trend: null,
  },
  {
    label: "Retenção Média",
    value: "45s",
    suffix: "",
    trend: "+12%",
  },
  {
    label: "Economia de Tempo",
    value: "3h 20m",
    suffix: "",
    trend: "Semana",
  },
  {
    label: "Próximo Trend",
    value: "IA Generativa",
    suffix: "em Áudio",
    trend: "↑ Subindo",
  },
];

export const userProfile = {
  name: "Alex",
  role: "Tech Creator",
  avatar: "A",
};

export const navItems = [
  { title: "Dashboard", icon: "Scan", url: "/", active: true },
  { title: "Roteiros", icon: "FileText", url: "/scripts" },
  { title: "Configurações", icon: "Settings", url: "/settings" },
];
