import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Bird, Menu, ArrowLeft, ArrowUp, User, Sparkles, Target, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "@/components/AppSidebar";
import { FluidOrganism } from "@/components/FluidOrganism";
import { StrategyCards } from "@/components/StrategyCards";
import { ScriptDrawer, ScriptData } from "@/components/ScriptDrawer";
import { MaverickAPI, AnalysisResult } from "@/services/api";
import { strategies } from "@/data/mockData";

const TABS = [
  { id: "bio", label: "Bio e Destaques", icon: User },
  { id: "conteudo", label: "Conteúdo", icon: Sparkles },
  { id: "posicionamento", label: "Posicionamento", icon: Target },
  { id: "estrategias", label: "Estratégias", icon: Zap },
] as const;

type TabId = (typeof TABS)[number]["id"];

// Color themes per tab (matching FluidOrganism COLORS format)
const TAB_COLORS: Record<TabId, string[]> = {
  bio: [
    "hsla(263, 70%, 66%,",
    "hsla(280, 60%, 55%,",
    "hsla(300, 50%, 60%,",
    "hsla(240, 60%, 65%,",
  ],
  conteudo: [
    "hsla(187, 94%, 43%,",
    "hsla(170, 80%, 45%,",
    "hsla(200, 85%, 50%,",
    "hsla(160, 70%, 50%,",
  ],
  posicionamento: [
    "hsla(45, 93%, 58%,",
    "hsla(30, 90%, 55%,",
    "hsla(340, 75%, 55%,",
    "hsla(15, 85%, 55%,",
  ],
  estrategias: [
    "hsla(10, 80%, 60%,",
    "hsla(30, 90%, 55%,",
    "hsla(340, 75%, 55%,",
    "hsla(15, 85%, 55%,",
  ],
};

export default function Analysis() {
  const { handle } = useParams<{ handle: string }>();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("bio");
  const [chatValue, setChatValue] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "agent"; text: string }[]>([
    {
      role: "agent",
      text: `Analisei o perfil @${handle}. Tem alguma dúvida sobre os resultados ou quer que eu aprofunde em algum ponto?`,
    },
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Data state
  const [analysisData, setAnalysisData] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Script Generation State
  const [scriptDrawerOpen, setScriptDrawerOpen] = useState(false);
  const [currentScript, setCurrentScript] = useState<ScriptData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Strategy Generation State
  const [strategiesData, setStrategiesData] = useState<any[]>([]);
  const [isGeneratingStrategies, setIsGeneratingStrategies] = useState(false);

  // Fetch Analysis on Mount
  useEffect(() => {
    async function fetchAnalysis() {
      if (handle) {
        setIsLoading(true);
        try {
          const data = await MaverickAPI.analyzeProfile(handle);
          setAnalysisData(data);

          // Generate real strategies based on the analysis
          setIsGeneratingStrategies(true);
          const strategyResponse = await MaverickAPI.generateStrategy(data);
          if (strategyResponse.success && strategyResponse.strategies) {
            setStrategiesData(strategyResponse.strategies);
          }
        } catch (error) {
          console.error("Error fetching analysis:", error);
        } finally {
          setIsLoading(false);
          setIsGeneratingStrategies(false);
        }
      }
    }
    fetchAnalysis();
  }, [handle]);

  const handleGenerateScript = async (strategyId: number) => {
    setIsGenerating(true);
    // Determine if we are using real strategies or fallback mocks
    const activeStrategies = strategiesData.length > 0 ? strategiesData : strategies;
    const strategy = activeStrategies.find((s: any) => s.id === strategyId);

    if (!strategy) {
      setIsGenerating(false);
      return;
    }

    // Call API
    const result = await MaverickAPI.generateScript(
      strategy.title, // Topic
      strategy.description // Angle/Description
    );

    setIsGenerating(false);

    if (result.success && result.script) {
      // Simple parsing heuristic
      const parts = result.script.split('\n\n');
      const hook = parts[0] || "";
      const body = parts.slice(1, parts.length - 1).join('\n\n') || "";
      const cta = parts[parts.length - 1] || "";

      setCurrentScript({
        title: strategy.title,
        description: strategy.description,
        hook: hook,
        body: body || result.script, // Fallback if split fails
        cta: cta
      });
      setScriptDrawerOpen(true);
    } else {
      // Error handling
      console.error("Failed to generate script");
    }
  };

  const [isTyping, setIsTyping] = useState(false);

  const handleChatSubmit = async () => {
    if (!chatValue.trim() || isTyping) return;

    const userMessage = chatValue.trim();
    const newMessages: { role: "user" | "agent"; text: string }[] = [
      ...messages,
      { role: "user", text: userMessage }
    ];

    setMessages(newMessages);
    setChatValue("");
    setIsTyping(true);

    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);

    // Call real API
    const result = await MaverickAPI.sendChatMessage(newMessages, analysisData);

    if (result.success && result.response) {
      setMessages(prev => [...prev, { role: "agent", text: result.response! }]);
    } else {
      setMessages(prev => [...prev, { role: "agent", text: "Desculpe, tive um problema ao processar sua resposta." }]);
    }

    setIsTyping(false);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <FluidOrganism colors={TAB_COLORS['bio']} />
        <div className="z-10 flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="font-display font-medium text-lg animate-pulse text-foreground">
            Analisando @{handle}...
          </p>
        </div>
      </div>
    );
  }

  // Fallback for content to ensure no crashes
  const currentTabContent = analysisData ? (analysisData as any)[activeTab] : { title: "Carregando...", description: "" };
  // Specifically for 'estrategias', we don't have description in the API yet, use hardcoded or generic
  const displayTitle = activeTab === 'estrategias' ? "Estratégias Disruptivas" : currentTabContent?.title;
  const displayDesc = activeTab === 'estrategias' ? "Baseado na análise do seu perfil e tendências atuais, o Maverick selecionou 3 caminhos para viralizar hoje." : currentTabContent?.description;

  return (
    <div className="relative flex flex-col min-h-screen bg-background overflow-x-hidden">
      <FluidOrganism colors={TAB_COLORS[activeTab]} />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between p-4 md:p-6">
        <div className="flex items-center gap-2">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <button className="p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <Menu className="w-5 h-5 text-muted-foreground" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 bg-sidebar border-border/40">
              <AppSidebar />
            </SheetContent>
          </Sheet>
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Bird className="w-5 h-5 text-primary" />
          <span className="font-display text-lg font-bold text-foreground tracking-tight">
            Maverick
          </span>
        </div>
        <div className="w-20" />
      </header>

      {/* Main scrollable content */}
      <main className="relative z-10 flex-1 flex flex-col items-center px-4 pb-8">
        {/* Hero section — Antigravity style */}
        <section className="w-full max-w-3xl mx-auto flex flex-col items-center justify-center min-h-[60vh] py-16">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <p className="text-muted-foreground text-sm mb-4">@{handle}</p>
              <h1 className="font-display text-4xl md:text-6xl font-bold text-foreground tracking-tight mb-6">
                {displayTitle}
              </h1>
              <p className="text-muted-foreground text-sm md:text-base max-w-xl mx-auto leading-relaxed">
                {displayDesc}
              </p>
            </motion.div>
          </AnimatePresence>
        </section>

        {/* Tab bar — fixed bottom-style like Antigravity */}
        <div className="sticky top-4 z-20 mb-16">
          <div className="glass-card p-1.5 rounded-full flex gap-1 overflow-x-auto max-w-full">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap
                    ${isActive
                      ? "bg-foreground text-background shadow-lg"
                      : "text-muted-foreground hover:text-foreground"
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Content based on Active Tab */}
        <section className="w-full max-w-5xl mx-auto mb-24">
          {activeTab === 'estrategias' ? (
            <StrategyCards
              onGenerateScript={handleGenerateScript}
              data={strategiesData}
              loading={isGeneratingStrategies}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Pontos a melhorar */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6 }}
              >
                <h2 className="font-display text-xl md:text-2xl font-bold text-foreground tracking-tight mb-6 text-center">
                  Pontos a Melhorar
                </h2>
                <div className="space-y-3">
                  {analysisData?.pontos_melhoria.map((point, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: i * 0.1 }}
                      className="glass-card p-4 rounded-xl flex items-start gap-3"
                    >
                      <div className="w-7 h-7 rounded-full bg-destructive/15 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-destructive text-xs font-bold">{i + 1}</span>
                      </div>
                      <p className="text-foreground/90 text-sm leading-relaxed">{point}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Pontos fortes */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, delay: 0.15 }}
              >
                <h2 className="font-display text-xl md:text-2xl font-bold text-foreground tracking-tight mb-6 text-center">
                  Pontos Fortes
                </h2>
                <div className="space-y-3">
                  {analysisData?.pontos_fortes.map((point, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: i * 0.1 }}
                      className="glass-card p-4 rounded-xl flex items-start gap-3"
                    >
                      <div className="w-7 h-7 rounded-full bg-success/15 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-success text-xs font-bold">✓</span>
                      </div>
                      <p className="text-foreground/90 text-sm leading-relaxed">{point}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          )}
        </section>

        {/* Chat with agent */}
        <section className="w-full max-w-3xl mx-auto mb-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground tracking-tight mb-6 text-center">
              Converse com o Agente
            </h2>

            {/* Messages */}
            <div className="glass-card rounded-2xl border border-border/50 mb-4 p-4 max-h-80 overflow-y-auto">
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted/60 text-foreground rounded-bl-md"
                        }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed bg-muted/60 text-foreground rounded-bl-md flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce"></span>
                      <span className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                      <span className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Input */}
            <div className="relative glass-card p-1.5 rounded-2xl border border-border/50 focus-within:border-primary/40 transition-colors">
              <textarea
                value={chatValue}
                onChange={(e) => setChatValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSubmit();
                  }
                }}
                placeholder="Faça uma pergunta sobre a análise..."
                rows={1}
                className="w-full bg-transparent text-foreground placeholder:text-muted-foreground text-sm md:text-base px-4 py-3 pr-14 resize-none focus:outline-none"
                style={{ minHeight: 48, maxHeight: 120 }}
              />
              <button
                onClick={handleChatSubmit}
                disabled={!chatValue.trim()}
                className="absolute right-3 bottom-3 w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </section>

        {/* Script Drawer */}
        <ScriptDrawer
          scriptData={currentScript}
          open={scriptDrawerOpen}
          onClose={setScriptDrawerOpen}
        />

        {/* Loading Overlay */}
        {isGenerating && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="glass-card p-8 rounded-2xl flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="font-display font-medium text-lg animate-pulse">Gerando Roteiro Disruptivo...</p>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
