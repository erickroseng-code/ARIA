import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Bird, ArrowLeft, CheckCircle2, Zap, TrendingUp,
  Target, Calendar, DollarSign, Play, Image as ImageIcon, LayoutGrid,
  Menu, Search, ArrowUp, Activity, Trophy, AlertTriangle, MessageSquare, Save
} from "lucide-react";
import { motion } from "framer-motion";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "@/components/AppSidebar";
import { ScriptDrawer, ScriptData } from "@/components/ScriptDrawer";
import { MaverickAPI } from "@/services/api";
import { AnalysisLoader } from "@/components/AnalysisLoader";

// ─── Rich Analysis Types ───────────────────────────────────
interface TopPost { rank: number; tipo: string; caption_preview: string; likes: number; comments: number; views: number; taxa_engajamento: string; por_que_funcionou: string; }
interface ContentPillar { nome: string; percentual: string; objetivo: string; formatos: string[]; gatilho_emocional: string; metrica_principal: string; }
interface CalendarDay { dia: string; formato: string; pauta: string; }
interface CalendarWeek { semana: number; tema_foco: string; pautas: CalendarDay[]; }
export interface RichAnalysis {
  resumo_executivo: string;
  metricas: { posts: string; seguidores: string; seguindo: string; bio_atual: string; taxa_engajamento_estimada?: string; foto_perfil?: string | null };
  analise_conteudo?: { top_posts: TopPost[]; padroes_detectados: string; tom_de_voz_atual: string; frequencia_media: string; gap_de_conteudo: string; };
  o_que_funciona: { titulo: string; descricao: string; }[];
  o_que_precisa_mudar: { numero: number; titulo: string; diagnostico: string; embasamento: string; acao_corretiva?: string; livro_referencia: string; }[];
  brief_estrategico?: { posicionamento_ideal: string; content_tilt: string; pilares_conteudo: ContentPillar[]; calendario_4_semanas: CalendarWeek[]; };
  escada_monetizacao?: { nivel_atual: string; seguidores_referencia: string; proximos_passos_monetizacao: string; prazo_estimado: string; };
  acoes_urgentes: { prioridade: number; acao: string; impacto_esperado: string; tempo_necessario?: string; }[];
  pontos_melhoria?: string[];
  pontos_fortes?: string[];
}

// ─── Apple Design Helpers ─────────────────────────────────
const PostTypeIcon = ({ tipo, className }: { tipo: string; className?: string }) => {
  if (tipo?.includes('Video')) return <Play className={`w-3.5 h-3.5 ${className}`} />;
  if (tipo?.includes('Carousel') || tipo?.includes('Carrossel')) return <LayoutGrid className={`w-3.5 h-3.5 ${className}`} />;
  return <ImageIcon className={`w-3.5 h-3.5 ${className}`} />;
};

export const GlassCard = ({ children, className = "", delay = 0, noBorder = false }: { children: React.ReactNode, className?: string, delay?: number, noBorder?: boolean }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    className={`bg-white/80 backdrop-blur-apple rounded-[32px] overflow-hidden ${noBorder ? '' : 'border border-black/5 shadow-sm'} ${className}`}
  >
    {children}
  </motion.div>
);

export const SectionTitle = ({ icon: Icon, title, subtitle }: { icon: any, title: string, subtitle?: string }) => (
  <div className="flex items-center gap-3 mb-6">
    <div className="w-10 h-10 rounded-[14px] bg-[#F2F2F7] border border-black/5 flex items-center justify-center shadow-sm">
      <Icon className="w-5 h-5 text-[#1D1D1F]" strokeWidth={1.5} />
    </div>
    <div>
      <h2 className="text-[18px] font-semibold tracking-tight text-[#1D1D1F]">{title}</h2>
      {subtitle && <p className="text-[13px] text-[#8E8E93] font-medium">{subtitle}</p>}
    </div>
  </div>
);

const monetizationLevels = ["Atenção", "Confiança", "Autoridade", "Escala", "Impacto"];

function getMonetizationIndex(nivel: string) {
  return monetizationLevels.findIndex(l => nivel?.toLowerCase().includes(l.toLowerCase()));
}

// ─── Component ───────────────────────────────────────────────
export default function Analysis() {
  const { handle } = useParams<{ handle: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const snapshotId = searchParams.get("snapshot");

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [analysisData, setAnalysisData] = useState<RichAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [strategiesData, setStrategiesData] = useState<any[]>([]);
  const [scriptDrawerOpen, setScriptDrawerOpen] = useState(false);
  const [currentScript, setCurrentScript] = useState<ScriptData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [creatorProfile, setCreatorProfile] = useState("");
  const [awarenessLevel, setAwarenessLevel] = useState<number>(3);
  const [referencePost, setReferencePost] = useState("");
  const [nicheKeywords, setNicheKeywords] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ id: number; role: "user" | "assistant"; content: string }[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [contentType, setContentType] = useState<'reel_script' | 'carousel_slides' | 'caption' | 'stories_sequence'>('reel_script');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchAnalysis() {
      if (!handle) return;
      setIsLoading(true);
      try {
        if (snapshotId) {
          // Load from cache
          console.log(`[Analysis] Loading snapshot ${snapshotId} from cache`);
          const snapshot = await MaverickAPI.getSnapshot(snapshotId);
          if (snapshot && snapshot.analysis) {
            setAnalysisData(snapshot.analysis as unknown as RichAnalysis);
            if (snapshot.strategies && snapshot.strategies.length > 0) {
              setStrategiesData(snapshot.strategies);
            } else {
              // Backward compatibility if strategies weren't explicitly cached
              const stratResponse = await MaverickAPI.generateStrategy(snapshot.analysis);
              if (stratResponse.success && stratResponse.strategies) setStrategiesData(stratResponse.strategies);
            }
            setIsCached(true);
          } else {
            // Fallback if snapshot not found
            const { analysis: raw, nicheKeywords: kw } = await MaverickAPI.analyzeProfile(handle);
            setAnalysisData(raw as unknown as RichAnalysis);
            setNicheKeywords(kw);
            const stratResponse = await MaverickAPI.generateStrategy(raw);
            if (stratResponse.success && stratResponse.strategies) setStrategiesData(stratResponse.strategies);
          }
        } else {
          // Normal flow (new analysis)
          const { analysis: raw, nicheKeywords: kw } = await MaverickAPI.analyzeProfile(handle);
          setAnalysisData(raw as unknown as RichAnalysis);
          setNicheKeywords(kw);
          const stratResponse = await MaverickAPI.generateStrategy(raw);
          if (stratResponse.success && stratResponse.strategies) setStrategiesData(stratResponse.strategies);
        }

        setChatMessages([{ id: 1, role: "assistant", content: `Olá. Finalizei a auditoria do perfil @${handle}. O que gostaria de explorar em profundidade?` }]);
      } catch (err) {
        console.error("Error fetching analysis:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchAnalysis();
  }, [handle, snapshotId]);

  const handleGenerateContent = async (strategyId: number) => {
    setIsGenerating(true);
    const strategy = strategiesData.find((s: any) => s.id === strategyId);
    if (!strategy) { setIsGenerating(false); return; }

    // Build trend insights from niche keywords + strategy pillars
    const trendInsights = nicheKeywords.map(kw => ({
      example_hook: kw,
      hook_pattern: 'keyword do nicho',
      engagement_signal: 'extraído da análise de perfil'
    }));

    const result = await MaverickAPI.generateContent({
      type: contentType,
      pillar: strategy.title,
      topic: strategy.title,
      analysisContext: analysisData,
      awarenessLevel,
      referencePost,
      trendInsights
    });

    setIsGenerating(false);

    if (result.success && result.content) {
      setCurrentScript({
        title: strategy.title,
        topic: strategy.title,
        hook: strategy.description,
        script: result.content
      });
      setScriptDrawerOpen(true);
    } else {
      alert("Falha ao gerar o conteúdo. Tente novamente.");
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = { id: chatMessages.length + 1, role: "user" as const, content: chatInput.trim() };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const apiMsgs = [...chatMessages, userMessage].map(m => ({ role: m.role === 'assistant' ? 'agent' : m.role, text: m.content }));
      const result = await MaverickAPI.sendChatMessage(apiMsgs as any, analysisData as any);
      if (result.success && result.response) {
        setChatMessages(prev => [...prev, { id: prev.length + 1, role: "assistant", content: result.response }]);
      } else {
        setChatMessages(prev => [...prev, { id: prev.length + 1, role: "assistant", content: "Sistema indisponível temporariamente." }]);
      }
    } catch (error) {
      console.error("Error sending chat message:", error);
      setChatMessages(prev => [...prev, { id: prev.length + 1, role: "assistant", content: "Ocorreu um erro ao processar sua solicitação." }]);
    } finally {
      setIsChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  if (isLoading) return <AnalysisLoader handle={handle || ""} />;

  const d = analysisData;
  if (!d) return <div className="min-h-screen bg-black flex items-center justify-center text-[#8E8E93]">Dados não disponíveis.</div>;

  const monetizIndex = getMonetizationIndex(d.escada_monetizacao?.nivel_atual || "");

  // Apple-style numeric stat card
  const StatItem = ({ label, value, highlight = false }: { label: string, value: string, highlight?: boolean }) => (
    <div className="flex flex-col">
      <span className="text-[12px] font-medium text-[#8E8E93] uppercase tracking-wider mb-1">{label}</span>
      <span className={`text-2xl font-bold tracking-tight ${highlight ? 'text-[#30D158]' : 'text-white'}`}>{value}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-apple-base text-[#1D1D1F] font-sans selection:bg-apple-softBlue/40 pb-32">
      {/* ── Spotlight Header ── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-apple border-b border-black/5 px-6 py-4 flex items-center justify-between">

        <div className="flex items-center gap-4">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <button className="p-2.5 rounded-2xl bg-[#F2F2F7]/50 backdrop-blur-apple border border-black/5 text-[#1D1D1F] hover:bg-[#F2F2F7] active:scale-95 transition-all shadow-sm hidden md:flex">
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-white/95 backdrop-blur-apple border-r border-black/5">
              <AppSidebar />
            </SheetContent>
          </Sheet>

          <button onClick={() => navigate("/")} className="hidden md:flex p-2.5 rounded-2xl bg-[#F2F2F7]/50 backdrop-blur-apple border border-black/5 text-[#1D1D1F] hover:bg-[#F2F2F7] active:scale-95 transition-all shadow-sm">
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 ml-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-apple-softBlue to-apple-gold shadow-sm flex items-center justify-center p-0.5 border border-black/5">
              {d.metricas.foto_perfil ? (
                <img src={d.metricas.foto_perfil} alt={handle} className="w-full h-full rounded-full object-cover border border-white" />
              ) : (
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                  <span className="text-[10px] font-bold text-[#1D1D1F]">{handle?.substring(0, 2).toUpperCase()}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold text-[#1D1D1F] tracking-tight leading-none">@{handle}</span>
              <span className="text-[11px] text-[#8E8E93] font-medium tracking-wide flex items-center gap-1 mt-1">
                {isCached ? (
                  <><Save className="w-3 h-3 text-apple-primary" /> HISTÓRICO</>
                ) : (
                  <><Activity className="w-3 h-3 text-[#34C759]" /> AUDITORIA ATIVA</>
                )}
              </span>
            </div>
          </div>
        </div>
        <div className="w-16" />
      </header>

      <main className="max-w-[1200px] mx-auto px-4 mt-8 md:mt-12">
        {/* ── BENTO GRID ── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-6">

          {/* 1. Profile Identity Card (Spans 12 or 8) */}
          <GlassCard className="md:col-span-8 p-8 flex flex-col md:flex-row items-start md:items-center gap-6" delay={0.1}>
            <div className="relative shrink-0">
              {d.metricas?.foto_perfil ? (
                <img src={d.metricas.foto_perfil} alt={handle} className="w-24 h-24 rounded-full border border-black/5 shadow-sm object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="w-24 h-24 rounded-full bg-[#F2F2F7] border border-black/5 flex items-center justify-center text-3xl font-bold text-[#8E8E93]">{handle?.charAt(0).toUpperCase() || 'M'}</div>
              )}
              <div className={`absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white border border-black/5 flex items-center justify-center backdrop-blur-md shadow-sm ${isCached ? 'text-apple-primary' : 'text-[#34C759]'}`}>
                {isCached ? <Save className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold tracking-tight text-[#1D1D1F] mb-2">@{handle}</h1>
              {d.metricas?.bio_atual && d.metricas.bio_atual !== 'N/A' && (
                <p className="text-[#8E8E93] text-[15px] leading-relaxed mb-6 max-w-xl line-clamp-2">{d.metricas.bio_atual}</p>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                {d.metricas?.seguidores && <StatItem label="Seguidores" value={d.metricas.seguidores} />}
                {d.metricas?.posts && <StatItem label="Publicações" value={d.metricas.posts} />}
                {d.metricas?.seguindo && <StatItem label="Seguindo" value={d.metricas.seguindo} />}
                {d.metricas?.taxa_engajamento_estimada && <StatItem label="Health Score" value={d.metricas.taxa_engajamento_estimada} highlight />}
              </div>
            </div>
          </GlassCard>

          {/* 2. Executive Summary (Spans 4) */}
          <GlassCard className="md:col-span-4 p-8 flex flex-col justify-center" delay={0.2}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-apple-softBlue/20 rounded-xl text-apple-primary"><Bird className="w-5 h-5" /></div>
              <h3 className="text-[14px] font-bold text-[#1D1D1F] uppercase tracking-wider">Executive Summary</h3>
            </div>
            <p className="text-[15px] font-medium leading-relaxed text-[#3A3A3C]">
              {d.resumo_executivo}
            </p>
          </GlassCard>

          {/* 3. Monetization Ladder (Spans 12) */}
          {d.escada_monetizacao && (
            <GlassCard className="md:col-span-12 p-8" delay={0.3}>
              <SectionTitle icon={DollarSign} title="Escada de Monetização" subtitle="Caminho projetado para escala comercial no perfil" />

              <div className="flex justify-between items-center relative my-10 max-w-4xl mx-auto">
                {/* Progress line */}
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-[#E5E5EA] rounded-full z-0 overflow-hidden">
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-[#34C759] transition-all duration-1000 ease-out"
                    style={{ width: `${(monetizIndex / (monetizationLevels.length - 1)) * 100}%` }}
                  />
                </div>

                {monetizationLevels.map((level, i) => {
                  const isActive = i === monetizIndex;
                  const isPast = i < monetizIndex;
                  return (
                    <div key={level} className="relative z-10 flex flex-col items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 shadow-sm border
                           ${isActive ? 'bg-[#34C759] border-4 border-white scale-125' :
                            isPast ? 'bg-[#34C759] border-[3px] border-white' : 'bg-[#E5E5EA] border-2 border-[#D1D1D6]'}`}
                      >
                        {isActive ? <div className="w-2.5 h-2.5 bg-white rounded-full" /> :
                          isPast ? <CheckCircle2 className="w-5 h-5 text-white" /> : null}
                      </div>
                      <span className={`text-[12px] font-semibold tracking-wide ${isActive ? 'text-[#1D1D1F]' : 'text-[#8E8E93]'}`}>{level}</span>
                    </div>
                  );
                })}
              </div>

              <div className="bg-[#F2F2F7]/50 rounded-[24px] p-6 border border-black/5 flex flex-col md:flex-row gap-6 md:gap-12 md:items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[12px] font-bold uppercase tracking-wider text-[#FF9500]">Nível Atual</span>
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-[#1D1D1F] mb-2">{d.escada_monetizacao.nivel_atual}</h3>
                  <p className="text-[14px] text-[#8E8E93] italic line-clamp-2">"Benchmarking: {d.escada_monetizacao.seguidores_referencia}"</p>
                </div>

                <div className="hidden md:flex flex-col items-center justify-center shrink-0">
                  <div className="w-10 h-10 rounded-full bg-apple-gold/20 flex items-center justify-center">
                    <ArrowUp className="w-5 h-5 text-apple-gold rotate-45" />
                  </div>
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[12px] font-bold uppercase tracking-wider text-[#34C759]">Próximo Salto</span>
                  </div>
                  <p className="text-[15px] font-medium text-[#1D1D1F] leading-snug mb-2">{d.escada_monetizacao.proximos_passos_monetizacao}</p>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1D1D1F]/5 border border-[#1D1D1F]/10">
                    <Calendar className="w-3.5 h-3.5 text-[#1D1D1F]" />
                    <span className="text-[12px] font-semibold text-[#1D1D1F]">{d.escada_monetizacao.prazo_estimado}</span>
                  </div>
                </div>
              </div>
            </GlassCard>
          )}

          {/* 4. Content Analysis: Top Posts (Spans 8) */}
          {d.analise_conteudo?.top_posts && d.analise_conteudo.top_posts.length > 0 && (
            <GlassCard className="md:col-span-8 p-8" delay={0.4}>
              <SectionTitle icon={Trophy} title="Top Posts por Engajamento" subtitle="Métricas baseadas nos últimos dados extraídos" />

              <div className="space-y-4">
                {Array.isArray(d.analise_conteudo.top_posts) && d.analise_conteudo.top_posts.slice(0, 3).map((post: any, i: number) => (
                  <div key={i} className="flex flex-col sm:flex-row gap-4 p-5 rounded-[20px] bg-[#F2F2F7]/50 border border-black/5 hover:bg-[#F2F2F7] transition-colors">
                    <div className="flex flex-col items-center justify-center shrink-0 w-12 h-12 rounded-2xl"
                      style={{ background: i === 0 ? 'rgba(212, 179, 164, 0.2)' : i === 1 ? 'rgba(181, 223, 239, 0.3)' : 'rgba(142, 142, 147, 0.15)' }}>
                      <span className="text-xl font-bold" style={{ color: i === 0 ? '#C49B88' : i === 1 ? '#8DBFD9' : '#8E8E93' }}>#{i + 1}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-black/5 shadow-sm">
                          <PostTypeIcon tipo={post.tipo} className="text-[#8E8E93]" />
                          <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wide">{post.tipo || "POST"}</span>
                        </div>
                        <span className="text-[13px] font-bold text-[#34C759]">{post.taxa_engajamento || "-"}</span>
                      </div>
                      <p className="text-[15px] font-medium text-[#1D1D1F] leading-snug mb-3 line-clamp-2">"{post.caption_preview || ""}"</p>

                      <div className="flex items-center gap-4 text-[13px] font-semibold text-[#8E8E93] mb-4">
                        {post.likes > 0 && <span>{post.likes.toLocaleString()} curtidas</span>}
                        {post.comments > 0 && <span>{post.comments.toLocaleString()} comentários</span>}
                      </div>

                      <div className="bg-white rounded-xl p-4 border border-black/5 shadow-sm">
                        <p className="text-[12px] font-bold text-[#8E8E93] uppercase tracking-wider mb-1">Por que funcionou</p>
                        <p className="text-[14px] text-[#3A3A3C] font-medium leading-relaxed">{post.por_que_funcionou || "Engajamento orgânico alto."}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* 5. Patterns & Tone (Spans 4) */}
          {d.analise_conteudo && (
            <GlassCard className="md:col-span-4 p-8 flex flex-col gap-6" delay={0.5}>
              <SectionTitle icon={Search} title="Padrões Críticos" />

              <div className="flex flex-col gap-5">
                {d.analise_conteudo.gap_de_conteudo && typeof d.analise_conteudo.gap_de_conteudo === 'string' && (
                  <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/20 rounded-2xl p-5">
                    <p className="text-[12px] font-bold text-[#FF3B30] uppercase tracking-wider mb-2">Gap de Mercado Identificado</p>
                    <p className="text-[14px] text-[#1D1D1F] leading-relaxed font-semibold">{d.analise_conteudo.gap_de_conteudo}</p>
                  </div>
                )}

                {d.analise_conteudo.padroes_detectados && typeof d.analise_conteudo.padroes_detectados === 'string' && (
                  <div>
                    <p className="text-[12px] font-bold text-[#8E8E93] uppercase tracking-wider mb-2">Formatos Dominantes</p>
                    <p className="text-[14px] text-[#3A3A3C] font-medium leading-relaxed">{d.analise_conteudo.padroes_detectados}</p>
                  </div>
                )}

                {d.analise_conteudo.tom_de_voz_atual && (
                  <div>
                    <p className="text-[12px] font-bold text-[#8E8E93] uppercase tracking-wider mb-2">Tom de Voz</p>
                    <div className="flex flex-wrap gap-2">
                      {(Array.isArray(d.analise_conteudo.tom_de_voz_atual) ? d.analise_conteudo.tom_de_voz_atual : typeof d.analise_conteudo.tom_de_voz_atual === 'string' ? d.analise_conteudo.tom_de_voz_atual.split(/[,·/]/) : []).map((t: string, i: number) => (
                        <span key={i} className="bg-white shadow-sm border border-black/5 text-[#1D1D1F] font-semibold text-[13px] px-3 py-1.5 rounded-full">{(t || "").trim()}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>
          )}

          {/* 6. Strategic Brief (Spans 12) */}
          {d.brief_estrategico && (
            <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-6 mt-4">
              {/* 6.1 Tilt & Positioning (Spans 5) */}
              <GlassCard className="md:col-span-12 p-8" delay={0.6}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div>
                    <SectionTitle icon={Target} title="Posicionamento & Tilt" subtitle="O diferencial estratégico" />
                    <div className="space-y-6">
                      <div>
                        <p className="text-[12px] font-bold text-[#8E8E93] uppercase tracking-wider mb-2">Posicionamento Ideal</p>
                        <p className="text-[15px] text-[#1D1D1F] font-semibold leading-relaxed">{d.brief_estrategico.posicionamento_ideal}</p>
                      </div>
                      <div className="bg-gradient-to-br from-apple-softBlue/20 to-apple-gold/20 rounded-[20px] p-6 border border-black/5 shadow-sm">
                        <p className="text-[12px] font-bold text-apple-primary uppercase tracking-wider mb-2">Content Tilt (Diferencial)</p>
                        <p className="text-[16px] font-bold text-[#1D1D1F] leading-snug">{d.brief_estrategico.content_tilt}</p>
                        <p className="text-[12px] text-[#8E8E93] mt-3 font-semibold">Ref: Filosofia Content Inc.</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    {Array.isArray(d.brief_estrategico.pilares_conteudo) && (
                      <div>
                        <p className="text-[12px] font-bold text-[#8E8E93] uppercase tracking-wider mb-3">Pilares Editoriais</p>
                        <div className="space-y-3">
                          {d.brief_estrategico.pilares_conteudo.map((p: any, i: number) => (
                            <div key={i} className="flex justify-between items-center bg-[#F2F2F7]/50 border border-black/5 p-4 rounded-[16px] shadow-sm">
                              <div>
                                <p className="text-[14px] font-bold text-[#1D1D1F]">{p.nome || "Pilar Estratégico"}</p>
                                <p className="text-[12px] text-[#8E8E93] font-medium mt-0.5">{p.objetivo || ""}</p>
                              </div>
                              <span className="text-[14px] font-extrabold text-[#007AFF]">{p.percentual || "%"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </GlassCard>

              {/* 6.2 Calendar (Spans 7) */}
              {Array.isArray(d.brief_estrategico.calendario_4_semanas) && (
                <GlassCard className="md:col-span-12 p-0 overflow-hidden flex flex-col" delay={0.7}>
                  <div className="p-8 pb-4 border-b border-black/5">
                    <SectionTitle icon={Calendar} title="Editorial de 4 Semanas" subtitle="Visão panorâmica acionável" />
                  </div>

                  <div className="flex-1 overflow-x-auto p-8 pt-0 custom-scrollbar">
                    <div className="flex gap-4 w-max pt-6">
                      {d.brief_estrategico.calendario_4_semanas.map((week: any, wi: number) => (
                        <div key={wi} className="w-[280px] shrink-0 bg-[#F2F2F7] border border-black/5 rounded-[20px] overflow-hidden flex flex-col shadow-sm">
                          <div className="bg-white px-4 py-3 border-b border-black/5">
                            <h4 className="text-[13px] font-extrabold text-[#1D1D1F] uppercase tracking-wider">Semana {week.semana || wi + 1}</h4>
                            <p className="text-[13px] font-medium text-[#8E8E93] truncate">{week.tema_foco || "Foco Semanal"}</p>
                          </div>
                          <div className="p-3 space-y-2 flex-1">
                            {Array.isArray(week.pautas) ? week.pautas.map((pauta: any, pi: number) => (
                              <div key={pi} className="bg-white shadow-sm rounded-xl p-3 border border-black/5">
                                <div className="flex justify-between items-start mb-2">
                                  <span className="text-[11px] font-bold text-[#1D1D1F] bg-[#1D1D1F]/5 border border-black/5 px-2.5 py-0.5 rounded-full">{pauta.dia || "Dia"}</span>
                                  <span className="text-[11px] font-bold text-[#007AFF]">{pauta.formato || "Post"}</span>
                                </div>
                                <p className="text-[13px] text-[#3A3A3C] font-medium leading-relaxed">{pauta.pauta}</p>
                              </div>
                            )) : (
                              <div className="text-sm text-[#8E8E93] p-2">Sem pautas detalhadas.</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </GlassCard>
              )}
            </div>
          )}

          {/* 7. Action Items (Spans 6 each) */}
          <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 mt-4">
            {/* Urgent Fixes */}
            <GlassCard className="p-8" delay={0.8}>
              <SectionTitle icon={AlertTriangle} title="Auditoria: Correções Urgentes" subtitle="O que está afundando a performance" />
              <div className="space-y-4">
                {Array.isArray(d.o_que_precisa_mudar) ? d.o_que_precisa_mudar.slice(0, 4).map((item: any, i: number) => (
                  <div key={i} className="flex gap-4">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-[#FF3B30]/10 text-[#FF3B30] flex items-center justify-center font-bold text-[13px]">
                      {item.numero || i + 1}
                    </div>
                    <div>
                      <p className="text-[15px] font-bold text-[#1D1D1F] mb-1">{item.titulo || "Ponto de Atenção"}</p>
                      <p className="text-[13px] text-[#8E8E93] font-medium leading-relaxed mb-2">{item.diagnostico || ""}</p>
                      <div className="bg-[#FF3B30]/10 rounded-lg px-3 py-2 border border-[#FF3B30]/20">
                        <p className="text-[12px] text-[#FF3B30] font-bold">Ação: {item.acao_corretiva || "Revisão imediata necessária"}</p>
                      </div>
                    </div>
                  </div>
                )) : (
                  <p className="text-[14px] text-[#1D1D1F]">Consulte os pontos de melhoria na visão geral.</p>
                )}
              </div>
            </GlassCard>

            {/* What works */}
            <GlassCard className="p-8" delay={0.9}>
              <SectionTitle icon={CheckCircle2} title="Ações Validadas" subtitle="O que continuar fazendo" />
              <div className="space-y-4">
                {Array.isArray(d.o_que_funciona) ? d.o_que_funciona.slice(0, 4).map((item: any, i: number) => (
                  <div key={i} className="flex gap-4 bg-[#34C759]/10 border border-[#34C759]/20 rounded-[20px] p-5 shadow-sm">
                    <CheckCircle2 className="shrink-0 w-5 h-5 text-[#34C759]" />
                    <div>
                      <p className="text-[15px] font-bold text-[#1D1D1F] mb-1">{item.titulo || "Acerto Estratégico"}</p>
                      <p className="text-[13px] font-medium text-[#3A3A3C] leading-relaxed">{item.descricao || ""}</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-[14px] text-[#1D1D1F]">Consulte os pontos fortes na visão geral.</p>
                )}
              </div>
            </GlassCard>
          </div>

          {/* 8. AI Generator Configuration (Spans 12) */}
          {strategiesData.length > 0 && (
            <GlassCard className="md:col-span-12 p-8 mt-4 border-apple-softBlue/40 shadow-[0_8px_30px_rgba(181,223,239,0.3)] overflow-visible" delay={1}>
              <SectionTitle icon={Zap} title="Bancada de Criação (RAG)" subtitle="Gere roteiros profundos baseados nos pilares aprovados" />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Config Form */}
                <div className="lg:col-span-4 space-y-5">
                  <div>
                    <label className="block text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-2">Formato de Saída</label>
                    <select
                      value={contentType}
                      onChange={e => setContentType(e.target.value as any)}
                      className="w-full bg-[#F2F2F7] border border-black/5 rounded-xl px-4 py-3 text-[14px] text-[#1D1D1F] focus:outline-none focus:border-apple-softBlue transition-colors appearance-none shadow-sm font-semibold"
                    >
                      <option value="reel_script">🎬 Roteiro de Vídeo Curto</option>
                      <option value="carousel_slides">📸 Carrossel Educativo</option>
                      <option value="caption">✍️ Legenda Longa (Copy)</option>
                      <option value="stories_sequence">📱 Sequência de Stories</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-2">Nível de Consciência</label>
                    <select
                      value={awarenessLevel}
                      onChange={e => setAwarenessLevel(Number(e.target.value))}
                      className="w-full bg-[#F2F2F7] border border-black/5 rounded-xl px-4 py-3 text-[14px] text-[#1D1D1F] focus:outline-none focus:border-apple-softBlue transition-colors appearance-none shadow-sm"
                    >
                      <option value={1}>1. Inconsciente — foco no sintoma</option>
                      <option value={2}>2. Consciente do Problema — agite a dor</option>
                      <option value={3}>3. Consciente da Solução — apresente mecanismo</option>
                      <option value={4}>4. Consciente do Produto — diferencie</option>
                      <option value={5}>5. Totalmente Consciente — viés de oferta</option>
                    </select>
                  </div>

                  <div>
                    <label className="flex justify-between items-center text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-2">
                      <span>Voice Calibration</span>
                      <span className="text-[10px] bg-apple-softBlue/20 text-apple-primary px-2 py-0.5 rounded-full">Recomendado</span>
                    </label>
                    <textarea
                      value={referencePost}
                      onChange={e => setReferencePost(e.target.value)}
                      placeholder="Cole um post seu de sucesso. O modelo clonará seu ritmo e vocabulário."
                      rows={4}
                      className="w-full bg-white border border-black/5 rounded-xl px-4 py-3 text-[14px] text-[#1D1D1F] placeholder:text-[#8E8E93] focus:outline-none focus:border-apple-softBlue transition-colors resize-none shadow-sm"
                    />
                  </div>
                </div>

                {/* Strategy List */}
                <div className="lg:col-span-8 flex flex-col gap-3">
                  <p className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1">Pautas Validadas & Geração</p>
                  {strategiesData.map((strategy: any) => (
                    <div key={strategy.id} className="bg-[#F2F2F7]/50 border border-black/5 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group hover:bg-[#F2F2F7] transition-all shadow-sm">
                      <div className="flex-1">
                        <h4 className="font-semibold text-[15px] text-[#1D1D1F] group-hover:text-apple-primary transition-colors">{strategy.title}</h4>
                        <p className="text-[13px] text-[#8E8E93] mt-1 line-clamp-2 md:line-clamp-1">{strategy.description}</p>
                      </div>
                      <button
                        onClick={() => handleGenerateContent(strategy.id)}
                        disabled={isGenerating}
                        className="w-full sm:w-auto shrink-0 px-5 py-2.5 rounded-xl text-[14px] font-semibold bg-[#1D1D1F] text-white hover:bg-black active:scale-95 transition-all disabled:opacity-40 disabled:hover:scale-100 shadow-sm flex items-center justify-center gap-2"
                      >
                        <Zap className="w-4 h-4 text-apple-gold" />
                        Gerar {contentType === 'reel_script' ? 'Roteiro' : contentType === 'carousel_slides' ? 'Carrossel' : contentType === 'caption' ? 'Legenda' : 'Stories'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </GlassCard>
          )}

          {/* 9. Chat (Spans 12) */}
          <GlassCard className="md:col-span-12 p-0 flex flex-col mt-4 border-black/5 h-[500px]" delay={1.1}>
            <div className="p-6 border-b border-black/5 bg-white shrink-0">
              <SectionTitle icon={MessageSquare} title="Strategist Copilot" subtitle="Aprofunde a análise conversando com a IA." />
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-[#F5F5F7]/30">
              {chatMessages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center text-[#8E8E93]">
                  <Bird className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-[14px] font-medium">Pergunte mais sobre o funil de {handle}, ideias de conteúdo ou táticas de growth.</p>
                </div>
              )}
              {chatMessages.map(msg => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-apple-softBlue flex items-center justify-center shrink-0 shadow-sm border border-black/5">
                      <Bird className="w-4 h-4 text-[#1D1D1F]" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm border ${msg.role === 'user'
                    ? 'bg-[#1D1D1F] text-white border-transparent rounded-tr-sm'
                    : 'bg-white text-[#1D1D1F] border-black/5 rounded-tl-sm'
                    }`}>
                    {msg.role === 'assistant' ? (
                      <div className="text-[15px] space-y-4 leading-relaxed font-medium text-[#1D1D1F] whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    ) : (
                      <p className="text-[15px] font-medium leading-relaxed">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-apple-softBlue flex items-center justify-center shrink-0 shadow-sm border border-black/5">
                    <Bird className="w-4 h-4 text-[#1D1D1F]" />
                  </div>
                  <div className="bg-white border-black/5 border rounded-2xl rounded-tl-sm p-4 text-[#8E8E93] shadow-sm">
                    <span className="animate-pulse flex items-center gap-1 font-medium">
                      Pensando
                      <span className="flex gap-0.5 ml-1">
                        <span className="w-1 h-1 bg-[#8E8E93] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1 h-1 bg-[#8E8E93] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1 h-1 bg-[#8E8E93] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    </span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-4 border-t border-black/5 bg-white shrink-0">
              <form onSubmit={handleSendChat} className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  disabled={isChatLoading}
                  placeholder="Pergunte ao Strategist..."
                  className="flex-1 bg-[#F5F5F7] text-[#1D1D1F] font-medium placeholder:text-[#8E8E93] rounded-xl px-4 py-3 outline-none border hover:border-black/5 focus:border-apple-softBlue/50 focus:bg-white transition-all shadow-sm"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isChatLoading}
                  className="px-6 py-3 bg-[#1D1D1F] text-white font-semibold rounded-xl hover:bg-black active:scale-95 disabled:opacity-50 transition-all shadow-sm"
                >
                  Enviar
                </button>
              </form>
            </div>
          </GlassCard>

        </div>
      </main>

      {/* Script Drawer */}
      <ScriptDrawer scriptData={currentScript} open={scriptDrawerOpen} onClose={setScriptDrawerOpen} />

      {/* Generating overlay */}
      {isGenerating && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-xl z-50 flex items-center justify-center">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white border border-black/5 p-10 rounded-[32px] flex flex-col items-center gap-6 shadow-xl">
            <div className="w-12 h-12 border-[4px] border-[#F2F2F7] border-t-apple-softBlue rounded-full animate-spin shadow-sm" />
            <div className="text-center">
              <p className="font-bold text-[17px] text-[#1D1D1F] tracking-tight mb-1">Clonando voz e gerando peça</p>
              <p className="text-[13px] font-medium text-[#8E8E93]">Modelo de dupla passagem em curso...</p>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
