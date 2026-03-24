'use client';

import { useState, useEffect } from "react";
import { AlertCircle, RefreshCw, Zap, Presentation, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import AriaSidebar from "@/components/layout/AriaSidebar";

interface TrendReport {
  status: string;
  message?: string;
  date?: string;
  mashup?: string;
  script?: string;
  top_sources?: string[];
}

export default function TrendMasterPage() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<TrendReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/trendmaster/dashboard");
      if (!response.ok) {
        throw new Error(`API retornou ${response.status}`);
      }
      const data = await response.json();
      setReport(data);
    } catch (err: any) {
      console.error("Erro ao buscar dados do TrendMaster:", err);
      setError("Não foi possível conectar ao servidor Sentinel. O backend do TIE está rodando?");
    } finally {
      setLoading(false);
    }
  };

  const triggerAgent = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/trendmaster/trigger", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`API retornou ${response.status}`);
      }
      setTimeout(fetchDashboardData, 1000); // Fetch the new 'loading' status 1s later
    } catch (err: any) {
      console.error("Erro ao disparar o TrendMaster:", err);
      setError("Não foi possível acionar o backend do TIE.");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const renderSlides = (script: string) => {
    if (!script) return null;
    const slides = script.split(/\[SLIDE \d+\]/).filter(s => s.trim().length > 0);
    
    return (
      <div className="flex overflow-x-auto snap-x space-x-4 pb-6 scrollbar-hidden">
        {slides.map((slideText, index) => {
          const isHook = index === 0;
          const isCTA = index === slides.length - 1;
          
          return (
            <div 
              key={index} 
              className={cn(
                "snap-center shrink-0 w-80 h-96 p-6 rounded-3xl backdrop-blur-md flex flex-col justify-center text-center",
                "border border-white/5 shadow-lg relative overflow-hidden group transition-all duration-300",
                isHook ? "bg-red-500/10 text-white" :
                isCTA ? "bg-emerald-500/10 text-emerald-50" :
                "bg-[#09090A] text-white/90"
              )}
            >
              <div className={cn(
                  "absolute inset-0 bg-gradient-to-br opacity-5 transition-opacity group-hover:opacity-10",
                  isHook ? "from-red-500 to-transparent" : isCTA ? "from-emerald-500 to-transparent" : "from-white/20 to-transparent"
              )} />
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4 text-white/40">
                Slide {index + 1}
              </div>
              <p className={cn(
                "whitespace-pre-wrap flex-1 flex items-center justify-center relative z-10",
                isHook ? "text-xl font-bold" : "text-[15px] font-medium leading-relaxed"
              )}>
                {slideText.trim()}
              </p>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="h-screen w-full overflow-hidden relative bg-background text-white flex">
      <div className="absolute inset-0 bg-gradient-to-br from-[#09090A] via-[#09090A] to-[rgba(239,68,68,0.05)] pointer-events-none" />

      <AriaSidebar activeSquad="trendmaster" />

      <div className="h-full flex flex-col relative z-10 p-6 lg:p-10 max-w-6xl mx-auto flex-1 overflow-y-auto w-full lg:pl-64">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                        <TrendingUp className="w-5 h-5 text-red-400" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">TrendMaster</h1>
                </div>
                <p className="text-white/40 text-[13px] ml-13">Painel de Monitoramento & Inteligência Viral</p>
            </div>

            <div className="flex items-center gap-3">
                <button
                    onClick={triggerAgent}
                    disabled={loading}
                    className="px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium text-sm transition-colors shadow-[0_0_15px_rgba(239,68,68,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Executar Manualmente
                </button>
                <button 
                    onClick={fetchDashboardData}
                    disabled={loading}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-white/50 hover:text-white"
                    title="Sincronizar"
                >
                    <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                </button>
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 space-y-8">
            {loading ? (
                <div className="flex flex-col items-center justify-center h-64 gap-5">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full border border-white/10 border-t-red-500 animate-spin" />
                        <div className="absolute inset-0 bg-red-500 blur-xl opacity-20 animate-pulse" />
                    </div>
                    <p className="text-white/40 text-sm tracking-wide">Consultando motor TIE...</p>
                </div>
            ) : error ? (
                <div className="bg-red-500/5 border border-red-500/20 rounded-3xl p-10 flex flex-col items-center justify-center text-center gap-4">
                    <AlertCircle className="w-12 h-12 text-red-400" />
                    <div>
                        <h3 className="text-lg font-semibold text-white">Falha na Conexão</h3>
                        <p className="text-white/50 text-sm mt-1 mb-6 max-w-md mx-auto">{error}</p>
                    </div>
                    <button 
                    onClick={fetchDashboardData}
                    className="px-6 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors border border-red-500/20 text-sm font-medium"
                    >
                    Tentar novamente
                    </button>
                </div>
            ) : report?.status === "waiting" ? (
                <div className="bg-[#09090A] border border-white/5 shadow-2xl rounded-3xl p-16 flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center mb-6">
                        <TrendingUp className="w-8 h-8 text-white/30" />
                    </div>
                    <h3 className="text-2xl font-semibold mb-3 text-white">Aguardando Captura</h3>
                    <p className="text-white/40 text-sm max-w-lg mb-8 leading-relaxed">
                        Nenhum relatório foi processado hoje. O Agente TIE é engatilhado pelo cronjob. Crie uma trigger manual se necessário.
                    </p>
                </div>
            ) : report?.status === "ready" ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* Left Column: Data & Mashup */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                        <div className="bg-[#09090A] border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/[0.03] to-transparent pointer-events-none" />
                            <div className="flex flex-col gap-6 relative z-10">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-emerald-400" />
                                        Sinais Detectados
                                    </h3>
                                    <span className="text-[10px] uppercase font-bold tracking-widest text-white/30 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                                        {new Date(report.date || "").toLocaleDateString('pt-BR')}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {report.top_sources?.map((src, i) => (
                                        <div key={i} className="px-3 py-1.5 bg-white/5 rounded-lg text-[11px] font-medium tracking-wide text-white/60 border border-white/5">
                                            {src}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-b from-[#09090A] to-[#09090A] border border-red-500/20 rounded-3xl p-8 flex-1 shadow-[0_0_40px_rgba(239,68,68,0.05)] relative overflow-hidden group">
                            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
                            
                            <h3 className="text-xs font-bold uppercase tracking-widest mb-6 text-red-400 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]" />
                                Ângulo Criativo
                            </h3>
                            <p className="text-[15px] leading-relaxed text-white/80 italic font-light">
                                "{report.mashup}"
                            </p>
                        </div>
                    </div>

                    {/* Right Column: Carousel Script */}
                    <div className="lg:col-span-8 flex flex-col gap-4">
                        <div className="flex items-center justify-between ml-2">
                            <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                                <Presentation className="w-4 h-4 text-blue-400" />
                                Copywriter Pro
                            </h3>
                            <span className="text-[10px] uppercase tracking-widest text-white/40">Carrossel / 7 Slides</span>
                        </div>
                        <div className="w-full">
                            {renderSlides(report.script || "")}
                        </div>
                    </div>

                </div>
            ) : null}
        </div>
      </div>
    </div>
  );
}
