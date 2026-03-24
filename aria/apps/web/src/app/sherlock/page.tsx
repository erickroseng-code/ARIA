'use client';

import { useState, useEffect } from "react";
import { AlertCircle, RefreshCw, Zap, Presentation, Search, Instagram, X, ExternalLink } from "lucide-react";
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

interface InstagramReel {
  url: string;
  title: string;
  views: string;
  views_raw: number;
  keyword: string;
  published_at: string;
}

const PERIOD_OPTIONS = [
  { label: "30 dias", value: 30 },
  { label: "45 dias", value: 45 },
  { label: "60 dias", value: 60 },
  { label: "90 dias", value: 90 },
];

function InstagramModal({ onClose }: { onClose: () => void }) {
  const [keywords, setKeywords] = useState(["", "", ""]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [reels, setReels] = useState<InstagramReel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    const validKeywords = keywords.filter(k => k.trim().length > 0);
    if (!validKeywords.length) return;

    setLoading(true);
    setError(null);
    setSearched(false);

    try {
      const res = await fetch("/api/sherlock/instagram-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: validKeywords, days }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro desconhecido");
      setReels(data.reels || []);
      setSearched(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0d0d0f] border border-white/10 rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
              <Instagram className="w-4 h-4 text-pink-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-base">Pesquisa de Reels</h2>
              <p className="text-white/40 text-[11px]">+100k views · Chrome com sua sessão logada</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5">
          <div className="space-y-3">
            <label className="text-[11px] uppercase tracking-widest text-white/40 font-bold">Keywords (até 3)</label>
            {keywords.map((kw, i) => (
              <input
                key={i}
                value={kw}
                onChange={e => setKeywords(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                placeholder={`Keyword ${i + 1}${i === 0 ? " (obrigatória)" : " (opcional)"}`}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-pink-500/40 transition-colors"
              />
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-widest text-white/40 font-bold">Período</label>
            <div className="flex gap-2">
              {PERIOD_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setDays(opt.value)}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-sm font-medium border transition-colors",
                    days === opt.value
                      ? "bg-pink-500/20 border-pink-500/40 text-pink-300"
                      : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSearch}
            disabled={loading || !keywords.some(k => k.trim())}
            className="w-full py-3 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(236,72,153,0.2)]"
          >
            {loading ? "Abrindo Chrome e pesquisando..." : "Buscar Reels"}
          </button>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {searched && (
          <div className="border-t border-white/5 flex-1 overflow-y-auto p-6 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-widest text-white/40 font-bold">
                Resultados
              </span>
              <span className="text-[11px] text-white/30">{reels.length} Reels encontrados</span>
            </div>

            {reels.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-6">
                Nenhum Reel com +100k views encontrado no período.
              </p>
            ) : (
              reels.map((reel, i) => (
                <a
                  key={i}
                  href={reel.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 rounded-2xl px-4 py-3 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] bg-pink-500/20 text-pink-300 px-2 py-0.5 rounded-full font-medium">
                        #{reel.keyword}
                      </span>
                      <span className="text-[10px] text-emerald-400 font-bold">{reel.views} views</span>
                    </div>
                    <p className="text-white/60 text-xs truncate">{reel.url}</p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-white/20 group-hover:text-white/60 transition-colors shrink-0 ml-3" />
                </a>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SherlockPage() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<TrendReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInstagram, setShowInstagram] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/sherlock/dashboard");
      if (!response.ok) throw new Error(`API retornou ${response.status}`);
      const data = await response.json();
      setReport(data);
    } catch (err: any) {
      setError("Não foi possível conectar ao servidor Sherlock. O backend está rodando?");
    } finally {
      setLoading(false);
    }
  };

  const triggerAgent = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/sherlock/trigger", { method: "POST" });
      if (!response.ok) throw new Error(`API retornou ${response.status}`);
      setTimeout(fetchDashboardData, 1000);
    } catch (err: any) {
      setError("Não foi possível acionar o backend do Sherlock.");
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboardData(); }, []);

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
                isHook ? "bg-violet-500/10 text-white" :
                isCTA ? "bg-emerald-500/10 text-emerald-50" :
                "bg-[#09090A] text-white/90"
              )}
            >
              <div className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-5 transition-opacity group-hover:opacity-10",
                isHook ? "from-violet-500 to-transparent" : isCTA ? "from-emerald-500 to-transparent" : "from-white/20 to-transparent"
              )} />
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4 text-white/40">Slide {index + 1}</div>
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
  };

  return (
    <div className="h-screen w-full overflow-hidden relative bg-background text-white flex">
      <div className="absolute inset-0 bg-gradient-to-br from-[#09090A] via-[#09090A] to-[rgba(139,92,246,0.05)] pointer-events-none" />

      <AriaSidebar activeSquad="sherlock" />

      {showInstagram && <InstagramModal onClose={() => setShowInstagram(false)} />}

      <div className="h-full flex flex-col relative z-10 p-6 lg:p-10 max-w-6xl mx-auto flex-1 overflow-y-auto w-full lg:pl-64">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
                <Search className="w-5 h-5 text-violet-400" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Sherlock</h1>
            </div>
            <p className="text-white/40 text-[13px] ml-13">
              G1 · Google Trends · Reddit · YouTube · X · Instagram
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInstagram(true)}
              className="px-4 py-2.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 text-pink-300 font-medium text-sm transition-colors flex items-center gap-2"
            >
              <Instagram className="w-4 h-4" />
              Pesquisar Reels
            </button>
            <button
              onClick={triggerAgent}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white font-medium text-sm transition-colors shadow-[0_0_15px_rgba(139,92,246,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Executar Pipeline
            </button>
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-white/50 hover:text-white"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-5">
              <div className="relative">
                <div className="w-10 h-10 rounded-full border border-white/10 border-t-violet-500 animate-spin" />
                <div className="absolute inset-0 bg-violet-500 blur-xl opacity-20 animate-pulse" />
              </div>
              <p className="text-white/40 text-sm tracking-wide">Sherlock investigando tendências...</p>
            </div>
          ) : error ? (
            <div className="bg-violet-500/5 border border-violet-500/20 rounded-3xl p-10 flex flex-col items-center justify-center text-center gap-4">
              <AlertCircle className="w-12 h-12 text-violet-400" />
              <div>
                <h3 className="text-lg font-semibold text-white">Falha na Conexão</h3>
                <p className="text-white/50 text-sm mt-1 mb-6 max-w-md mx-auto">{error}</p>
              </div>
              <button onClick={fetchDashboardData} className="px-6 py-2.5 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 rounded-lg transition-colors border border-violet-500/20 text-sm font-medium">
                Tentar novamente
              </button>
            </div>
          ) : report?.status === "waiting" ? (
            <div className="bg-[#09090A] border border-white/5 shadow-2xl rounded-3xl p-16 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center mb-6">
                <Search className="w-8 h-8 text-white/30" />
              </div>
              <h3 className="text-2xl font-semibold mb-3 text-white">Aguardando Investigação</h3>
              <p className="text-white/40 text-sm max-w-lg mb-8 leading-relaxed">
                Nenhum relatório foi processado hoje. O Sherlock executa via GitHub Actions diariamente às 07:00 BRT.
                Dispare manualmente ou pesquise Reels do Instagram com o botão acima.
              </p>
            </div>
          ) : report?.status === "ready" ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

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

                <div className="bg-gradient-to-b from-[#09090A] to-[#09090A] border border-violet-500/20 rounded-3xl p-8 flex-1 shadow-[0_0_40px_rgba(139,92,246,0.05)] relative overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
                  <h3 className="text-xs font-bold uppercase tracking-widest mb-6 text-violet-400 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.8)]" />
                    Ângulo Criativo
                  </h3>
                  <p className="text-[15px] leading-relaxed text-white/80 italic font-light">
                    "{report.mashup}"
                  </p>
                </div>
              </div>

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
