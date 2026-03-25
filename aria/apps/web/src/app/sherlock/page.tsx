'use client';

import { useState } from "react";
import { AlertCircle, RefreshCw, Search, Instagram, X, ExternalLink, Play, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import AriaSidebar from "@/components/layout/AriaSidebar";

interface Trend {
  source: string;
  title: string;
  content: string;
  url: string;
  engagement: number;
  viral_score: number;
  published_at: string;
}

interface TrendReport {
  status: string;
  message?: string;
  date?: string;
  trends?: Trend[];
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
      <circle cx="26" cy="13" r="1.2" fill="#FF4500"/>
      <path d="M31 16.5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0z" fill="#FF4500"/>
      <path d="M14 16.5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0z" fill="#FF4500"/>
    </svg>
  );
}

function LogoYouTube() {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="40" height="40" rx="8" fill="#FF0000"/>
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
          <stop offset="50%" stopColor="#F77737"/>
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
  reddit_r_popular: <LogoReddit />,
  reddit_r_brasil: <LogoReddit />,
  reddit_r_investimentos: <LogoReddit />,
  reddit_r_empreendedorismo: <LogoReddit />,
  youtube_trending: <LogoYouTube />,
  instagram:     <LogoInstagram />,
  tiktok:        <LogoTikTok />,
  x_twitter:     <LogoX />,
};

const SOURCE_LABEL: Record<string, string> = {
  g1: "G1",
  google_trends: "Google Trends",
  reddit_r_popular: "Reddit Popular",
  reddit_r_brasil: "Reddit Brasil",
  reddit_r_investimentos: "Reddit Invest.",
  reddit_r_empreendedorismo: "Reddit Empreend.",
  youtube_trending: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  x_twitter: "X / Twitter",
};

const SOURCE_COLOR: Record<string, string> = {
  g1: "bg-red-500/10 text-red-300 border-red-500/20",
  google_trends: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  reddit_r_popular: "bg-orange-500/10 text-orange-300 border-orange-500/20",
  reddit_r_brasil: "bg-orange-500/10 text-orange-300 border-orange-500/20",
  reddit_r_investimentos: "bg-orange-500/10 text-orange-300 border-orange-500/20",
  reddit_r_empreendedorismo: "bg-orange-500/10 text-orange-300 border-orange-500/20",
  youtube_trending: "bg-red-500/10 text-red-300 border-red-500/20",
  instagram: "bg-pink-500/10 text-pink-300 border-pink-500/20",
  tiktok: "bg-white/10 text-white/70 border-white/10",
  x_twitter: "bg-white/10 text-white/70 border-white/10",
};

const SOURCES = [
  { id: "g1",            label: "G1 News",       color: "blue" },
  { id: "google_trends", label: "Google Trends",  color: "yellow" },
  { id: "reddit",        label: "Reddit",          color: "orange" },
  { id: "youtube",       label: "YouTube",         color: "red" },
  { id: "instagram",     label: "Instagram",       color: "pink" },
  { id: "tiktok",        label: "TikTok",          color: "teal" },
  { id: "x",             label: "X / Twitter",     color: "white" },
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

function formatEngagement(val: number, source: string): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
  return String(Math.round(val));
}

function engagementLabel(source: string): string {
  if (source.startsWith("reddit")) return "pontos";
  if (source === "youtube_trending") return "views";
  if (source === "google_trends") return "buscas";
  if (source === "instagram" || source === "tiktok") return "views";
  if (source === "x_twitter") return "tweets";
  return "engaj.";
}

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
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
              <Instagram className="w-4 h-4 text-pink-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-base">Pesquisa de Reels</h2>
              <p className="text-white/40 text-[11px]">+100k views · sessão logada</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div className="space-y-3">
            <label className="text-[11px] uppercase tracking-widest text-white/40 font-bold">Keywords (até 3)</label>
            {keywords.map((kw, i) => (
              <input key={i} value={kw}
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
                <button key={opt.value} onClick={() => setDays(opt.value)}
                  className={cn("flex-1 py-2 rounded-xl text-sm font-medium border transition-colors",
                    days === opt.value ? "bg-pink-500/20 border-pink-500/40 text-pink-300" : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                  )}>{opt.label}</button>
              ))}
            </div>
          </div>
          <button onClick={handleSearch} disabled={loading || !keywords.some(k => k.trim())}
            className="w-full py-3 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? "Pesquisando..." : "Buscar Reels"}
          </button>
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
        </div>
        {searched && (
          <div className="border-t border-white/5 flex-1 overflow-y-auto p-6 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-widest text-white/40 font-bold">Resultados</span>
              <span className="text-[11px] text-white/30">{reels.length} Reels encontrados</span>
            </div>
            {reels.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-6">Nenhum Reel com +100k views encontrado.</p>
            ) : (
              reels.map((reel, i) => (
                <a key={i} href={reel.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 rounded-2xl px-4 py-3 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] bg-pink-500/20 text-pink-300 px-2 py-0.5 rounded-full font-medium">#{reel.keyword}</span>
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

function TrendItem({ trend }: { trend: Trend }) {
  const eng = formatEngagement(trend.engagement, trend.source);
  const engLabel = engagementLabel(trend.source);
  return (
    <a href={trend.url} target="_blank" rel="noopener noreferrer"
      className="group flex items-start gap-3 px-4 py-3 rounded-xl hover:bg-white/[0.04] transition-colors">
      <div className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover:bg-violet-400 mt-[5px] shrink-0 transition-colors" />
      <div className="flex-1 min-w-0">
        <p className="text-white/80 text-[13px] leading-snug group-hover:text-white transition-colors line-clamp-2">
          {trend.title}
        </p>
        {trend.engagement > 1 && (
          <span className="text-[11px] text-emerald-400/60 font-medium mt-0.5 block">
            {eng} {engLabel}
          </span>
        )}
      </div>
      <ExternalLink className="w-3 h-3 text-white/10 group-hover:text-white/40 shrink-0 mt-1 transition-colors" />
    </a>
  );
}

function SourceBlock({ sourceId, trends }: { sourceId: string; trends: Trend[] }) {
  const logo = SOURCE_LOGOS[sourceId];
  const label = SOURCE_LABEL[sourceId] ?? sourceId;
  const badgeColor = SOURCE_COLOR[sourceId] ?? "bg-white/10 text-white/60 border-white/10";
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
        <div className="w-7 h-7 rounded-lg shrink-0 overflow-hidden opacity-90">
          {logo ?? <div className="w-full h-full bg-white/10 rounded-lg" />}
        </div>
        <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full border", badgeColor)}>
          {label}
        </span>
        <span className="text-[11px] text-white/30 ml-auto">{trends.length} itens</span>
      </div>
      <div className="py-1">
        {trends.map((t, i) => <TrendItem key={i} trend={t} />)}
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
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedSources.size === SOURCES.length) setSelectedSources(new Set());
    else setSelectedSources(new Set(SOURCES.map(s => s.id)));
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

      setTimeout(() => { clearInterval(poll); setRunning(false); }, 10 * 60 * 1000);
    } catch (err: any) {
      setError("Não foi possível acionar o pipeline do Sherlock.");
      setRunning(false);
    }
  };

  const trends = report?.trends ?? [];

  // Agrupa por source mantendo ordem de aparição
  const bySource = trends.reduce<Record<string, Trend[]>>((acc, t) => {
    (acc[t.source] ??= []).push(t);
    return acc;
  }, {});

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
            <p className="text-white/40 text-[13px] ml-13">Inteligência de tendências multi-plataforma</p>
          </div>
          <button onClick={() => setShowInstagram(true)}
            className="px-4 py-2.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 text-pink-300 font-medium text-sm transition-colors flex items-center gap-2">
            <Instagram className="w-4 h-4" />
            Pesquisar Reels
          </button>
        </div>

        {/* Source selector — esconde quando tem resultados */}
        {!report && (
          <div className="bg-[#09090A] border border-white/5 rounded-3xl p-6 mb-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold text-white">Fontes de tendências</h2>
                <p className="text-white/40 text-[12px] mt-0.5">Selecione onde o Sherlock deve investigar</p>
              </div>
              <button onClick={toggleAll} className="text-[11px] text-violet-400 hover:text-violet-300 font-medium transition-colors">
                {selectedSources.size === SOURCES.length ? "Desmarcar todas" : "Selecionar todas"}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
              {SOURCES.map(source => {
                const selected = selectedSources.has(source.id);
                return (
                  <button key={source.id} onClick={() => toggleSource(source.id)}
                    className={cn("flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all duration-150",
                      selected ? "border-white/20 bg-white/[0.05] text-white" : "border-white/5 bg-white/[0.02] text-white/30 hover:border-white/10 hover:text-white/50"
                    )}>
                    <div className={cn("w-9 h-9 rounded-xl shrink-0 overflow-hidden transition-all", selected ? "opacity-100" : "opacity-30 grayscale")}>
                      {SOURCE_LOGOS[source.id] ?? SOURCE_LOGOS[source.id + "_trending"]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold leading-tight truncate">{source.label}</p>
                    </div>
                    <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all",
                      selected ? "border-white/40 bg-white/10" : "border-white/10")}>
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
                <AlertCircle className="w-4 h-4 shrink-0" />{error}
              </div>
            )}

            <button onClick={triggerAgent} disabled={running || selectedSources.size === 0}
              className={cn("w-full py-3.5 rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2.5",
                running || selectedSources.size === 0
                  ? "bg-white/5 text-white/30 cursor-not-allowed"
                  : "bg-violet-500 hover:bg-violet-600 text-white shadow-[0_0_20px_rgba(139,92,246,0.25)]"
              )}>
              {running ? (
                <><RefreshCw className="w-4 h-4 animate-spin" />Sherlock investigando... aguarde</>
              ) : (
                <><Play className="w-4 h-4" />Executar Pipeline ({selectedSources.size} fonte{selectedSources.size !== 1 ? "s" : ""})</>
              )}
            </button>

            {running && (
              <p className="text-center text-white/30 text-[11px] mt-3">
                Abrindo navegador e coletando tendências. Atualizará automaticamente.
              </p>
            )}
          </div>
        )}

        {/* Resultados — lista de tendências */}
        {report?.status === "ready" && (
          <div className="space-y-4">
            {/* Header dos resultados */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  {trends.length} tendências encontradas
                </h2>
                <p className="text-white/30 text-[11px] mt-0.5">
                  {new Date(report.date ?? "").toLocaleString("pt-BR")}
                  {Object.entries(sourceCount).map(([src, count]) =>
                    ` · ${SOURCE_LABEL[src] ?? src}: ${count}`
                  ).join("")}
                </p>
              </div>
              <button onClick={() => setReport(null)}
                className="text-[11px] text-violet-400 hover:text-violet-300 font-medium flex items-center gap-1.5 transition-colors">
                <RefreshCw className="w-3 h-3" />
                Nova investigação
              </button>
            </div>

            {/* Blocos por fonte */}
            {trends.length === 0 ? (
              <div className="text-center py-16 text-white/30 text-sm">
                Nenhuma tendência nova encontrada (já processadas antes).
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(bySource).map(([sourceId, sourceTrends]) => (
                  <SourceBlock key={sourceId} sourceId={sourceId} trends={sourceTrends} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
