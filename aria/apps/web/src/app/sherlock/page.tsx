'use client';

import { useState } from "react";
import { AlertCircle, RefreshCw, Zap, Presentation, Search, Instagram, X, ExternalLink, Play } from "lucide-react";
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

function LogoG1() {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="40" height="40" rx="8" fill="#E3002B"/>
      <text x="20" y="27" textAnchor="middle" fill="white" fontFamily="Arial Black, Arial" fontWeight="900" fontSize="17">G1</text>
    </svg>
  );
}

function LogoGoogleTrends() {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="40" height="40" rx="8" fill="#fff"/>
      <path d="M28.6 20.2c0-.6-.1-1.2-.2-1.8H20v3.4h4.8c-.2 1.1-.9 2-1.9 2.6v2.2h3.1c1.8-1.7 2.6-4.1 2.6-6.4z" fill="#4285F4"/>
      <path d="M20 29c2.4 0 4.5-.8 6-2.2l-3.1-2.2c-.8.6-1.8.9-2.9.9-2.2 0-4.1-1.5-4.8-3.5H12v2.3C13.5 27.3 16.6 29 20 29z" fill="#34A853"/>
      <path d="M15.2 22c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2v-2.3H12C11.4 17.1 11 18.5 11 20s.4 2.9 1 4.3l3.2-2.3z" fill="#FBBC05"/>
      <path d="M20 14.5c1.2 0 2.3.4 3.2 1.2l2.4-2.4C24.5 12 22.4 11 20 11c-3.4 0-6.5 1.7-8 4.7l3.2 2.3c.7-2 2.6-3.5 4.8-3.5z" fill="#EA4335"/>
    </svg>
  );
}

function LogoReddit() {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="40" height="40" rx="8" fill="#FF4500"/>
      <circle cx="20" cy="21" r="10" fill="white"/>
      <circle cx="16.5" cy="21" r="1.5" fill="#FF4500"/>
      <circle cx="23.5" cy="21" r="1.5" fill="#FF4500"/>
      <path d="M16 24.5c1 1 6 1 8 0" stroke="#FF4500" strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="26" cy="13" r="2" fill="white"/>
      <line x1="20" y1="12" x2="26" y2="13" stroke="white" strokeWidth="1.5"/>
      <circle cx="26" cy="13" r="1.2" fill="#FF4500"/>
      <path d="M30 17c0-1.1-.9-2-2-2s-2 .9-2 2c0 .7.4 1.3.9 1.7-.1.4-.1.7-.1 1.1 0 4.4-4.9 8-11 8S5 26.2 5 21.8c0-.4 0-.8-.1-1.1.5-.4.9-1 .9-1.7 0-1.1-.9-2-2-2s-2 .9-2 2c0 .8.5 1.5 1.1 1.8C2.7 27 10.6 32 20 32s17.3-5 17.9-11.2c.6-.3 1.1-1 1.1-1.8z" fill="none"/>
      <path d="M31 16.5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0z" fill="#FF4500"/>
      <path d="M14 16.5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0z" fill="#FF4500"/>
    </svg>
  );
}

function LogoYouTube() {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="40" height="40" rx="8" fill="#FF0000"/>
      <path d="M31.7 14.8c-.4-1.4-1.5-2.4-2.9-2.8C26.5 11.5 20 11.5 20 11.5s-6.5 0-8.8.6c-1.4.4-2.5 1.4-2.9 2.8C7.7 17 7.7 20 7.7 20s0 3 .6 5.2c.4 1.4 1.5 2.4 2.9 2.8 2.3.6 8.8.6 8.8.6s6.5 0 8.8-.6c1.4-.4 2.5-1.4 2.9-2.8.6-2.2.6-5.2.6-5.2s0-3-.6-5.2z" fill="white" fillOpacity="0.2"/>
      <path d="M17.5 24.5v-9l8 4.5-8 4.5z" fill="white"/>
    </svg>
  );
}

function LogoInstagram() {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id="ig-grad" x1="0" y1="40" x2="40" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFDC80"/>
          <stop offset="25%" stopColor="#FCAF45"/>
          <stop offset="50%" stopColor="#F77737"/>
          <stop offset="75%" stopColor="#C13584"/>
          <stop offset="100%" stopColor="#833AB4"/>
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#ig-grad)"/>
      <rect x="10" y="10" width="20" height="20" rx="6" stroke="white" strokeWidth="2" fill="none"/>
      <circle cx="20" cy="20" r="5" stroke="white" strokeWidth="2" fill="none"/>
      <circle cx="26.5" cy="13.5" r="1.5" fill="white"/>
    </svg>
  );
}

function LogoTikTok() {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="40" height="40" rx="8" fill="#010101"/>
      <path d="M28 15.5c-1.7 0-3-1.3-3-3V9h-3v15.5c0 1.4-1.1 2.5-2.5 2.5S17 25.9 17 24.5s1.1-2.5 2.5-2.5c.3 0 .5 0 .8.1V19c-.3 0-.5-.1-.8-.1-3 0-5.5 2.5-5.5 5.5S16.5 30 19.5 30 25 27.5 25 24.5V18c1 .7 2.2 1 3.5 1v-3c-.2 0-.3 0-.5 0z" fill="#EE1D52"/>
      <path d="M27 15.5c-1.7 0-3-1.3-3-3V9h-3v15.5c0 1.4-1.1 2.5-2.5 2.5S16 25.9 16 24.5s1.1-2.5 2.5-2.5c.3 0 .5 0 .8.1V19c-.3 0-.5-.1-.8-.1-3 0-5.5 2.5-5.5 5.5S15.5 30 18.5 30 24 27.5 24 24.5V18c1 .7 2.2 1 3.5 1v-3c-.2 0-.3 0-.5 0z" fill="#69C9D0"/>
      <path d="M27.5 15.5c-1.7 0-3-1.3-3-3V9h-3v15.5c0 1.4-1.1 2.5-2.5 2.5S16.5 25.9 16.5 24.5s1.1-2.5 2.5-2.5c.3 0 .5 0 .8.1V19c-.3 0-.5-.1-.8-.1-3 0-5.5 2.5-5.5 5.5S16 30 19 30 24.5 27.5 24.5 24.5V18c1 .7 2.2 1 3.5 1v-3c-.2 0-.3 0-.5 0z" fill="white"/>
    </svg>
  );
}

function LogoX() {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="40" height="40" rx="8" fill="#000"/>
      <path d="M22.3 18.5L29.5 10h-1.7l-6.2 7.2L16.5 10H11l7.5 10.9L11 30h1.7l6.6-7.6 5.2 7.6H30L22.3 18.5zm-2.3 2.7l-.8-1.1-6.1-8.7h2.6l4.9 7 .8 1.1 6.3 9h-2.6l-5.1-7.3z" fill="white"/>
    </svg>
  );
}

const SOURCE_LOGOS: Record<string, React.ReactNode> = {
  g1:            <LogoG1 />,
  google_trends: <LogoGoogleTrends />,
  reddit:        <LogoReddit />,
  youtube:       <LogoYouTube />,
  instagram:     <LogoInstagram />,
  tiktok:        <LogoTikTok />,
  x:             <LogoX />,
};

const SOURCES = [
  { id: "g1",            label: "G1 News",       description: "Notícias do G1",          color: "blue" },
  { id: "google_trends", label: "Google Trends",  description: "Tendências de busca",     color: "yellow" },
  { id: "reddit",        label: "Reddit",          description: "r/brasil, investimentos", color: "orange" },
  { id: "youtube",       label: "YouTube",         description: "Vídeos em alta",          color: "red" },
  { id: "instagram",     label: "Instagram",       description: "Posts e Reels",           color: "pink" },
  { id: "tiktok",        label: "TikTok",          description: "Vídeos virais",           color: "teal" },
  { id: "x",             label: "X / Twitter",     description: "Trending topics",         color: "white" },
];

const colorMap: Record<string, string> = {
  blue:   "border-blue-500/40 bg-blue-500/10 text-blue-300",
  yellow: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300",
  orange: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  red:    "border-red-500/40 bg-red-500/10 text-red-300",
  pink:   "border-pink-500/40 bg-pink-500/10 text-pink-300",
  teal:   "border-teal-500/40 bg-teal-500/10 text-teal-300",
  white:  "border-white/20 bg-white/5 text-white/70",
};

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
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set(SOURCES.map(s => s.id)));
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<TrendReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInstagram, setShowInstagram] = useState(false);

  const toggleSource = (id: string) => {
    setSelectedSources(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedSources.size === SOURCES.length) {
      setSelectedSources(new Set());
    } else {
      setSelectedSources(new Set(SOURCES.map(s => s.id)));
    }
  };

  const fetchDashboardData = async () => {
    try {
      const response = await fetch("/api/sherlock/dashboard");
      if (!response.ok) throw new Error(`API retornou ${response.status}`);
      const data = await response.json();
      setReport(data);
    } catch {
      // silently ignore polling errors
    }
  };

  const triggerAgent = async () => {
    if (selectedSources.size === 0) return;
    setRunning(true);
    setError(null);
    setReport(null);

    try {
      const response = await fetch("/api/sherlock/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: Array.from(selectedSources) }),
      });
      if (!response.ok) throw new Error(`API retornou ${response.status}`);

      // poll every 10s until report arrives (GitHub Actions takes ~2-3min)
      const poll = setInterval(async () => {
        const res = await fetch("/api/sherlock/dashboard");
        if (res.ok) {
          const data = await res.json();
          if (data.status === "ready") {
            setReport(data);
            setRunning(false);
            clearInterval(poll);
          }
        }
      }, 10_000);

      // stop polling after 10 minutes
      setTimeout(() => {
        clearInterval(poll);
        setRunning(false);
      }, 10 * 60 * 1000);

    } catch (err: any) {
      setError("Não foi possível acionar o pipeline do Sherlock.");
      setRunning(false);
    }
  };

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
              Inteligência de tendências multi-plataforma
            </p>
          </div>

          <button
            onClick={() => setShowInstagram(true)}
            className="px-4 py-2.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 text-pink-300 font-medium text-sm transition-colors flex items-center gap-2"
          >
            <Instagram className="w-4 h-4" />
            Pesquisar Reels
          </button>
        </div>

        {/* Source selector */}
        {!report && (
          <div className="bg-[#09090A] border border-white/5 rounded-3xl p-6 mb-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold text-white">Fontes de tendências</h2>
                <p className="text-white/40 text-[12px] mt-0.5">Selecione onde o Sherlock deve investigar</p>
              </div>
              <button
                onClick={toggleAll}
                className="text-[11px] text-violet-400 hover:text-violet-300 font-medium transition-colors"
              >
                {selectedSources.size === SOURCES.length ? "Desmarcar todas" : "Selecionar todas"}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
              {SOURCES.map(source => {
                const selected = selectedSources.has(source.id);
                return (
                  <button
                    key={source.id}
                    onClick={() => toggleSource(source.id)}
                    className={cn(
                      "flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all duration-150",
                      selected
                        ? "border-white/20 bg-white/[0.05] text-white"
                        : "border-white/5 bg-white/[0.02] text-white/30 hover:border-white/10 hover:text-white/50"
                    )}
                  >
                    {/* Platform logo */}
                    <div className={cn(
                      "w-9 h-9 rounded-xl shrink-0 overflow-hidden transition-all",
                      selected ? "opacity-100" : "opacity-30 grayscale"
                    )}>
                      {SOURCE_LOGOS[source.id]}
                    </div>

                    {/* Text */}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold leading-tight truncate">{source.label}</p>
                      <p className="text-[11px] opacity-50 mt-0.5 leading-tight truncate">{source.description}</p>
                    </div>

                    {/* Checkmark */}
                    <div className={cn(
                      "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all",
                      selected ? "border-white/40 bg-white/10" : "border-white/10"
                    )}>
                      {selected && (
                        <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              onClick={triggerAgent}
              disabled={running || selectedSources.size === 0}
              className={cn(
                "w-full py-3.5 rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2.5",
                running || selectedSources.size === 0
                  ? "bg-white/5 text-white/30 cursor-not-allowed"
                  : "bg-violet-500 hover:bg-violet-600 text-white shadow-[0_0_20px_rgba(139,92,246,0.25)]"
              )}
            >
              {running ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Sherlock investigando... aguarde ~2 min
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Executar Pipeline ({selectedSources.size} fonte{selectedSources.size !== 1 ? "s" : ""})
                </>
              )}
            </button>

            {running && (
              <p className="text-center text-white/30 text-[11px] mt-3">
                Pipeline rodando no GitHub Actions. A página atualiza automaticamente.
              </p>
            )}
          </div>
        )}

        {/* Results */}
        {report?.status === "ready" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white/60">Resultado da Investigação</h2>
              <button
                onClick={() => { setReport(null); fetchDashboardData(); }}
                className="text-[11px] text-violet-400 hover:text-violet-300 font-medium flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Nova investigação
              </button>
            </div>

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
          </div>
        )}
      </div>
    </div>
  );
}
