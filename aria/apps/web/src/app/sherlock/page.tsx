'use client';

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, RefreshCw, Search, Instagram, X, ExternalLink, Play, TrendingUp, Clock, Sparkles, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import AriaSidebar from "@/components/layout/AriaSidebar";

interface Trend {
  source: string;
  title: string;
  content: string;
  url: string;
  engagement: number;
  viral_score: number;
  momentum_score?: number;
  niche_fit_score?: number;
  score_components?: {
    momentum_score?: number;
    niche_fit_score?: number;
    contextual_score?: number;
    score_formula?: string;
    matched_keywords?: string[];
  };
  published_at: string;
}

interface TrendReport {
  status: string;
  message?: string;
  date?: string;
  trends?: Trend[];
  mashup_angle?: string;
  carousel_script?: string;
  source_progress?: Record<string, 'waiting' | 'running' | 'done' | 'error'>;
}

interface HistoryEntry {
  id: string;
  date: string;
  trend_count: number;
  search_meta?: {
    sources?: string[];
    days?: number;
    keywords?: string[];
    focus_keywords?: string[];
    triggered_at?: string;
  } | null;
}

interface NicheProfile {
  name: string;
  keywords: string;
  minNicheFit: number;
}

interface InstagramReel {
  url: string;
  title: string;
  views: string;
  views_raw: number;
  keyword: string;
  published_at: string;
}

interface SessionHealthItem {
  ok: boolean;
  logged_in: boolean;
}

interface SessionHealth {
  status: string;
  timestamp?: string;
  instagram?: SessionHealthItem;
  x?: SessionHealthItem;
  tiktok?: SessionHealthItem;
}

const MAX_TRENDS = 10;

function limitTrendsPerSource(items: Trend[], maxPerSource: number): Trend[] {
  const out: Trend[] = [];
  const counts: Record<string, number> = {};
  for (const item of items) {
    const src = item.source ?? 'unknown';
    const current = counts[src] ?? 0;
    if (current >= maxPerSource) continue;
    counts[src] = current + 1;
    out.push(item);
  }
  return out;
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
  reddit:        <LogoReddit />,
  reddit_r_popular: <LogoReddit />,
  reddit_r_brasil: <LogoReddit />,
  reddit_r_investimentos: <LogoReddit />,
  reddit_r_empreendedorismo: <LogoReddit />,
  youtube:       <LogoYouTube />,
  youtube_trending: <LogoYouTube />,
  instagram:     <LogoInstagram />,
  tiktok:        <LogoTikTok />,
  x:             <LogoX />,
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

const THEME_SOURCES = ["g1", "google_trends", "reddit", "youtube", "x"] as const;
const VIDEO_REFERENCE_SOURCES = ["instagram", "tiktok"] as const;
type SherlockMode = "themes" | "video_reference";

function formatEngagement(val: number): string {
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

interface SourceStats {
  min: number;
  max: number;
  median: number;
  p75: number;
}

function quantile(sortedValues: number[], q: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const pos = (sortedValues.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sortedValues[base + 1] ?? sortedValues[base];
  return sortedValues[base] + rest * (next - sortedValues[base]);
}

function buildSourceStats(trends: Trend[]): Record<string, SourceStats> {
  const grouped: Record<string, number[]> = {};
  for (const trend of trends) {
    if (!grouped[trend.source]) grouped[trend.source] = [];
    grouped[trend.source].push(Math.max(0, Number(trend.viral_score) || 0));
  }

  const stats: Record<string, SourceStats> = {};
  for (const [source, values] of Object.entries(grouped)) {
    const sorted = [...values].sort((a, b) => a - b);
    stats[source] = {
      min: sorted[0] ?? 0,
      max: sorted[sorted.length - 1] ?? 0,
      median: quantile(sorted, 0.5),
      p75: quantile(sorted, 0.75),
    };
  }
  return stats;
}

function normalizedEngagement(trend: Trend, stats?: SourceStats): number {
  if (!stats) return 0;
  const engagement = Math.max(0, Number(trend.viral_score) || 0);
  const range = stats.max - stats.min;
  if (range <= 0) return 50;
  return Math.max(0, Math.min(100, ((engagement - stats.min) / range) * 100));
}

function benchmarkLabel(trend: Trend, stats?: SourceStats): string {
  if (!stats) return "sem benchmark";
  const engagement = Math.max(0, Number(trend.viral_score) || 0);
  if (engagement >= stats.p75) return "alto na plataforma";
  if (engagement >= stats.median) return "medio na plataforma";
  return "baixo na plataforma";
}

function getNicheFit(trend: Trend): number {
  return Math.max(
    0,
    Math.min(
      100,
      Number(
        trend.niche_fit_score ??
        trend.score_components?.niche_fit_score ??
        50
      ) || 0
    )
  );
}

function getMomentum(trend: Trend): number {
  return Math.max(
    0,
    Math.min(
      100,
      Number(
        trend.momentum_score ??
        trend.score_components?.momentum_score ??
        0
      ) || 0
    )
  );
}

function InstagramModal({ onClose, onAddToReport }: {
  onClose: () => void;
  onAddToReport?: (reels: InstagramReel[]) => void;
}) {
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
              <>
                {reels.map((reel, i) => (
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
                ))}
                {onAddToReport && (
                  <button
                    onClick={() => { onAddToReport(reels); onClose(); }}
                    className="w-full mt-2 py-2.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 text-pink-300 font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                    <Instagram className="w-3.5 h-3.5" />
                    Adicionar {reels.length} reel{reels.length !== 1 ? "s" : ""} ao relatório
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TrendCard({
  trend,
  sourceStats,
  onCreateContent,
}: {
  trend: Trend;
  sourceStats?: SourceStats;
  onCreateContent: (trend: Trend) => void;
}) {
  const eng = formatEngagement(trend.engagement);
  const engLabel = engagementLabel(trend.source);
  const logo = SOURCE_LOGOS[trend.source];
  const label = SOURCE_LABEL[trend.source] ?? trend.source;
  const normalized = Math.round(normalizedEngagement(trend, sourceStats));

  return (
    <div className="group flex flex-col gap-3 p-4 bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 rounded-2xl transition-all duration-150">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded-md shrink-0 overflow-hidden opacity-70">
            {logo ?? <div className="w-full h-full bg-white/10 rounded-md" />}
          </div>
          <span className="text-[10px] font-medium text-white/40 truncate">{label}</span>
        </div>
        <span className="text-[11px] text-[#C3FAEA]/60 font-semibold tabular-nums shrink-0">{normalized}</span>
      </div>

      <p className="text-white/70 text-[13px] leading-snug group-hover:text-white transition-colors line-clamp-3 break-words flex-1 min-w-0">
        {trend.title}
      </p>

      <div className="flex items-center justify-between gap-2 min-w-0">
        <a
          href={trend.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] text-white/20 hover:text-white/50 transition-colors min-w-0"
        >
          <ExternalLink className="w-3 h-3 shrink-0" />
          <span className="truncate">{(() => { try { return new URL(trend.url).hostname.replace("www.", ""); } catch { return trend.url; } })()}</span>
        </a>
        {trend.engagement > 1 && (
          <span className="text-[10px] text-white/25 tabular-nums shrink-0">{eng} {engLabel}</span>
        )}
      </div>

      <button
        onClick={() => onCreateContent(trend)}
        className="w-full justify-center inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#C3FAEA]/20 bg-[#C3FAEA]/5 text-[#C3FAEA]/70 hover:bg-[#C3FAEA]/15 hover:text-[#C3FAEA] transition-colors text-[11px] font-semibold"
      >
        <Sparkles className="w-3 h-3" />
        Criar no Maverick
      </button>
    </div>
  );
}

export default function SherlockPage() {
  const router = useRouter();
  const [mode, setMode] = useState<SherlockMode>("themes");
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set(THEME_SOURCES));
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<TrendReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInstagram, setShowInstagram] = useState(false);
  const [keywords, setKeywords] = useState("");
  const [period, setPeriod] = useState(30);
  const [sourceProgress, setSourceProgress] = useState<Record<string, 'waiting' | 'running' | 'done' | 'error'>>({});
  const [showCarousel, setShowCarousel] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showNicheConfig, setShowNicheConfig] = useState(false);
  const [collapsedSources, setCollapsedSources] = useState<Set<string>>(new Set());
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [filterSources, setFilterSources] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'score' | 'niche' | 'momentum' | 'date'>('score');
  const [minNicheFit, setMinNicheFit] = useState(0);
  const [sessionHealth, setSessionHealth] = useState<SessionHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [nicheProfile, setNicheProfile] = useState<NicheProfile>({
    name: '',
    keywords: '',
    minNicheFit: 0,
  });

  const visibleSourceIds = useMemo(
    () => (mode === "themes" ? [...THEME_SOURCES] : [...VIDEO_REFERENCE_SOURCES]),
    [mode]
  );
  const visibleSourceSet = useMemo(() => new Set<string>(visibleSourceIds), [visibleSourceIds]);
  const visibleSources = useMemo(
    () => SOURCES.filter((s) => visibleSourceSet.has(s.id)),
    [visibleSourceSet]
  );

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/sherlock/history');
      const data = await res.json();
      setHistory(data.reports ?? []);
    } catch {
      // ignore
    }
  }, []);

  const fetchSessionHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/sherlock/session-health');
      const data = await res.json();
      if (res.ok) setSessionHealth(data);
      else setSessionHealth(null);
    } catch {
      setSessionHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const loadHistoryReport = async (entry: HistoryEntry) => {
    try {
      const res = await fetch(`/api/sherlock/report/${entry.id}`);
      const data = await res.json();
      if (data.status === 'ready') {
        setReport(data);
        setActiveReportId(entry.id);
        setFilterText('');
        setFilterSources(new Set());
        setSortBy('score');
        setMinNicheFit(0);
        setShowAdvancedFilters(false);
        setCollapsedSources(new Set());
        setShowCarousel(false);
      }
    } catch {
      // ignore
    }
  };

  const handleAddReelsToReport = (reels: InstagramReel[]) => {
    const newTrends: Trend[] = reels.map(reel => ({
      source: 'instagram',
      title: reel.title || `Reel #${reel.keyword}`,
      content: `#${reel.keyword}`,
      url: reel.url,
      engagement: reel.views_raw ?? 0,
      viral_score: 0,
      momentum_score: 0,
      niche_fit_score: 50,
      published_at: reel.published_at || new Date().toISOString(),
    }));
    if (report) {
      setReport(prev => prev ? { ...prev, trends: limitTrendsPerSource([...(prev.trends ?? []), ...newTrends], MAX_TRENDS) } : prev);
    } else {
      setReport({ status: 'ready', date: new Date().toISOString(), trends: limitTrendsPerSource(newTrends, MAX_TRENDS) });
    }
  };

  const getSessionItem = (source: 'instagram' | 'x' | 'tiktok', health: SessionHealth | null): SessionHealthItem | null => {
    if (!health) return null;
    if (source === 'instagram') return health.instagram ?? null;
    if (source === 'x') return health.x ?? null;
    return health.tiktok ?? null;
  };

  const toggleFilterSource = (src: string, uniqueSources: string[]) => {
    setFilterSources(prev => {
      if (prev.size === 0) return new Set([src]);
      const next = new Set(prev);
      if (next.has(src)) {
        next.delete(src);
        if (next.size === 0) return new Set();
      } else {
        next.add(src);
        if (next.size === uniqueSources.length) return new Set();
      }
      return next;
    });
  };

  useEffect(() => {
    fetch("/api/sherlock/dashboard")
      .then(r => r.json())
      .then(data => { if (data.status === "ready") setReport(data); })
      .catch(() => {});
    fetchHistory();

    try {
      const raw = localStorage.getItem('sherlock_niche_profile');
      if (raw) {
        const parsed = JSON.parse(raw) as NicheProfile;
        setNicheProfile(parsed);
        if (parsed.keywords) setKeywords(parsed.keywords);
        if (typeof parsed.minNicheFit === 'number') setMinNicheFit(parsed.minNicheFit);
      }
    } catch {
      // ignore malformed local data
    }
  }, [fetchHistory]);

  const applyModeSources = useCallback((nextMode: SherlockMode) => {
    const defaults = nextMode === "themes" ? THEME_SOURCES : VIDEO_REFERENCE_SOURCES;
    setSelectedSources(new Set(defaults));
  }, []);

  const toggleSource = (id: string) => {
    setSelectedSources(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedSources.size === visibleSources.length) {
      setSelectedSources(new Set());
    } else {
      setSelectedSources(new Set(visibleSources.map((s) => s.id)));
    }
  };

  const triggerAgent = async () => {
    if (selectedSources.size === 0) return;

    const socialSources = (['instagram', 'x', 'tiktok'] as const).filter(src => selectedSources.has(src));
    if (socialSources.length > 0) {
      let health = sessionHealth;
      if (!health) {
        try {
          const res = await fetch('/api/sherlock/session-health');
          if (res.ok) health = await res.json();
        } catch {
          health = null;
        }
      }
      if (!health) {
        setError("Nao foi possivel validar sessao social. Atualize o status de sessao e tente novamente.");
        return;
      }

      const invalid: string[] = [];
      for (const src of socialSources) {
        const item = getSessionItem(src, health);
        if (!item?.ok || !item?.logged_in) {
          invalid.push(src === 'x' ? 'X' : src === 'tiktok' ? 'TikTok' : 'Instagram');
        }
      }

      if (invalid.length > 0) {
        setError(`Sessao invalida para: ${invalid.join(', ')}. Refaça login no helper antes de executar.`);
        await fetchSessionHealth();
        return;
      }
    }

    setRunning(true);
    setError(null);
    setReport(null);
    setShowCarousel(false);

    const initProgress: Record<string, 'waiting'> = {};
    Array.from(selectedSources).forEach(src => { initProgress[src] = 'waiting'; });
    setSourceProgress(initProgress);

    try {
      const parsedKeywords = keywords.trim() ? keywords.split(",").map(k => k.trim()).filter(Boolean) : [];

      const response = await fetch("/api/sherlock/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources: Array.from(selectedSources),
          keywords: parsedKeywords.length > 0 ? parsedKeywords : undefined,
          focus_keywords: parsedKeywords.length > 0 ? parsedKeywords : undefined,
          period_days: period,
        }),
      });
      if (!response.ok) throw new Error(`API retornou ${response.status}`);

      let waitingCount = 0;
      const poll = setInterval(async () => {
        try {
          const res = await fetch("/api/sherlock/dashboard");
          if (res.ok) {
            const data = await res.json();
            if (data.status === "ready") {
              setReport(data);
              setActiveReportId(null);
              setRunning(false);
              clearInterval(poll);
              fetchHistory();
            } else if (data.status === "processing" && data.source_progress) {
              setSourceProgress(data.source_progress);
            } else if (data.status === "waiting") {
              // Pipeline encerrou sem enviar dados
              waitingCount++;
              if (waitingCount >= 2) {
                setError("Pipeline encerrou sem retornar dados. Verifique os logs ou tente novamente.");
                setRunning(false);
                clearInterval(poll);
              }
            }
          }
        } catch { /* ignore network errors during polling */ }
      }, 10_000);

      setTimeout(() => { clearInterval(poll); setRunning(false); }, 10 * 60 * 1000);
    } catch (err: any) {
      setError("Não foi possível acionar o pipeline do Sherlock.");
      setRunning(false);
    }
  };

  const allTrends = limitTrendsPerSource(report?.trends ?? [], MAX_TRENDS);
  const sourceStats = useMemo(() => buildSourceStats(allTrends), [allTrends]);
  const uniqueSources = [...new Set(allTrends.map(t => t.source))];

  const displayTrends = allTrends
    .filter(t => filterSources.size === 0 || filterSources.has(t.source))
    .filter(t => !filterText.trim() || t.title.toLowerCase().includes(filterText.toLowerCase()))
    .filter(t => getNicheFit(t) >= minNicheFit)
    .sort((a, b) => {
      if (sortBy === 'score') return b.viral_score - a.viral_score;
      if (sortBy === 'niche') return getNicheFit(b) - getNicheFit(a);
      if (sortBy === 'momentum') return getMomentum(b) - getMomentum(a);
      return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
    });

  // Conta trends por source (para header summary)
  const sourceCount = uniqueSources.reduce<Record<string, number>>((acc, src) => {
    acc[src] = allTrends.filter(t => t.source === src).length;
    return acc;
  }, {});

  const groupedDisplayTrends = useMemo(() => {
    const grouped: Record<string, Trend[]> = {};
    for (const trend of displayTrends) {
      const src = trend.source ?? 'unknown';
      if (!grouped[src]) grouped[src] = [];
      grouped[src].push(trend);
    }
    return grouped;
  }, [displayTrends]);

  const groupedSources = useMemo(
    () => Object.keys(groupedDisplayTrends).sort((a, b) => (SOURCE_LABEL[a] ?? a).localeCompare(SOURCE_LABEL[b] ?? b)),
    [groupedDisplayTrends]
  );

  const toggleSourceSection = (src: string) => {
    setCollapsedSources((prev) => {
      const next = new Set(prev);
      if (next.has(src)) next.delete(src);
      else next.add(src);
      return next;
    });
  };

  const handleCreateWithMaverick = (trend: Trend) => {
    try {
      const sourceName = SOURCE_LABEL[trend.source] ?? trend.source;
      const contextText =
        `Trend selecionado no Sherlock\n` +
        `Fonte: ${sourceName}\n` +
        `Titulo: ${trend.title}\n` +
        `Contexto: ${trend.content}\n` +
        `Score contextual: ${Math.round(trend.viral_score)}/100\n` +
        `Fit de nicho: ${Math.round(getNicheFit(trend))}/100\n` +
        `Momentum: ${Math.round(getMomentum(trend))}/100\n` +
        `Engajamento: ${formatEngagement(trend.engagement)} ${engagementLabel(trend.source)}\n` +
        `URL: ${trend.url}`;

      localStorage.setItem('aria_active_squad', 'maverick');
      localStorage.setItem('aria_maverick_trend_context', JSON.stringify({
        mode: 'content',
        objective: 'Viral',
        cta: 'Salvar e compartilhar',
        source: sourceName,
        title: trend.title,
        content: trend.content,
        url: trend.url,
        contextText,
      }));
      router.push('/');
    } catch {
      router.push('/');
    }
  };

  const saveNicheProfile = () => {
    const profile: NicheProfile = {
      name: nicheProfile.name.trim() || 'Meu Nicho',
      keywords: keywords.trim(),
      minNicheFit,
    };
    setNicheProfile(profile);
    try {
      localStorage.setItem('sherlock_niche_profile', JSON.stringify(profile));
    } catch {
      // ignore storage errors
    }
  };

  const applyNicheProfile = () => {
    if (!nicheProfile.keywords) return;
    setKeywords(nicheProfile.keywords);
    setMinNicheFit(nicheProfile.minNicheFit || 0);
  };

  return (
    <div className="min-h-[100dvh] w-full overflow-x-hidden relative bg-background text-white flex">
      <div className="absolute inset-0 bg-gradient-to-br from-[#09090A] via-[#09090A] to-[rgba(195,250,234,0.05)] pointer-events-none" />
      <AriaSidebar activeSquad="sherlock" />
      {showInstagram && <InstagramModal onClose={() => setShowInstagram(false)} onAddToReport={handleAddReelsToReport} />}

      <div className="min-h-[100dvh] flex flex-col relative z-10 p-4 pt-[max(env(safe-area-inset-top),1rem)] sm:p-6 lg:p-10 max-w-6xl mx-auto flex-1 overflow-x-hidden w-full lg:pl-64">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#C3FAEA]/10 flex items-center justify-center border border-[#C3FAEA]/20">
              <Search className="w-4 h-4 text-[#C3FAEA]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Sherlock</h1>
          </div>
          <button
            onClick={() => setShowInstagram(true)}
            className="px-3 py-2 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 text-pink-300 font-medium text-xs sm:text-sm transition-colors flex items-center gap-1.5"
          >
            <Instagram className="w-3.5 h-3.5" />
            Reels
          </button>
        </div>

        {/* Barra de histórico */}
        {history.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="flex items-center gap-2 text-[11px] text-white/35 hover:text-white/60 transition-colors"
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span className="font-medium">Histórico ({history.length})</span>
            </button>
            {showHistory && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {history.map(entry => {
              const isActive = activeReportId === entry.id;
              const d = new Date(entry.date);
              const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
              const daysLabel = entry.search_meta?.days ? ` · ${entry.search_meta.days}d` : '';
              const focusLabel = entry.search_meta?.focus_keywords?.length
                ? ` · ${entry.search_meta.focus_keywords.slice(0, 2).join(',')}`
                : '';
                  return (
                    <button key={entry.id} onClick={() => loadHistoryReport(entry)}
                      title={`Busca${daysLabel}${focusLabel}`}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-[11px] font-medium border transition-colors shrink-0",
                        isActive
                          ? "bg-[#C3FAEA]/15 border-[#C3FAEA]/30 text-[#C3FAEA]"
                          : "bg-white/5 border-white/10 text-white/40 hover:text-white/60 hover:border-white/20"
                      )}>
                      {label}
                      {daysLabel && <span className="ml-1 text-white/35">{entry.search_meta?.days}d</span>}
                      <span className="ml-1.5 text-white/25">{entry.trend_count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Source selector â€” esconde quando tem resultados */}
        {!report && (
          <div className="mb-8 space-y-6">

            {/* Modo — pill toggle */}
            <div>
              <p className="text-[11px] uppercase tracking-widest text-white/30 font-bold mb-3">Modo</p>
              <div className="inline-flex p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                <button
                  onClick={() => { setMode("themes"); applyModeSources("themes"); }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all duration-150",
                    mode === "themes" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                  )}
                >
                  <Search className="w-3.5 h-3.5" />
                  Temas & Trends
                </button>
                <button
                  onClick={() => { setMode("video_reference"); applyModeSources("video_reference"); }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all duration-150",
                    mode === "video_reference" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                  )}
                >
                  <Play className="w-3.5 h-3.5" />
                  Referência de vídeo
                </button>
              </div>
            </div>

            {/* Fontes */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] uppercase tracking-widest text-white/30 font-bold">Fontes</p>
                <button onClick={toggleAll} className="text-[11px] text-[#C3FAEA] hover:text-[#C3FAEA]/80 font-medium transition-colors">
                  {selectedSources.size === visibleSources.length ? "Desmarcar todas" : "Selecionar todas"}
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {visibleSources.map(source => {
                  const selected = selectedSources.has(source.id);
                  return (
                    <button key={source.id} onClick={() => toggleSource(source.id)}
                      className={cn("flex items-center gap-3 p-3 rounded-2xl border text-left transition-all duration-150",
                        selected ? "border-white/20 bg-white/[0.05] text-white" : "border-white/5 bg-white/[0.02] text-white/30 hover:border-white/10 hover:text-white/50"
                      )}>
                      <div className={cn("w-8 h-8 rounded-lg shrink-0 overflow-hidden transition-all", selected ? "opacity-100" : "opacity-30 grayscale")}>
                        {SOURCE_LOGOS[source.id] ?? SOURCE_LOGOS[source.id + "_trending"]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold leading-tight truncate">{source.label}</p>
                      </div>
                      <div className={cn("w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 transition-all",
                        selected ? "border-white/40 bg-white/10" : "border-white/10")}>
                        {selected && (
                          <svg className="w-2 h-2" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              {/* Session health — footnote sutil */}
              <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-3 pt-3 border-t border-white/[0.04]">
                {sessionHealth ? (
                  <>
                    {([
                      { source: 'instagram' as const, label: 'Instagram' },
                      { source: 'x' as const, label: 'X' },
                      { source: 'tiktok' as const, label: 'TikTok' },
                    ]).map(item => {
                      const s = getSessionItem(item.source, sessionHealth);
                      const logged = !!s?.ok && !!s?.logged_in;
                      return (
                        <span key={item.source} className="flex items-center gap-1.5 text-[11px]">
                          <span className={cn("w-1.5 h-1.5 rounded-full", logged ? "bg-emerald-400" : "bg-red-400/70")} />
                          <span className={cn(logged ? "text-white/35" : "text-red-400/60")}>{item.label}</span>
                        </span>
                      );
                    })}
                    <button
                      onClick={fetchSessionHealth}
                      disabled={healthLoading}
                      className="ml-auto text-[10px] text-white/20 hover:text-white/50 transition-colors disabled:opacity-40"
                    >
                      {healthLoading ? "..." : "↻"}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={fetchSessionHealth}
                    disabled={healthLoading}
                    className="text-[11px] text-white/25 hover:text-white/50 transition-colors disabled:opacity-40"
                  >
                    {healthLoading ? "Verificando sessão..." : "Verificar sessão social →"}
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 shrink-0" />{error}
              </div>
            )}

            {/* Parâmetros */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-widest text-white/30 font-bold">
                  Período
                </label>
                <select value={period} onChange={(e) => setPeriod(Number(e.target.value))}
                  className="px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#C3FAEA]/50 transition-colors cursor-pointer">
                  {PERIOD_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-[#09090A] text-white">{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-widest text-white/30 font-bold">
                  Foco temático
                  {(selectedSources.has("tiktok") || selectedSources.has("instagram")) && (
                    <span className="ml-1.5 text-white/25 normal-case font-normal">· busca no TikTok/Instagram</span>
                  )}
                </label>
                <input type="text" value={keywords} onChange={(e) => setKeywords(e.target.value)}
                  placeholder="ex: empreendedorismo, finanças..."
                  className="px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#C3FAEA]/50 transition-colors"
                />
              </div>
            </div>

            {/* Configurações avançadas — perfil de nicho */}
            <div>
              <button
                onClick={() => setShowNicheConfig(v => !v)}
                className="flex items-center gap-1.5 text-[11px] text-white/25 hover:text-white/55 transition-colors"
              >
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showNicheConfig ? "rotate-0" : "-rotate-90")} />
                Configurações avançadas
              </button>
              {showNicheConfig && (
                <div className="mt-3 pt-3 border-t border-white/[0.04] space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={nicheProfile.name}
                      onChange={(e) => setNicheProfile(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Nome do perfil (ex: Marketing para infoprodutores)"
                      className="flex-1 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#C3FAEA]/50 transition-colors"
                    />
                    <button
                      onClick={saveNicheProfile}
                      className="px-3 py-2.5 rounded-lg border border-[#C3FAEA]/30 bg-[#C3FAEA]/10 text-[#C3FAEA] text-xs font-semibold hover:bg-[#C3FAEA]/20 transition-colors whitespace-nowrap"
                    >
                      Salvar
                    </button>
                    <button
                      onClick={applyNicheProfile}
                      disabled={!nicheProfile.keywords}
                      className="px-3 py-2.5 rounded-lg border border-white/15 bg-white/5 text-white/70 text-xs font-semibold hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      Aplicar
                    </button>
                  </div>
                  {nicheProfile.keywords && (
                    <p className="text-[11px] text-white/25">
                      {nicheProfile.name || 'Meu Nicho'} · {nicheProfile.keywords} · fit mín. {nicheProfile.minNicheFit}
                    </p>
                  )}
                </div>
              )}
            </div>

            <button onClick={triggerAgent} disabled={running || selectedSources.size === 0}
              className={cn("w-full py-3.5 rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2.5",
                running || selectedSources.size === 0
                  ? "bg-white/5 text-white/30 cursor-not-allowed"
                  : "bg-[#C3FAEA] hover:bg-[#A8E8D4] text-[#0d0d0f] shadow-[0_0_20px_rgba(195,250,234,0.25)]"
              )}>
              {running ? (
                <><RefreshCw className="w-4 h-4 animate-spin" />Sherlock investigando... aguarde</>
              ) : (
                <><Play className="w-4 h-4" />{mode === "video_reference" ? "Buscar referências" : "Executar Pipeline"} ({selectedSources.size} fonte{selectedSources.size !== 1 ? "s" : ""})</>
              )}
            </button>

            {running && (
              <div className="space-y-2">
                <p className="text-center text-white/25 text-[11px]">Coletando tendências em tempo real...</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {Array.from(selectedSources).map(src => {
                    const status = sourceProgress[src] ?? 'waiting';
                    const label = SOURCES.find(s => s.id === src)?.label ?? src;
                    return (
                      <div key={src} className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-300",
                        status === 'done'    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" :
                        status === 'running' ? "bg-[#C3FAEA]/10 border-[#C3FAEA]/20 text-[#C3FAEA]" :
                        status === 'error'   ? "bg-red-500/10 border-red-500/20 text-red-300" :
                                              "bg-white/5 border-white/10 text-white/30"
                      )}>
                        {status === 'done'    && <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        {status === 'running' && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
                        {status === 'error'   && <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                        {status === 'waiting' && <span className="w-2 h-2 rounded-full bg-white/20 inline-block" />}
                        {label}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Resultados — lista de tendências */}
        {report?.status === "ready" && (
          <div className="space-y-4">
            {/* Header dos resultados */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
                  <h2 className="text-sm font-semibold text-white">
                    {displayTrends.length !== allTrends.length
                      ? `${displayTrends.length} de ${allTrends.length} tendências`
                      : `${allTrends.length} tendências encontradas`}
                  </h2>
                  {activeReportId && (
                    <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-medium">
                      histórico
                    </span>
                  )}
                </div>
                <p className="mt-1 text-white/30 text-[11px]">{new Date(report.date ?? "").toLocaleString("pt-BR")}</p>
              </div>
              <button onClick={() => { setReport(null); setActiveReportId(null); setFilterText(''); setFilterSources(new Set()); setSortBy('score'); setMinNicheFit(0); setShowAdvancedFilters(false); }}
                className="self-start sm:self-auto text-[11px] text-[#C3FAEA] hover:text-[#C3FAEA]/80 font-medium flex items-center gap-1.5 transition-colors">
                <RefreshCw className="w-3 h-3" />
                Nova investigação
              </button>
            </div>

            {/* Filtros e ordenação */}
            {allTrends.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  {/* Busca por texto */}
                  <div className="relative w-full sm:flex-1 sm:min-w-40 min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
                    <input
                      value={filterText}
                      onChange={e => setFilterText(e.target.value)}
                      placeholder="Buscar tendências..."
                      className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/20 outline-none focus:border-[#C3FAEA]/40 transition-colors"
                    />
                  </div>
                  {/* Ordenação */}
                  <div className="flex items-center gap-2">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'score' | 'niche' | 'momentum' | 'date')}
                      className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 text-[11px] outline-none focus:border-[#C3FAEA]/40"
                    >
                      <option value="score" className="bg-[#09090A]">Score contextual</option>
                      <option value="niche" className="bg-[#09090A]">Fit de nicho</option>
                      <option value="momentum" className="bg-[#09090A]">Momentum</option>
                      <option value="date" className="bg-[#09090A]">Mais recente</option>
                    </select>
                    <button
                      onClick={() => setShowAdvancedFilters(v => !v)}
                      className="px-3 py-2 rounded-xl border border-white/10 text-[11px] text-white/45 hover:text-white/70 hover:border-white/20 transition-colors"
                    >
                      {showAdvancedFilters ? 'Ocultar filtros' : 'Filtros avançados'}
                    </button>
                  </div>
                </div>
                {showAdvancedFilters && (
                  <>
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2 flex flex-wrap items-center gap-3 min-w-0">
                      <label className="text-[11px] text-white/45 font-medium whitespace-nowrap">
                        Fit mínimo
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={minNicheFit}
                        onChange={(e) => setMinNicheFit(Number(e.target.value))}
                        className="w-full sm:w-40 accent-[#C3FAEA]"
                      />
                      <span className="text-[11px] text-white/60 font-semibold tabular-nums min-w-8 text-right">
                        {minNicheFit}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {uniqueSources.map(src => {
                        const active = filterSources.size === 0 || filterSources.has(src);
                        return (
                          <button key={src} onClick={() => toggleFilterSource(src, uniqueSources)}
                            className={cn(
                              "px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all",
                              active
                                ? SOURCE_COLOR[src] ?? "bg-white/10 border-white/20 text-white/70"
                                : "bg-white/[0.02] border-white/5 text-white/20 hover:text-white/40"
                            )}>
                            {SOURCE_LABEL[src] ?? src}
                            <span className="ml-1 opacity-60">{sourceCount[src]}</span>
                          </button>
                        );
                      })}
                      {filterSources.size > 0 && (
                        <button onClick={() => setFilterSources(new Set())}
                          className="px-2.5 py-1 rounded-full text-[10px] font-medium border border-white/10 text-white/30 hover:text-white/60 transition-colors">
                          Limpar filtro
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Grid de tendências */}
            {allTrends.length === 0 ? (
              <div className="text-center py-16 text-white/30 text-sm">
                Nenhuma tendência nova encontrada (já processadas antes).
              </div>
            ) : displayTrends.length === 0 ? (
              <div className="text-center py-12 text-white/30 text-sm">
                Nenhuma tendência corresponde aos filtros aplicados.
              </div>
            ) : (
              <div className="space-y-3">
                {groupedSources.map((src) => {
                  const items = groupedDisplayTrends[src] ?? [];
                  const collapsed = collapsedSources.has(src);
                  return (
                    <section key={src} className="border border-white/10 rounded-xl bg-white/[0.02]">
                      <button
                        onClick={() => toggleSourceSection(src)}
                        className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-5 h-5 rounded-md overflow-hidden opacity-80">
                            {SOURCE_LOGOS[src] ?? <div className="w-full h-full bg-white/10 rounded-md" />}
                          </div>
                          <span className="text-[12px] text-white/80 font-semibold truncate">{SOURCE_LABEL[src] ?? src}</span>
                          <span className="text-[11px] text-white/40">{items.length}</span>
                        </div>
                        <ChevronDown className={cn("w-4 h-4 text-white/40 transition-transform", collapsed ? "-rotate-90" : "rotate-0")} />
                      </button>
                      {!collapsed && (
                        <div className="p-3 pt-0">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {items.map((t, i) => (
                              <TrendCard
                                key={`${src}-${i}`}
                                trend={t}
                                sourceStats={sourceStats[t.source]}
                                onCreateContent={handleCreateWithMaverick}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


