'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Send, CheckCircle, XCircle, Loader2,
  Users, UserCheck, ImageIcon, TrendingUp, AlertTriangle,
  Star, ThumbsDown, Lightbulb, Quote, ChevronRight,
  BarChart2, History, ArrowUpRight, ArrowDownRight, Minus,
  Copy, Check, Zap, Film, LayoutGrid, MessageCircle, ExternalLink, Search, Trash2,
  Target, MessageSquare, RefreshCw,
} from 'lucide-react';
import { useAriaSpeech } from '@/hooks/useAriaSpeech';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ── Tipos ────────────────────────────────────────────────────────────────────

interface ProfileScore {
  overall: number;
  dimensions: {
    consistency: number;
    engagement: number;
    niche_clarity: number;
    cta_presence: number;
    bio_quality: number;
  };
}

interface TechniqueSelection {
  name: string;
  formula: string;
  application: string;
}

interface TechniquePlan {
  storytelling: TechniqueSelection[];
  persuasion: TechniqueSelection[];
  closing: TechniqueSelection;
}

interface ScriptData {
  title: string;
  hook: string;
  body: string;
  cta: string;
  framework: string;
  funnel_stage?: string;
  hook_technique?: string;
  technique_plan?: TechniquePlan;
  // Campos legado (sistema antigo — backward compat)
  format?: string;
  format_type?: string;
  format_name?: string;
  funnel_goal?: string;
  conversion_angle?: string;
  why_format?: string;
  why_framework?: string;
  visual_cues?: string[];
  filming_tip?: string;
}

interface ICPData {
  product: string;
  price_range: string;
  main_objection: string;
  ideal_customer: string;
  transformation: string;
}

// ── Carousel types (local — não importa do backend) ───────────────────────────
interface CarouselSlide {
  position: number;
  type: 'cover' | 'content' | 'cta';
  title: string;
  body: string;
  visual_hint: string;
}
interface CarouselStructure {
  title: string;
  format: string;
  total_slides: number;
  slides: CarouselSlide[];
}
interface CarouselState {
  loading: boolean;
  carousel: CarouselStructure | null;
  htmlExport: string | null;
  figmaUrl: string | null;
  error: string | null;
}

interface EngagementPanorama {
  profile_rate: string;
  classification: string;
  tier: string;
  tier_benchmark: string;
  verdict: string;
  market_position: string;
}

interface SuggestedICP {
  inferred_audience: string;
  inferred_product: string;
  recommended_positioning: string;
  main_pain_addressed: string;
  icp_next_steps: string[];
  icp_source: 'inferred' | 'provided';
}

interface TrendReferencePost {
  url: string;
  caption_preview: string;
  likes?: number;
  comments?: number;
  views?: number;
  type: string;
}

interface TrendResearchData {
  keywords_searched: string[];
  posts_analyzed: number;
  insights: { hook_pattern: string; angle: string; engagement_signal: string; example_hook: string; format: string }[];
  dominant_formats: string[];
  niche_summary: string;
  reference_posts: TrendReferencePost[];
}

interface MaverickReport {
  profile: {
    username: string;
    bio: string;
    followers: string;
    following: string;
    posts_count: string;
  };
  analysis: {
    positive_points: string[];
    profile_gaps: string[];
    best_posts: { caption_preview: string; reason: string }[];
    worst_posts: { caption_preview: string; reason: string }[];
  };
  strategy: {
    diagnosis: string;
    key_concept: string;
    citation: string;
    next_steps: string[];
    profile_score?: ProfileScore;
    engagement_panorama?: EngagementPanorama;
    suggested_icp?: SuggestedICP;
  };
}

interface HistoryEntry {
  id: string;
  createdAt: string;
  strategy: { profile_score?: ProfileScore; diagnosis?: string };
}

interface HistoryListEntry {
  id: string;
  username: string;
  createdAt: string;
  status: string;
  profile?: MaverickReport['profile'];
  analysis?: MaverickReport['analysis'];
  strategy?: MaverickReport['strategy'] & { profile_score?: ProfileScore };
  scripts?: ScriptData[];
  trendResearch?: TrendResearchData;
}

type Phase = 'home' | 'asking' | 'icp-form' | 'running-plan' | 'report' | 'keyword-confirm' | 'keyword-input' | 'running-scripts' | 'done' | 'error';

interface MaverickSessionProps {
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function* streamSse(
  endpoint: string,
  body: Record<string, unknown>,
): AsyncGenerator<{ type: string;[k: string]: unknown }> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    yield { type: 'error', message: `API ${res.status}` };
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr) continue;
      try {
        yield JSON.parse(jsonStr);
      } catch { /* ignora parse error */ }
    }
  }
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function MetricCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string; color: string;
}) {
  return (
    <div className={`flex flex-col gap-3 rounded-2xl p-6 border border-white/10 bg-white/5 backdrop-blur-xl shadow-lg transition-all hover:bg-white/[0.08]`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 opacity-60 ${color.split(' ')[1]}`} />
        <span className="text-[10px] text-white/40 uppercase tracking-widest font-black">{label}</span>
      </div>
      <span className="text-4xl font-black text-white leading-none tracking-tight">{value}</span>
    </div>
  );
}

function ListCard({ icon: Icon, title, items, color, emptyMsg }: {
  icon: React.ElementType; title: string; items: string[];
  color: { border: string; accent: string; dot: string }; emptyMsg: string;
}) {
  return (
    <div className={`rounded-2xl p-6 border border-white/10 bg-white/5 backdrop-blur-xl shadow-lg flex flex-col gap-5 transition-all hover:bg-white/[0.08]`}>
      <div className={`flex items-center gap-2.5 ${color.accent}`}>
        <Icon className="w-5 h-5" />
        <span className="text-base font-bold tracking-tight">{title}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-white/30 text-base italic">{emptyMsg}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-white/70 leading-relaxed">
              <span className={`mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0 ${color.dot} shadow-[0_0_8px_rgba(255,255,255,0.2)]`} />
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PostCard({ icon: Icon, title, posts, color }: {
  icon: React.ElementType; title: string;
  posts: { caption_preview: string; reason: string }[];
  color: { border: string; accent: string; badge: string };
}) {
  return (
    <div className={`rounded-2xl p-6 border border-white/10 bg-white/5 backdrop-blur-xl shadow-lg flex flex-col gap-5 transition-all hover:bg-white/[0.08]`}>
      <div className={`flex items-center gap-2.5 ${color.accent}`}>
        <Icon className="w-5 h-5" />
        <span className="text-base font-bold tracking-tight">{title}</span>
      </div>
      {posts.length === 0 ? (
        <p className="text-white/30 text-base italic">Sem dados suficientes</p>
      ) : (
        <div className="space-y-3">
          {posts.map((post, i) => (
            <div key={i} className={`rounded-xl p-4 border border-white/5 bg-white/[0.02]`}>
              <p className="text-emerald-400/80 text-[11px] font-mono leading-relaxed mb-2 font-bold uppercase tracking-wider line-clamp-1">
                "{post.caption_preview}"
              </p>
              <p className="text-white/60 text-sm leading-relaxed">{post.reason}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StepLog({ steps }: { steps: string[] }) {
  if (steps.length === 0) return null;
  return (
    <div className="space-y-1.5 mb-6">
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-2 text-sm text-white/50">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-500/70 flex-shrink-0 mt-0.5" />
          <span>{step}</span>
        </div>
      ))}
    </div>
  );
}

// ── Maverick Loading (New Design) ─────────────────────────────────────────────

interface MaverickLoadingProps {
  username: string;
  steps: string[];
}

function MaverickLoading({ username, steps: backendSteps }: MaverickLoadingProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const MAVERICK_LOADING_STEPS = [
    { label: 'SCOUT', text: 'Escaneando o perfil...' },
    { label: 'SCHOLAR', text: 'Consultando a base de conhecimento...' },
    { label: 'SCHOLAR', text: 'Cruzando dados com teoria...' },
    { label: 'STRATEGIST', text: 'Gerando diagnóstico...' },
    { label: 'MAVERICK', text: 'Montando o relatório final...' },
  ];

  useEffect(() => {
    const lastStep = backendSteps[backendSteps.length - 1] || '';
    if (lastStep.includes('Scout')) {
      setCurrentStepIndex(1); // Finish scout, on scholar 1
    } else if (lastStep.includes('Strategist')) {
      setCurrentStepIndex(3); // Finish scholar 2, on strategist
    }
    
    // Auto-advance for better feel (scholar 1 to scholar 2, strategist to maverick)
    const timer = setTimeout(() => {
      if (currentStepIndex === 1) setCurrentStepIndex(2);
      if (currentStepIndex === 3) setCurrentStepIndex(4);
    }, 3000);

    return () => clearTimeout(timer);
  }, [backendSteps, currentStepIndex]);

  return (
    <div className="fixed inset-0 bg-[#09090B] flex flex-col items-center justify-center p-6 z-[100] animate-in fade-in duration-500">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Header Username Badge */}
      <div className="bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg mb-14 relative z-10 transition-all hover:scale-105 hover:bg-white/10">
        <span className="text-sm font-black text-white tracking-tight">@{username.replace(/^@/, '')}</span>
      </div>

      {/* Lightning Icon */}
      <div className="relative mb-8 z-10 text-center flex flex-col items-center">
        <div className="w-16 h-16 rounded-[22px] bg-white/5 shadow-2xl flex items-center justify-center border border-white/10 relative overflow-hidden group mb-4">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <Zap className="w-8 h-8 text-orange-500 fill-orange-500 animate-[pulse_2s_infinite]" />
        </div>
      </div>

      <div className="text-center mb-12 z-10">
        <p className="text-[11px] font-black text-white/30 uppercase tracking-[0.25em] mb-3">Maverick</p>
        <h2 className="text-3xl font-black text-white tracking-tight mb-2.5">
          {MAVERICK_LOADING_STEPS[currentStepIndex].text}
        </h2>
        <p className="text-white/40 text-[15px] font-medium">
          Priorizando ações de maior impacto para esta semana
        </p>
      </div>

      {/* Steps Card */}
      <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[36px] p-8 w-full max-w-[420px] shadow-2xl z-10 space-y-7">
        {MAVERICK_LOADING_STEPS.map((step, i) => {
          const isDone = i < currentStepIndex;
          const isCurrent = i === currentStepIndex;
          
          return (
            <div key={i} className={`flex items-center justify-between transition-all duration-500 ${isDone ? 'opacity-40' : isCurrent ? 'opacity-100' : 'opacity-20'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all duration-500 ${
                  isDone 
                    ? 'bg-emerald-500 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]' 
                    : isCurrent 
                      ? 'bg-white/10 border-white/20' 
                      : 'bg-white/5 border-white/5'
                }`}>
                  {isDone ? (
                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                  ) : isCurrent ? (
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                  ) : null}
                </div>
                <div>
                  <p className={`text-[9px] font-black uppercase tracking-[0.15em] mb-0.5 ${isDone ? 'text-emerald-400/80' : isCurrent ? 'text-white/40' : 'text-white/20'}`}>
                    {step.label}
                  </p>
                  <p className={`text-[13.5px] font-bold tracking-tight ${isCurrent ? 'text-white' : 'text-white/50'}`}>
                    {step.text}
                  </p>
                </div>
              </div>
              
              {isDone ? (
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">concluído</span>
              ) : isCurrent ? (
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest animate-pulse">em andamento</span>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="mt-10 text-[11px] font-black text-white/10 uppercase tracking-[0.2em] z-10">
        {Math.min(currentStepIndex + 1, 5)} de 5 etapas
      </p>
      
      {/* Decorative elements */}
      <div className="absolute inset-0 pointer-events-none">
         <div className="absolute top-[20%] left-[10%] w-1.5 h-1.5 rounded-full bg-emerald-500/20" />
         <div className="absolute top-[40%] right-[15%] w-2 h-2 rounded-full bg-blue-500/20 blur-[1px]" />
         <div className="absolute bottom-[30%] left-[20%] w-1 h-1 rounded-full bg-white/5" />
      </div>
    </div>
  );
}

// ── Score Gauge ───────────────────────────────────────────────────────────────

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-sm">
        <span className="text-white/55">{label}</span>
        <span className={`font-bold ${color}`}>{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color.replace('text-', 'bg-')}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function ProfileScoreCard({ score }: { score: ProfileScore }) {
  const overall = score.overall;
  const color =
    overall >= 75 ? 'text-emerald-400' :
      overall >= 50 ? 'text-amber-400' :
        'text-rose-400';

  const dims = [
    { label: 'Consistência', key: 'consistency' as const },
    { label: 'Engajamento', key: 'engagement' as const },
    { label: 'Clareza de Nicho', key: 'niche_clarity' as const },
    { label: 'CTAs', key: 'cta_presence' as const },
    { label: 'Qualidade da Bio', key: 'bio_quality' as const },
  ];

  return (
    <div className="rounded-2xl p-8 border border-white/10 bg-white/5 backdrop-blur-xl shadow-lg">
      <div className="flex items-center gap-2.5 mb-8">
        <BarChart2 className="w-5 h-5 text-white/30" />
        <span className="text-base font-bold text-white/60 tracking-tight">Score do Perfil</span>
      </div>

      <div className="flex items-center gap-10 mb-2">
        {/* Nota geral em destaque */}
        <div className="flex flex-col items-center justify-center w-32 h-32 rounded-3xl border border-white/10 bg-white/5 shadow-inner flex-shrink-0">
          <span className={`text-6xl font-black ${color} tracking-tighter`}>{overall}</span>
          <span className="text-[10px] text-white/20 uppercase tracking-[0.2em] mt-1 font-bold">/ 100</span>
        </div>
        {/* Barras de dimensões */}
        <div className="flex-1 space-y-4">
          {dims.map(({ label, key }) => (
            <ScoreBar
              key={key}
              label={label}
              value={score.dimensions[key]}
              color={
                score.dimensions[key] >= 75 ? 'text-emerald-400' :
                  score.dimensions[key] >= 50 ? 'text-amber-400' :
                    'text-rose-400'
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Script Cards ──────────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copiado!' : label}
    </button>
  );
}

// Category-level config (by format field: "Reels" | "Carrossel")
const CATEGORY_CONFIG: Record<string, { icon: React.ElementType; gradient: string; badge: string }> = {
  'Reels': { icon: Film, gradient: 'from-purple-600/15 to-violet-500/5', badge: 'bg-purple-500/20 text-purple-300 border border-purple-500/30' },
  'Carrossel': { icon: LayoutGrid, gradient: 'from-cyan-600/15 to-blue-500/5', badge: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' },
};

// Format-type emoji icons
const FORMAT_TYPE_EMOJI: Record<string, string> = {
  reels_react: '😲',
  reels_caixinha: '❓',
  reels_terceira_pessoa: '🎥',
  reels_primeira_pessoa: '🤳',
  reels_talking_head: '🎙️',
  reels_tutorial: '📋',
  reels_broll_texto: '✨',
  reels_trend_meme: '🔥',
  carrossel_educativo: '📚',
  carrossel_narrativo: '📖',
  carrossel_antes_depois: '⚡',
  carrossel_opinion: '💬',
};

// ── Script Preview Card (compact, grid-friendly) ─────────────────────────────

function ScriptPreviewCard({ script, index, onClick }: {
  script: ScriptData; index: number; onClick: () => void;
}) {
  const cat = CATEGORY_CONFIG[script.format ?? 'Reels'] ?? CATEGORY_CONFIG['Reels'];
  const formatEmoji = FORMAT_TYPE_EMOJI[script.format_type ?? ''] ?? '🎬';
  const formatLabel = script.format_name || script.format || 'Reels';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl border border-white/10 overflow-hidden bg-white/5 backdrop-blur-xl hover:bg-white/10 hover:border-white/20 transition-all duration-300 group shadow-lg`}
    >
      {/* Header */}
      <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-white/5">
        <span className="text-xl font-black text-white/10 flex-shrink-0 leading-none mt-0.5">#{index + 1}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-black text-white leading-tight mb-2 line-clamp-2 tracking-tight">{script.title}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${cat.badge} uppercase tracking-wider`}>
              {formatEmoji} {formatLabel}
            </span>
            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10 uppercase tracking-wider">
              {script.framework}
            </span>
            {script.funnel_stage && (
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${script.funnel_stage === 'TOFU' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
                script.funnel_stage === 'MOFU' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                  'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                {script.funnel_stage}
              </span>
            )}
            {script.hook_technique && (
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300/70 border border-amber-500/20 uppercase tracking-wider">
                🎣 {script.hook_technique}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Hook preview */}
      <div className="px-5 py-4 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-1.5 mb-2">
          <Zap className="w-3 h-3 text-amber-400" />
          <p className="text-[9px] font-black text-amber-400 uppercase tracking-[0.2em]">Hook</p>
        </div>
        <p className="text-sm text-white/50 leading-relaxed line-clamp-2 font-medium italic">{script.hook}</p>
      </div>

      {/* CTA preview + open hint */}
      <div className="px-5 py-4 flex items-center justify-between gap-4">
        <p className="text-[11px] text-emerald-400/50 truncate flex-1 font-mono uppercase tracking-wider">
          {script.cta}
        </p>
        <span className="text-[10px] text-white/20 group-hover:text-emerald-400/80 transition-all flex-shrink-0 font-black uppercase tracking-widest">
          Ver roteiro →
        </span>
      </div>
    </button>
  );
}

// ── Script Modal (popup com roteiro completo) ─────────────────────────────────

function cleanScriptText(text: string | null | undefined): string {
  if (!text) return '';
  // Remove blocos entre colchetes como [Visual: ...], [Tom: ...], [0-3s], etc.
  return text.replace(/\[.*?\]/g, '').replace(/\n+/g, '\n\n').trim();
}

function ScriptModal({ script, index, onClose }: {
  script: ScriptData; index: number; onClose: () => void;
}) {
  const cat = CATEGORY_CONFIG[script.format ?? 'Reels'] ?? CATEGORY_CONFIG['Reels'];
  const formatEmoji = FORMAT_TYPE_EMOJI[script.format_type ?? ''] ?? '🎬';
  const formatLabel = script.format_name || script.format || 'Reels';

  // Limpando os textos para remover a direção e deixar apenas a fala/texto
  const cleanHook = cleanScriptText(script.hook);
  const cleanBody = cleanScriptText(script.body);
  const cleanCta = cleanScriptText(script.cta);

  const bodyLines = cleanBody.split('\n').filter(Boolean);
  const fullText = `HOOK:\n${cleanHook}\n\nROTEIRO:\n${cleanBody}\n\nCTA:\n${cleanCta}`;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={handleBackdrop}
    >
      <div className={`relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border border-white/10 overflow-hidden bg-[#0d0d12] backdrop-blur-2xl bg-gradient-to-br ${cat.gradient} shadow-2xl`}>
        {/* Modal header */}
        <div className="flex items-start gap-3 px-8 pt-8 pb-6 border-b border-white/5 flex-shrink-0">
          <span className="text-2xl font-black text-white/10 flex-shrink-0 leading-none mt-1">#{index + 1}</span>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black text-white leading-tight mb-3 tracking-tight">{script.title}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-black px-3 py-1 rounded-full ${cat.badge} uppercase tracking-wider`}>
                {formatEmoji} {formatLabel}
              </span>
              <span className="text-[10px] font-black px-3 py-1 rounded-full bg-white/5 text-white/40 border border-white/10 uppercase tracking-wider">
                {script.framework}
              </span>
              {script.funnel_stage && (
                <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${script.funnel_stage === 'TOFU' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
                  script.funnel_stage === 'MOFU' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                    'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                  {script.funnel_stage}{script.funnel_goal ? ` · ${script.funnel_goal}` : ''}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <CopyButton text={fullText} label="Copiar tudo" />
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/20 hover:text-white hover:bg-white/10 transition-all border border-transparent hover:border-white/10"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Técnicas usadas (novo formato) */}
          {script.technique_plan && (
            <div className="rounded-xl px-4 py-3 bg-white/[0.02] border border-white/[0.05] space-y-2">
              <p className="text-[9px] font-black text-white/25 uppercase tracking-[0.2em] mb-2">Brain — Técnicas aplicadas</p>
              {script.hook_technique && (
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-bold text-amber-400/60 w-20 flex-shrink-0">Hook</span>
                  <span className="text-[10px] text-amber-300/50">{script.hook_technique}</span>
                </div>
              )}
              {script.technique_plan.storytelling && (
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-bold text-blue-400/60 w-20 flex-shrink-0">Story</span>
                  <span className="text-[10px] text-blue-300/50">{typeof script.technique_plan.storytelling === 'string' ? script.technique_plan.storytelling : (script.technique_plan.storytelling as any).name}</span>
                </div>
              )}
              {script.technique_plan.persuasion && (
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-bold text-purple-400/60 w-20 flex-shrink-0">Persuasão</span>
                  <span className="text-[10px] text-purple-300/50">{typeof script.technique_plan.persuasion === 'string' ? script.technique_plan.persuasion : (script.technique_plan.persuasion as any).name}</span>
                </div>
              )}
              {script.technique_plan.closing?.name && (
                <div className="flex items-start gap-2">
                  <span className="text-[10px] font-bold text-emerald-400/60 w-20 flex-shrink-0">Closing</span>
                  <span className="text-[10px] text-emerald-300/50">{script.technique_plan.closing.name}</span>
                </div>
              )}
            </div>
          )}

          {/* Why choices + conversion angle (legado) */}
          {(script.why_format || script.why_framework || script.conversion_angle) && (
            <div className="rounded-xl px-4 py-3 bg-white/[0.02] border border-white/[0.05] space-y-2">
              {script.why_format && (
                <div className="flex items-start gap-3">
                  <span className="text-[11px] font-bold text-white/25 uppercase tracking-widest flex-shrink-0 mt-0.5 w-14">Formato</span>
                  <p className="text-sm text-white/50 italic leading-relaxed">{script.why_format}</p>
                </div>
              )}
              {script.why_framework && (
                <div className="flex items-start gap-3">
                  <span className="text-[11px] font-bold text-white/25 uppercase tracking-widest flex-shrink-0 mt-0.5 w-14">Copy</span>
                  <p className="text-sm text-white/45 italic leading-relaxed">{script.why_framework}</p>
                </div>
              )}
              {script.conversion_angle && (
                <div className="flex items-start gap-3">
                  <span className="text-[11px] font-bold text-emerald-400/40 uppercase tracking-widest flex-shrink-0 mt-0.5 w-14">Angulo</span>
                  <p className="text-sm text-emerald-300/60 italic leading-relaxed">{script.conversion_angle}</p>
                </div>
              )}
            </div>
          )}

          {/* Hook */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                <span className="text-sm font-bold text-amber-400 uppercase tracking-widest">Hook</span>
              </div>
              <CopyButton text={cleanHook} label="Copiar hook" />
            </div>
            <div className="rounded-xl px-6 py-5 bg-[#17171A] border border-white/[0.08] shadow-inner">
              <p className="text-lg text-white font-medium leading-relaxed">{cleanHook}</p>
            </div>
          </div>

          {/* Desenvolvimento */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-white/50" />
                <span className="text-sm font-bold text-white/50 uppercase tracking-widest">Desenvolvimento</span>
              </div>
              <CopyButton text={cleanBody} label="Copiar desenvolvimento" />
            </div>
            <div className="rounded-xl px-6 py-5 bg-[#17171A] border border-white/[0.08] shadow-inner space-y-4">
              {bodyLines.map((line, i) => {
                const isSlideHeader = /^(Slide|SLIDE|##)\s/.test(line.trim());
                return (
                  <p key={i} className={`leading-relaxed ${isSlideHeader ? 'text-white/60 text-sm font-bold uppercase tracking-wider pt-2' : 'text-lg text-white font-medium'}`}>
                    {line}
                  </p>
                );
              })}
            </div>
          </div>

          {/* CTA */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-400" />
                <span className="text-sm font-bold text-emerald-400 uppercase tracking-widest">CTA</span>
              </div>
              <CopyButton text={cleanCta} label="Copiar CTA" />
            </div>
            <div className="rounded-xl px-6 py-5 bg-[#17171A] border border-emerald-500/20 shadow-inner">
              <p className="text-lg text-emerald-50 font-semibold leading-relaxed">{cleanCta}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Engagement Panorama Card ──────────────────────────────────────────────────

const PANORAMA_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  'Otimo': { bg: 'bg-violet-500/10', border: 'border-violet-500/30', text: 'text-violet-300', badge: 'bg-violet-500/20 text-violet-200' },
  'Muito Bom': { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300', badge: 'bg-emerald-500/20 text-emerald-200' },
  'Bom': { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-300', badge: 'bg-cyan-500/20 text-cyan-200' },
  'Abaixo da Media': { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-300', badge: 'bg-amber-500/20 text-amber-200' },
  'Ruim': { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-300', badge: 'bg-rose-500/20 text-rose-200' },
};

const SCALE_ITEMS = [
  { label: 'Ruim', max: 0.5 },
  { label: 'Abaixo da Media', max: 1.0 },
  { label: 'Bom', max: 3.0 },
  { label: 'Muito Bom', max: 6.0 },
  { label: 'Otimo', max: Infinity },
];

function EngagementPanoramaCard({ panorama }: { panorama: EngagementPanorama }) {
  const classification = panorama.classification || 'Bom';
  const colors = PANORAMA_COLORS[classification] ?? PANORAMA_COLORS['Bom'];
  const rate = parseFloat(panorama.profile_rate ?? '0') || 0;

  // Scale position: log scale for visual clarity
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const scalePercent = clamp((rate / 7) * 100, 2, 98);

  const scaleColors = ['bg-rose-500', 'bg-amber-500', 'bg-cyan-400', 'bg-emerald-400', 'bg-violet-400'];

  return (
    <div className={`rounded-2xl p-8 border border-white/10 bg-white/5 backdrop-blur-xl shadow-lg transition-all hover:bg-white/[0.08]`}>
      <div className="flex items-center gap-2.5 mb-8">
        <TrendingUp className={`w-5 h-5 ${colors.text}`} />
        <span className={`text-base font-bold text-white/70 tracking-tight`}>Panorama de Engajamento</span>
        <span className={`ml-auto text-[10px] font-black px-3 py-1 rounded-full ${colors.badge} uppercase tracking-wider`}>
          {classification}
        </span>
      </div>

      {/* Rate + tier */}
      <div className="flex items-baseline gap-4 mb-8">
        <span className={`text-6xl font-black ${colors.text} tracking-tighter`}>{panorama.profile_rate}</span>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold">taxa média</span>
          <span className="text-sm text-white/50 font-medium">{panorama.tier} · {panorama.market_position}</span>
        </div>
      </div>

      {/* Visual scale bar */}
      <div className="mb-6">
        <div className="flex h-1.5 rounded-full overflow-hidden gap-1 mb-3">
          {scaleColors.map((c, i) => (
            <div key={i} className={`flex-1 ${c} opacity-20`} />
          ))}
        </div>
        <div className="relative h-1">
          <div
            className={`absolute top-0 w-2.5 h-2.5 rounded-full -translate-y-1 ${colors.text.replace('text-', 'bg-')} shadow-[0_0_12px_rgba(255,255,255,0.3)]`}
            style={{ left: `${scalePercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[8px] text-white/20 mt-4 uppercase tracking-[0.2em] font-black">
          <span>Ruim</span>
          <span>Abaixo</span>
          <span>Bom</span>
          <span>Muito Bom</span>
          <span>Ótimo</span>
        </div>
      </div>

      {/* Benchmark reference */}
      <div className="rounded-xl p-4 bg-white/5 border border-white/5 mb-5 mb-6">
        <p className="text-[9px] text-white/20 uppercase tracking-widest mb-1.5 font-bold">Referência para {panorama.tier}</p>
        <p className="text-xs text-white/40 font-mono tracking-tight">{panorama.tier_benchmark}</p>
      </div>

      {/* Verdict */}
      <p className="text-base text-white/60 leading-relaxed font-medium">{panorama.verdict}</p>
    </div>
  );
}

// ── Comparison Panel ──────────────────────────────────────────────────────────

function ScoreDelta({ current, previous, label }: { current: number; previous: number; label: string }) {
  const delta = current - previous;
  const Icon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus;
  const color = delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-rose-400' : 'text-white/40';

  return (
    <div className="flex flex-col gap-1 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      <span className="text-[10px] text-white/30 uppercase tracking-wider">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold text-white">{current}</span>
        <div className={`flex items-center gap-0.5 text-xs font-semibold ${color}`}>
          <Icon className="w-3.5 h-3.5" />
          {delta !== 0 ? Math.abs(delta) : '='}
        </div>
      </div>
      <span className="text-[11px] text-white/25">anterior: {previous}</span>
    </div>
  );
}

function SuggestedICPCard({ sicp }: { sicp: SuggestedICP }) {
  const isInferred = sicp.icp_source === 'inferred';
  return (
    <div className={`rounded-2xl p-8 border border-white/10 bg-white/5 backdrop-blur-xl shadow-lg transition-all hover:bg-white/[0.08]`}>
      <div className="flex items-center gap-2.5 mb-7">
        <Lightbulb className={`w-5 h-5 ${isInferred ? 'text-violet-400' : 'text-indigo-400'}`} />
        <span className={`text-base font-bold text-white/70 tracking-tight`}>
          {isInferred ? 'Posicionamento Inferido' : 'Posicionamento Validado'}
        </span>
        <span className={`ml-auto text-[10px] font-black px-3 py-1 rounded-full bg-white/5 text-white/40 border border-white/10 uppercase tracking-wider`}>
          {isInferred ? 'Inferido' : 'Validado'}
        </span>
      </div>

      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl p-5 bg-white/5 border border-white/5">
            <p className="text-[10px] text-white/20 uppercase tracking-widest mb-2 font-bold">Público provável</p>
            <p className="text-sm text-white/60 leading-relaxed font-medium">{sicp.inferred_audience}</p>
          </div>
          <div className="rounded-xl p-5 bg-white/5 border border-white/5">
            <p className="text-[10px] text-white/20 uppercase tracking-widest mb-2 font-bold">Produto / Oferta</p>
            <p className="text-sm text-white/60 leading-relaxed font-medium">{sicp.inferred_product}</p>
          </div>
        </div>

        <div className="rounded-xl p-5 bg-white/10 border border-white/5 shadow-inner">
          <p className="text-[10px] text-white/25 uppercase tracking-widest mb-2 font-bold">Posicionamento recomendado</p>
          <p className="text-base text-white font-bold leading-relaxed tracking-tight">{sicp.recommended_positioning}</p>
        </div>

        <div className="rounded-xl p-5 bg-white/5 border border-white/5">
          <p className="text-[10px] text-white/20 uppercase tracking-widest mb-2 font-bold">Dor principal a enderecar</p>
          <p className="text-sm text-white/50 leading-relaxed italic">{sicp.main_pain_addressed}</p>
        </div>

        {sicp.icp_next_steps?.length > 0 && (
          <div className="pt-2">
            <p className="text-[10px] text-white/25 uppercase tracking-widest mb-4 font-bold">Proximos passos</p>
            <ul className="space-y-3">
              {sicp.icp_next_steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-white/50 leading-relaxed">
                  <span className={`mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-white/10 shadow-[0_0_8px_rgba(255,255,255,0.1)]`} />
                  {step}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Trend References Panel ────────────────────────────────────────────────────

function TrendReferencesPanel({ data }: { data: TrendResearchData }) {
  const [open, setOpen] = useState(false);
  if (!data.reference_posts?.length) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-lg overflow-hidden transition-all hover:bg-white/[0.08]">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 px-6 py-5 text-left transition-colors"
      >
        <Search className="w-5 h-5 text-emerald-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-base font-bold text-white tracking-tight">Referências pesquisadas</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-black text-emerald-400/60 uppercase tracking-wider">
              {data.reference_posts.length} posts virais
            </span>
            <span className="text-white/20 text-xs">•</span>
            <span className="text-[10px] text-white/30 truncate uppercase tracking-wider font-medium">
              {data.keywords_searched.slice(0, 3).join(', ')}
            </span>
          </div>
        </div>
        <ChevronRight className={`w-5 h-5 text-white/20 transition-transform duration-300 ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          {data.niche_summary && (
            <p className="text-xs text-white/40 leading-relaxed border-t border-white/[0.06] pt-4">{data.niche_summary}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {data.reference_posts.map((post, i) => (
              <div key={i} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 flex flex-col gap-3">
                <p className="text-xs text-white/55 leading-relaxed line-clamp-3">
                  &ldquo;{post.caption_preview}&rdquo;
                </p>
                <div className="flex items-center gap-3 text-[11px] text-white/35 flex-wrap">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />{post.likes?.toLocaleString('pt-BR') ?? '—'}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" />{post.comments?.toLocaleString('pt-BR') ?? '—'}
                  </span>
                  {post.views != null && (
                    <span className="flex items-center gap-1">
                      <Film className="w-3 h-3" />{post.views.toLocaleString('pt-BR')}
                    </span>
                  )}
                  <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full ${post.type === 'Video' || post.type === 'Reel'
                    ? 'bg-purple-500/15 text-purple-300 border border-purple-500/20'
                    : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/20'
                    }`}>
                    {post.type === 'Video' || post.type === 'Reel' ? '🎬 Reels' : '🖼 Post'}
                  </span>
                </div>
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[11px] text-indigo-400/70 hover:text-indigo-300 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Ver no Instagram
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ComparisonPanel({ current, previous, previousDate }: {
  current: MaverickReport;
  previous: HistoryEntry;
  previousDate: string;
}) {
  const curScore = current.strategy.profile_score;
  const prevScore = previous.strategy.profile_score;
  if (!curScore || !prevScore) return null;

  const dims = [
    { label: 'Consistência', key: 'consistency' as const },
    { label: 'Engajamento', key: 'engagement' as const },
    { label: 'Nicho', key: 'niche_clarity' as const },
    { label: 'CTAs', key: 'cta_presence' as const },
    { label: 'Bio', key: 'bio_quality' as const },
  ];

  const dateStr = new Date(previousDate).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <div className="rounded-2xl p-8 border border-white/10 bg-white/5 backdrop-blur-xl shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <History className="w-5 h-5 text-emerald-400" />
        <span className="text-base font-bold text-white tracking-tight">Evolução vs. análise de {dateStr}</span>
      </div>

      {/* Score geral */}
      <div className="mb-4">
        <ScoreDelta
          label="Score Geral"
          current={curScore.overall}
          previous={prevScore.overall}
        />
      </div>

      {/* Dimensões */}
      <div className="grid grid-cols-5 gap-2">
        {dims.map(({ label, key }) => (
          <ScoreDelta
            key={key}
            label={label}
            current={curScore.dimensions[key]}
            previous={prevScore.dimensions[key]}
          />
        ))}
      </div>

      {/* Diagnóstico anterior */}
      {previous.strategy.diagnosis && (
        <div className="mt-4 rounded-xl p-4 bg-white/[0.03] border border-white/[0.06]">
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Diagnóstico anterior</p>
          <p className="text-xs text-white/45 leading-relaxed italic">{previous.strategy.diagnosis}</p>
        </div>
      )}
    </div>
  );
}

// ── Componente Principal ──────────────────────────────────────────────────────

// Gera o texto do briefing a partir do relatório — conciso, para ser lido em voz alta
function buildBriefing(report: MaverickReport): string {
  const score = report.strategy.profile_score?.overall;
  const scoreText = score != null ? `Score geral: ${score} de 100. ` : '';

  const positivos = report.analysis.positive_points.slice(0, 2).join(' e ');
  const brechas = report.analysis.profile_gaps.slice(0, 2).join(' e ');

  const posText = positivos ? `Pontos fortes: ${positivos}. ` : '';
  const brecText = brechas ? `Principais brechas: ${brechas}. ` : '';

  const diagnostico = report.strategy.diagnosis
    ? `Diagnóstico: ${report.strategy.diagnosis.slice(0, 200)}${report.strategy.diagnosis.length > 200 ? '...' : ''}`
    : '';

  return `Análise do perfil @${report.profile.username} concluída. ${scoreText}${posText}${brecText}${diagnostico}`;
}

// ── Keyword Confirm Modal ─────────────────────────────────────────────────────

function KeywordConfirmModal({
  keywords,
  loading,
  maxAgeDays,
  onChangeMaxAge,
  onConfirm,
  onReject,
  onEdit,
}: {
  keywords: string[];
  loading: boolean;
  maxAgeDays: number;
  onChangeMaxAge: (days: number) => void;
  onConfirm: () => void;
  onReject: () => void;
  onEdit: (index: number, value: string) => void;
}) {
  const hasAllKeywords = keywords.length === 3 && keywords.every(k => k.trim().length > 0);

  const DATE_OPTIONS = [30, 45, 60, 90, 120] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#18181b] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <Search className="w-4 h-4 text-emerald-400" />
          </div>
          <h3 className="text-white font-semibold text-sm">Confirme as buscas no Instagram</h3>
        </div>

        {/* Explicação */}
        <div className="ml-11 mb-5">
          <p className="text-white/50 text-xs leading-relaxed">
            O Maverick vai abrir o Instagram e pesquisar esses termos para encontrar os vídeos mais virais do seu nicho. Os roteiros serão criados com base nesses resultados.
          </p>
          <p className="text-white/30 text-xs mt-1.5">
            Edite se os termos não representam bem o seu público.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-white/40">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Analisando o ICP para sugerir as melhores buscas...</span>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-5">
              {keywords.map((kw, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-white/25 text-xs w-4 text-right flex-shrink-0">{i + 1}.</span>
                  <input
                    type="text"
                    value={kw}
                    onChange={e => onEdit(i, e.target.value)}
                    className="flex-1 bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.08] transition-all"
                    placeholder="ex: como emagrecer rápido"
                  />
                </div>
              ))}
            </div>

            {/* Seletor de período */}
            <div className="mb-5">
              <p className="text-white/35 text-[11px] font-semibold uppercase tracking-wider mb-2">Período de busca</p>
              <div className="flex gap-1.5">
                {DATE_OPTIONS.map(days => (
                  <button
                    key={days}
                    onClick={() => onChangeMaxAge(days)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all border ${maxAgeDays === days
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-white/[0.04] border-white/[0.08] text-white/35 hover:bg-white/[0.08] hover:text-white/60'
                      }`}
                  >
                    {days}d
                  </button>
                ))}
              </div>
              <p className="text-white/20 text-[10px] mt-1.5">
                Posts publicados nos últimos {maxAgeDays} dias. Aumente se encontrar poucos resultados.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={onReject}
                className="px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl text-white/50 text-sm transition-all"
                title="Gerar novas sugestões"
              >
                Refazer
              </button>
              <button
                onClick={onConfirm}
                disabled={!hasAllKeywords}
                className={`flex-1 px-4 py-2.5 border rounded-xl text-sm font-semibold transition-all ${hasAllKeywords ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/30 text-emerald-300' : 'bg-white/[0.03] border-white/[0.06] text-white/25 cursor-not-allowed'}`}
              >
                Buscar e Gerar Roteiros
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function MaverickSession({ onClose }: MaverickSessionProps) {
  const [phase, setPhase] = useState<Phase>('home');
  const [username, setUsername] = useState('');
  const [steps, setSteps] = useState<string[]>([]);
  const [report, setReport] = useState<MaverickReport | null>(null);
  const [rawPlan, setRawPlan] = useState('');
  const [scripts, setScripts] = useState('');
  const [streamingScripts, setStreamingScripts] = useState('');
  const [parsedScripts, setParsedScripts] = useState<ScriptData[] | null>(null);
  const [selectedScript, setSelectedScript] = useState<{ script: ScriptData; index: number } | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [trendResearch, setTrendResearch] = useState<TrendResearchData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [icp, setIcp] = useState<ICPData>({
    product: '', price_range: '', main_objection: '', ideal_customer: '', transformation: '',
  });
  const [previousAnalysis, setPreviousAnalysis] = useState<HistoryEntry | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryListEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);
  const [keywordsLoading, setKeywordsLoading] = useState(false);
  const [selectedMaxAge, setSelectedMaxAge] = useState(45);
  const selectedMaxAgeRef = useRef(45);
  // Mantém a ref sempre sincronizada com o estado
  useEffect(() => { selectedMaxAgeRef.current = selectedMaxAge; }, [selectedMaxAge]);
  const [carouselState, setCarouselState] = useState<CarouselState>({
    loading: false, carousel: null, htmlExport: null, figmaUrl: null, error: null,
  });
  const [carouselTheme, setCarouselTheme] = useState<'dark' | 'light'>('dark');
  const [directKeywordInput, setDirectKeywordInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<boolean>(false);

  const { speak, stop: stopSpeech } = useAriaSpeech();
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Para o TTS ao sair do modo Maverick
  useEffect(() => {
    return () => { stopSpeech(); };
  }, [stopSpeech]);

  useEffect(() => {
    if (phase === 'asking') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [phase]);

  const handleToggleSpeech = useCallback(() => {
    if (isSpeaking) {
      stopSpeech();
      setIsSpeaking(false);
    } else if (report) {
      setIsSpeaking(true);
      speak(buildBriefing(report));
      // O TTS não expõe onEnd aqui, então reseta após duração estimada
      const words = buildBriefing(report).split(' ').length;
      setTimeout(() => setIsSpeaking(false), words * 400);
    }
  }, [isSpeaking, report, speak, stopSpeech]);

  const addStep = useCallback((msg: string) => {
    setSteps(prev => [...prev, msg]);
  }, []);

  const handleLoadHistoryEntry = useCallback((entry: HistoryListEntry) => {
    if (!entry.profile || !entry.analysis || !entry.strategy) return;
    stopSpeech();
    setIsSpeaking(false);
    const reconstructed: MaverickReport = {
      profile: entry.profile,
      analysis: entry.analysis,
      strategy: entry.strategy,
    };
    setReport(reconstructed);
    setRawPlan(JSON.stringify(reconstructed));
    setAnalysisId(entry.id);
    setUsername(entry.profile.username);
    setSteps([]);
    setPreviousAnalysis(null);
    setShowComparison(false);
    setShowHistory(false);
    if (entry.trendResearch) setTrendResearch(entry.trendResearch);
    else setTrendResearch(null);
    // Carrega scripts salvos (se houver) — serão exibidos no phase report
    if (entry.scripts && Array.isArray(entry.scripts) && entry.scripts.length > 0) {
      setParsedScripts(entry.scripts as ScriptData[]);
    } else {
      setParsedScripts(null);
    }
    setPhase('report');
  }, [stopSpeech]);

  // Carrega lista de análises e restaura sessão ativa no mount
  useEffect(() => {
    async function initMaverick() {
      try {
        const res = await fetch(`${API_URL}/api/maverick/history?limit=20`);
        if (!res.ok) return;
        const data = await res.json();
        setHistoryItems(data.analyses ?? []);

        // Restaura análise aberta antes do F5
        const activeUser = localStorage.getItem('maverick_active_user');
        if (activeUser) {
          const fetchFull = await fetch(`${API_URL}/api/maverick/history/${activeUser}`);
          if (fetchFull.ok) {
            const fullData = await fetchFull.json();
            const fullAnalyses = fullData.analyses ?? [];
            if (fullAnalyses.length > 0) {
              handleLoadHistoryEntry(fullAnalyses[0]);
            }
          }
        }
      } catch { /* ignora */ }
    }
    initMaverick();
  }, [handleLoadHistoryEntry]);

  // Salva no localStorage a análise atual para resistir ao refresh (F5)
  useEffect(() => {
    if (username && (phase === 'report' || phase === 'done')) {
      localStorage.setItem('maverick_active_user', username);
    } else if (phase === 'home') {
      localStorage.removeItem('maverick_active_user');
    }
  }, [username, phase]);

  // Auto-gera carrossel quando scripts chegam (primeiro script)
  useEffect(() => {
    if (parsedScripts && parsedScripts.length > 0 && !carouselState.carousel && !carouselState.loading) {
      generateCarousel(parsedScripts[0], carouselTheme);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedScripts]);

  const handleClearHistory = useCallback(async () => {
    if (!confirm('Tem certeza que deseja limpar todo o histórico? Esta ação não pode ser desfeita.')) return;
    setClearingHistory(true);
    try {
      await fetch(`${API_URL}/api/maverick/history`, { method: 'DELETE' });
      setHistoryItems([]);
    } catch {
      // silently ignore
    } finally {
      setClearingHistory(false);
    }
  }, []);

  const fetchPreviousAnalysis = useCallback(async (user: string) => {
    try {
      const res = await fetch(`${API_URL}/api/maverick/history/${user}`);
      if (!res.ok) return;
      const data = await res.json();
      // Pega a penúltima análise (a última é a atual que acabou de ser salva)
      const entries: HistoryEntry[] = (data.analyses ?? []).filter(
        (a: any) => a.strategy?.profile_score
      );
      if (entries.length >= 2) {
        setPreviousAnalysis(entries[1]); // índice 1 = penúltima (mais recente anterior)
      } else if (entries.length === 1 && data.analyses.length > 1) {
        // histórico sem score: usa a segunda entrada disponível
        setPreviousAnalysis(data.analyses[1]);
      }
    } catch { /* ignora */ }
  }, []);

  const handleGoToIcpForm = useCallback(() => {
    const clean = username.trim().replace(/^@/, '');
    if (!clean) return;
    setPhase('icp-form');
  }, [username]);

  const handleAnalyze = useCallback(async (icpOverride?: ICPData) => {
    const clean = username.trim().replace(/^@/, '');
    if (!clean) return;

    setPhase('running-plan');
    setSteps([]);
    setReport(null);
    setRawPlan('');
    setAnalysisId(null);
    setPreviousAnalysis(null);
    setShowComparison(false);
    abortRef.current = false;

    const activeIcp = icpOverride ?? icp;
    const icpPayload = activeIcp.product ? activeIcp : undefined;

    try {
      for await (const event of streamSse('/api/maverick/plan', {
        username: clean,
        ...(icpPayload ? { icp: icpPayload as unknown as string } : {}),
      } as any)) {
        if (abortRef.current) break;

        switch (event.type) {
          case 'step':
            addStep(event.message as string);
            break;
          case 'analysis_id':
            setAnalysisId(event.analysisId as string);
            break;
          case 'plan': {
            const content = event.content as string;
            setRawPlan(content);
            try {
              const parsed = JSON.parse(content) as MaverickReport;
              setReport(parsed);
              setPhase('report');
              // Busca histórico em background para o modo Antes/Depois
              fetchPreviousAnalysis(clean);
            } catch {
              setReport(null);
              setPhase('report');
            }
            break;
          }
          case 'error':
            setErrorMsg(event.message as string);
            setPhase('error');
            return;
        }
      }
    } catch (err: any) {
      if (!abortRef.current) {
        setErrorMsg(err.message ?? 'Erro de conexão com o servidor');
        setPhase('error');
      }
    }
  }, [username, addStep, fetchPreviousAnalysis]);

  // Abre o modal de confirmação de keywords antes de gerar roteiros
  const handleApprove = useCallback(async () => {
    setPhase('keyword-confirm');
    setKeywordsLoading(true);
    setSuggestedKeywords([]);

    try {
      const res = await fetch(`${API_URL}/api/maverick/keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: rawPlan }),
      });
      const data = await res.json();
      const kws = Array.isArray(data.keywords) && data.keywords.length > 0
        ? data.keywords
        : ['', '', ''];
      setSuggestedKeywords(kws);
    } catch {
      setSuggestedKeywords(['', '', '']);
    } finally {
      setKeywordsLoading(false);
    }
  }, [rawPlan]);

  // Gera estrutura de carrossel para o primeiro script
  const generateCarousel = useCallback(async (script: ScriptData, theme: 'dark' | 'light' = 'dark') => {
    setCarouselState(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(`${API_URL}/api/maverick/carousel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script, theme }),
      });
      if (!res.ok) throw new Error('Falha ao gerar carrossel');
      const data = await res.json();
      setCarouselState({
        loading: false,
        carousel: data.carousel ?? null,
        htmlExport: data.htmlExport ?? null,
        figmaUrl: data.figmaUrl ?? null,
        error: null,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setCarouselState(s => ({ ...s, loading: false, error: msg }));
    }
  }, []);

  function downloadHtml(html: string) {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maverick-carousel-${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Gera roteiros com keywords confirmadas
  const handleConfirmKeywords = useCallback(async (keywords: string[]) => {
    setPhase('running-scripts');
    setStreamingScripts('');
    setScripts('');
    setParsedScripts(null);
    setTrendResearch(null);
    abortRef.current = false;
    setSteps([]);

    try {
      const body: Record<string, unknown> = { plan: rawPlan, skipTrendResearch: true };
      if (analysisId) body.analysisId = analysisId;

      for await (const event of streamSse('/api/maverick/scripts', body)) {
        if (abortRef.current) break;

        switch (event.type) {
          case 'step':
            addStep(event.message as string);
            break;
          case 'trend_research':
            setTrendResearch(event.content as TrendResearchData);
            break;
          case 'chunk':
            setStreamingScripts(prev => prev + (event.content as string));
            break;
          case 'scripts': {
            const raw = event.content as string;
            setScripts(raw);
            try {
              const parsed = JSON.parse(raw) as ScriptData[];
              setParsedScripts(Array.isArray(parsed) ? parsed : null);
            } catch {
              setParsedScripts(null);
            }
            setPhase('done');
            break;
          }
          case 'low_results': {
            // Sugestão automática de ampliar período
            const suggested = event.suggestedMaxAge as number;
            const nextOption = [45, 60, 90, 120].find(d => d > selectedMaxAge) ?? 120;
            const newAge = suggested ?? nextOption;
            addStep(`⚠️ Poucos vídeos encontrados para ${selectedMaxAge}d. Sugerido: ampliar para ${newAge}d`);
            break;
          }
          case 'error':
            setErrorMsg(event.message as string);
            setPhase('error');
            return;
        }
      }
    } catch (err: any) {
      if (!abortRef.current) {
        setErrorMsg(err.message ?? 'Erro durante a geração dos roteiros');
        setPhase('error');
      }
    }
  }, [rawPlan, analysisId, addStep, selectedMaxAge]);

  const handleGenerateFromKeywords = useCallback(async () => {
    const keywords = directKeywordInput.split(',').map(k => k.trim()).filter(Boolean);
    if (keywords.length === 0) return;

    const mainTopic = keywords[0];
    const plan = JSON.stringify({
      strategy: {
        key_concept: mainTopic,
        diagnosis: `Criador de conteúdo sobre ${keywords.join(', ')} para empreendedores brasileiros.`,
        suggested_icp: {
          inferred_audience: 'Empreendedores e donos de negócio 25-45 anos que querem crescer',
          inferred_product: `Curso, consultoria ou serviço relacionado a ${mainTopic}`,
          main_pain_addressed: `Perdem tempo e dinheiro por não dominar ${mainTopic}`,
        },
        funnel_mix: { tofu_pct: 40, mofu_pct: 35, bofu_pct: 25 },
        next_steps: keywords,
      },
    });

    setRawPlan(plan);
    setPhase('running-scripts');
    setStreamingScripts('');
    setScripts('');
    setParsedScripts(null);
    setTrendResearch(null);
    abortRef.current = false;
    setSteps([]);

    try {
      for await (const event of streamSse('/api/maverick/scripts', { plan, skipTrendResearch: true })) {
        if (abortRef.current) break;
        switch (event.type) {
          case 'step':
            addStep(event.message as string);
            break;
          case 'scripts': {
            const raw = event.content as string;
            setScripts(raw);
            try {
              const parsed = JSON.parse(raw) as ScriptData[];
              setParsedScripts(Array.isArray(parsed) ? parsed : null);
            } catch { setParsedScripts(null); }
            setPhase('done');
            break;
          }
          case 'error':
            setErrorMsg(event.message as string);
            setPhase('error');
            return;
        }
      }
    } catch (err: any) {
      if (!abortRef.current) {
        setErrorMsg(err.message ?? 'Erro durante a geração dos roteiros');
        setPhase('error');
      }
    }
  }, [directKeywordInput, addStep]);

  const handleReset = useCallback(() => {
    abortRef.current = true;
    stopSpeech();
    setIsSpeaking(false);
    setPhase('home');
    setUsername('');
    setSteps([]);
    setReport(null);
    setRawPlan('');
    setScripts('');
    setStreamingScripts('');
    setParsedScripts(null);
    setSelectedScript(null);
    setAnalysisId(null);
    setTrendResearch(null);
    setErrorMsg('');
    setPreviousAnalysis(null);
    setShowComparison(false);
    setShowHistory(false);
    setSuggestedKeywords([]);
    setKeywordsLoading(false);
    setIcp({ product: '', price_range: '', main_objection: '', ideal_customer: '', transformation: '' });
    // Recarrega o histórico ao voltar para home
    fetch(`${API_URL}/api/maverick/history?limit=20`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setHistoryItems(data.analyses ?? []); })
      .catch(() => { });
  }, [stopSpeech]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGoToIcpForm();
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#09090B]">

      {/* ── Keyword Confirm Modal ── */}
      {phase === 'keyword-confirm' && (
        <KeywordConfirmModal
          keywords={suggestedKeywords}
          loading={keywordsLoading}
          maxAgeDays={selectedMaxAge}
          onChangeMaxAge={setSelectedMaxAge}
          onConfirm={() => handleConfirmKeywords(suggestedKeywords)}
          onReject={async () => {
            setKeywordsLoading(true);
            setSuggestedKeywords([]);
            try {
              const res = await fetch(`${API_URL}/api/maverick/keywords`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan: rawPlan }),
              });
              const data = await res.json();
              const kws = Array.isArray(data.keywords) && data.keywords.length > 0
                ? data.keywords
                : ['', '', ''];
              setSuggestedKeywords(kws);
            } catch {
              setSuggestedKeywords(['', '', '']);
            } finally {
              setKeywordsLoading(false);
            }
          }}
          onEdit={(index, value) => {
            setSuggestedKeywords(prev => prev.map((kw, i) => i === index ? value : kw));
          }}
        />
      )}

      {/* ── Header ── */}
      <header className="flex items-center gap-3 px-6 h-14 border-b border-white/[0.06] flex-shrink-0">
        <button
          onClick={() => {
            if (phase === 'home') {
              onClose();
            } else {
              abortRef.current = true;
              setPhase('home');
            }
          }}
          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          title={phase === 'home' ? 'Fechar' : 'Voltar'}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-lg">🦅</span>
        <div>
          <span className="text-sm font-semibold text-white">Squad Maverick</span>
          {report && phase !== 'home' && (
            <span className="text-white/40 text-sm"> — @{report.profile.username}</span>
          )}
        </div>
        <div className="flex-1" />
        {phase === 'report' && previousAnalysis && previousAnalysis.strategy?.profile_score && (
          <button
            onClick={() => setShowComparison(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${showComparison
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
              : 'bg-white/[0.05] text-white/40 border border-white/10 hover:text-white/70'
              }`}
          >
            <History className="w-3.5 h-3.5" />
            Antes/Depois
          </button>
        )}
        {(phase === 'report' || phase === 'running-scripts' || phase === 'done') && (
          <span className="text-[11px] text-white/30 uppercase tracking-wider font-medium ml-2">
            {phase === 'report' ? 'Relatório' : phase === 'running-scripts' ? 'Gerando roteiros...' : 'Roteiros prontos'}
          </span>
        )}
      </header>

      {/* ── Conteúdo scrollável ── */}
      <div className="flex-1 overflow-y-auto scrollbar-hidden px-6 py-6">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* ═══════════════════════════════════════════════════════
              FASE: HOME — lista de análises passadas
          ════════════════════════════════════════════════════════ */}
          {phase === 'home' && (
            <div className="animate-in fade-in duration-300">
              {/* Topo: branding + botão nova análise */}
              <div className="flex items-start justify-between mb-10">
                <div>
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl shadow-inner">🦅</div>
                    <h2 className="text-3xl font-black text-white tracking-tight">Squad <span className="text-emerald-400">Maverick</span></h2>
                  </div>
                  <p className="text-white/40 text-sm leading-relaxed max-w-sm font-medium">
                    Estratégia e Inteligência para crescer com autoridade no Instagram.
                  </p>
                </div>
                <button
                  onClick={() => setPhase('asking')}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 rounded-2xl text-black text-sm font-black transition-all active:scale-[0.97] flex-shrink-0 shadow-[0_12px_40px_rgba(16,185,129,0.3)]"
                >
                  <TrendingUp className="w-4 h-4" />
                  Nova Análise
                </button>
              </div>

              {/* Lista de análises */}
              {historyItems.length === 0 ? (
                <div className="flex flex-col items-center gap-6 py-24 rounded-[32px] border border-white/10 bg-white/5 backdrop-blur-xl shadow-lg">
                  <div className="w-20 h-20 rounded-[20px] bg-white/5 border border-white/10 flex items-center justify-center text-4xl shadow-inner">
                    🦅
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-white/70 text-base font-bold tracking-tight">Nenhuma análise realizada ainda</p>
                    <p className="text-white/30 text-sm">Comece sua primeira análise de perfil</p>
                  </div>
                  <button
                    onClick={() => setPhase('asking')}
                    className="px-8 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-2xl text-emerald-400 text-sm font-black transition-all shadow-[0_8px_30px_rgba(16,185,129,0.1)]"
                  >
                    Começar primeira análise
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">
                      {historyItems.length} {historyItems.length === 1 ? 'análise' : 'análises'}
                    </p>
                    <button
                      onClick={handleClearHistory}
                      disabled={clearingHistory}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3 h-3" />
                      {clearingHistory ? 'Limpando...' : 'Limpar histórico'}
                    </button>
                  </div>
                  {historyItems.map((item) => {
                    const score = item.strategy?.profile_score?.overall;
                    const scoreColor = score == null ? '' : score >= 75 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-rose-400';
                    const scoreBg = score == null ? '' : score >= 75 ? 'bg-emerald-500/10 border-emerald-500/20' : score >= 50 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-rose-500/10 border-rose-500/20';
                    const date = new Date(item.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
                    const canLoad = !!(item.profile && item.analysis && item.strategy);
                    return (
                      <button
                        key={item.id}
                        onClick={() => canLoad && handleLoadHistoryEntry(item)}
                        disabled={!canLoad}
                        className={`w-full flex items-center gap-5 px-6 py-5 rounded-[24px] border border-white/10 bg-white/5 backdrop-blur-xl text-left transition-all shadow-lg ${
                          canLoad
                            ? 'hover:bg-white/10 hover:border-white/20 hover:shadow-[0_8px_30px_rgba(16,185,129,0.05)] cursor-pointer group'
                            : 'opacity-40 cursor-default'
                        }`}
                      >
                        <div className="w-12 h-12 rounded-[14px] bg-white/5 border border-white/10 flex items-center justify-center text-2xl flex-shrink-0 shadow-inner">
                          🦅
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-white tracking-tight">@{item.username}</p>
                          {item.strategy?.diagnosis && (
                            <p className="text-xs text-white/35 mt-1 truncate font-medium leading-relaxed">{item.strategy.diagnosis}</p>
                          )}
                          <p className="text-[10px] text-white/20 mt-1.5 uppercase tracking-widest font-bold">{date}</p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {item.scripts && item.scripts.length > 0 && (
                            <span className="text-[10px] px-3 py-1 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-black uppercase tracking-wider">
                              {item.scripts.length} roteiros
                            </span>
                          )}
                          {score != null && (
                            <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-[14px] border text-base font-black ${scoreColor} ${scoreBg}`}>
                              <span>{score}</span>
                              <span className="text-[8px] opacity-50 font-bold uppercase tracking-wider">score</span>
                            </div>
                          )}
                          <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-emerald-400/70 transition-colors" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Footer home */}
              <div className="mt-8 flex items-center justify-between">
                <p className="text-[10px] text-white/15 uppercase tracking-widest">Powered by AIOS Core & OpenRouter</p>
                <button
                  onClick={onClose}
                  className="text-xs text-white/25 hover:text-white/50 transition-colors"
                >
                  Sair do Maverick
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              FASE: KEYWORD-INPUT — geração direta por palavras-chave
          ════════════════════════════════════════════════════════ */}
          {phase === 'keyword-input' && (
            <div className="flex flex-col items-center justify-center pt-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="bg-white/5 backdrop-blur-2xl border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.07)] rounded-[32px] p-10 w-full max-w-[580px] flex flex-col gap-8 relative overflow-hidden">
                <div className="absolute -top-24 -right-24 w-56 h-56 bg-emerald-500/10 blur-[100px] pointer-events-none" />
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-2xl">🦅</div>
                  <div>
                    <h3 className="text-xl font-black text-white tracking-tight">Gerar Roteiros</h3>
                    <p className="text-white/40 text-xs font-medium mt-0.5">Digite os temas e deixa o Maverick trabalhar</p>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <label className="text-xs text-white/40 uppercase tracking-widest font-bold">Palavras-chave / Tema</label>
                  <input
                    type="text"
                    value={directKeywordInput}
                    onChange={e => setDirectKeywordInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && directKeywordInput.trim()) handleGenerateFromKeywords(); }}
                    placeholder="ex: IA para negócios, automação, produtividade"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-white/20 text-sm font-medium focus:outline-none focus:border-emerald-500/50 focus:bg-white/8 transition-all"
                    autoFocus
                  />
                  <p className="text-white/20 text-xs">Separe por vírgula. O Maverick vai gerar 3-4 roteiros baseados nesses temas.</p>
                </div>
                <button
                  onClick={handleGenerateFromKeywords}
                  disabled={!directKeywordInput.trim()}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-2xl text-black text-sm font-black transition-all active:scale-[0.98] shadow-[0_12px_40px_rgba(16,185,129,0.3)]"
                >
                  <Film className="w-4 h-4" />
                  Gerar Roteiros
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              FASE: ASKING — formulário de input
          ════════════════════════════════════════════════════════ */}
          {phase === 'asking' && (
            <div className="flex flex-col items-center justify-center pt-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="bg-white/5 backdrop-blur-2xl border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.07)] rounded-[32px] p-10 w-full max-w-[580px] flex flex-col gap-8 relative overflow-hidden group">
                {/* Emerald background glow */}
                <div className="absolute -top-24 -right-24 w-56 h-56 bg-emerald-500/10 blur-[100px] pointer-events-none group-hover:bg-emerald-500/15 transition-colors duration-700" />
                <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-emerald-600/8 blur-[100px] pointer-events-none" />

                {/* Headline */}
                <div className="text-center space-y-3 relative z-10">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-white/10 to-white/[0.02] border border-white/10 flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">
                    🦅
                  </div>
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">Nova Análise</h2>
                  <p className="text-white/50 text-sm max-w-[340px] mx-auto leading-relaxed">
                    Diagnóstico estratégico + roteiros prontos para publicar.
                  </p>
                </div>

                {/* Fluxo visual */}
                <div className="flex items-center justify-center gap-3 text-[10px] text-white/30 uppercase tracking-[0.15em] font-bold relative z-10">
                  {['Scout', 'Scholar', 'Strategist', 'Copywriter'].map((step, i, arr) => (
                    <span key={step} className="flex items-center gap-2">
                      <span className="hover:text-white/60 transition-colors">{step}</span>
                      {i < arr.length - 1 && <ChevronRight className="w-3 h-3 opacity-30" />}
                    </span>
                  ))}
                </div>

                {/* Input Area */}
                <div className="space-y-6 relative z-10">
                  <div className="group/input relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-white/40 text-xl font-semibold transition-colors group-focus-within/input:text-emerald-400">@</span>
                    <input
                      ref={inputRef}
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="username do perfil"
                      className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 rounded-[24px] pl-14 pr-6 py-6 text-white placeholder:text-white/20 text-lg focus:outline-none focus:border-white/20 focus:bg-white/[0.08] transition-all duration-300 shadow-inner focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <button
                    onClick={handleGoToIcpForm}
                    disabled={!username.trim()}
                    className="w-fit mx-auto px-10 py-4 bg-emerald-500 text-black hover:bg-emerald-400 rounded-[24px] text-sm font-black flex items-center justify-center gap-2.5 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-[0_12px_40px_rgba(16,185,129,0.3)]"
                  >
                    <TrendingUp className="w-4 h-4" />
                    Continuar
                  </button>
                </div>
              </div>

              <div className="mt-8 text-center text-[11px] text-white/20 uppercase tracking-widest font-medium">
                Powered by AIOS Core & OpenRouter
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              FASE: ICP-FORM — coleta do perfil de cliente ideal
          ════════════════════════════════════════════════════════ */}
          {phase === 'icp-form' && (
            <div className="flex flex-col items-center justify-center pt-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="bg-white/5 backdrop-blur-2xl border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.07)] rounded-[32px] p-10 w-full max-w-[580px] flex flex-col gap-7 relative overflow-hidden">
                <div className="absolute -top-20 -right-20 w-48 h-48 bg-emerald-500/8 blur-[80px] pointer-events-none" />
                <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-amber-500/8 blur-[80px] pointer-events-none" />

                <div className="text-center space-y-2">
                  <div className="text-2xl mb-2">🎯</div>
                  <h2 className="text-2xl font-extrabold text-white tracking-tight">Contexto do Negócio</h2>
                  <p className="text-white/50 text-sm leading-relaxed">
                    Se souber, preencha — a análise fica mais precisa. Se não souber ainda, pode pular:
                    o Maverick vai inferir o posicionamento a partir do perfil.
                  </p>
                  <p className="text-white/25 text-xs">Perfil: <span className="text-white/50 font-semibold">@{username.replace(/^@/, '')}</span></p>
                </div>

                <div className="space-y-4">
                  {[
                    { key: 'product' as const, label: 'Produto / Serviço', placeholder: 'Ex: mentoria de copywriting, curso de emagrecimento, consultoria financeira', icon: '📦' },
                    { key: 'price_range' as const, label: 'Faixa de preço', placeholder: 'Ex: R$97–R$497, R$5.000 a R$15.000', icon: '💰' },
                    { key: 'main_objection' as const, label: 'Principal objeção do cliente', placeholder: 'Ex: "não tenho tempo", "é muito caro", "já tentei antes"', icon: '🚧' },
                    { key: 'ideal_customer' as const, label: 'Cliente ideal', placeholder: 'Ex: mulheres 30-45 anos, mães, que querem emagrecer sem academia', icon: '👤' },
                    { key: 'transformation' as const, label: 'Transformação entregue', placeholder: 'Ex: de sedentária a ativa em 60 dias sem dieta de fome', icon: '✨' },
                  ].map(({ key, label, placeholder, icon }) => (
                    <div key={key} className="flex flex-col gap-1.5">
                      <label className="text-xs text-white/40 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                        <span>{icon}</span>{label}
                      </label>
                      <input
                        type="text"
                        value={icp[key]}
                        onChange={(e) => setIcp(prev => ({ ...prev, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full bg-white/[0.05] border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/40 focus:bg-white/[0.08] focus:ring-2 focus:ring-emerald-500/10 transition-all"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-3 pt-1">
                  <button
                    onClick={() => handleAnalyze(icp)}
                    className="w-full py-4 bg-emerald-500 text-black rounded-2xl text-sm font-black hover:bg-emerald-400 transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-[0_12px_40px_rgba(16,185,129,0.3)]"
                  >
                    <TrendingUp className="w-4 h-4" />
                    Analisar com este contexto
                  </button>
                  <button
                    onClick={() => handleAnalyze()}
                    className="w-full py-3 rounded-2xl border border-white/[0.08] text-white/35 text-sm font-medium hover:text-white/60 hover:border-white/20 hover:bg-white/[0.03] transition-all"
                  >
                    Pular — o Maverick vai inferir o posicionamento
                  </button>
                  <button
                    onClick={() => setPhase('asking')}
                    className="text-xs text-white/20 hover:text-white/40 transition-colors text-center pt-1"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              FASE: RUNNING-PLAN — loading com logs (AGORA COM NOVO DESIGN)
          ════════════════════════════════════════════════════════ */}
          {phase === 'running-plan' && (
            <MaverickLoading username={username} steps={steps} />
          )}

          {/* ═══════════════════════════════════════════════════════
              FASE: REPORT — dashboard de cards
          ════════════════════════════════════════════════════════ */}
          {phase === 'report' && (
            <>
              {/* Logs collapsados */}
              <StepLog steps={steps} />

              {report ? (
                <>
                  {/* ── Bento Row 1: Perfil + Executive Summary ── */}
                  <div className="grid grid-cols-5 gap-4">
                    {/* Profile Card (3/5) */}
                    <div className="col-span-3 rounded-[28px] bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg p-8 flex flex-col justify-between gap-6">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                            <TrendingUp className="w-3 h-3 text-emerald-400" />
                          </div>
                          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Auditoria Ativa</span>
                        </div>
                        <h2 className="text-3xl font-black text-white tracking-tight mb-1">@{report.profile.username}</h2>
                        {report.profile.bio && (
                          <p className="text-sm text-white/40 leading-relaxed">{report.profile.bio}</p>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <p className="text-[9px] text-white/30 uppercase tracking-widest font-black mb-1">Seguidores</p>
                          <p className="text-2xl font-black text-white">{report.profile.followers}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-white/30 uppercase tracking-widest font-black mb-1">Publicações</p>
                          <p className="text-2xl font-black text-white">{report.profile.posts_count}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-white/30 uppercase tracking-widest font-black mb-1">Seguindo</p>
                          <p className="text-2xl font-black text-white">{report.profile.following}</p>
                        </div>
                        {report.strategy.engagement_panorama && (
                          <div>
                            <p className="text-[9px] text-white/30 uppercase tracking-widest font-black mb-1">Health Score</p>
                            <p className="text-2xl font-black text-emerald-400">{report.strategy.engagement_panorama.profile_rate}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Executive Summary (2/5) */}
                    <div className="col-span-2 rounded-[28px] bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg p-7 flex flex-col gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-[12px] bg-white/5 border border-white/10 flex items-center justify-center">
                          <Zap className="w-4 h-4 text-white" strokeWidth={1.5} />
                        </div>
                        <div>
                          <h3 className="text-[15px] font-semibold tracking-tight text-white">Executive Summary</h3>
                        </div>
                      </div>
                      <p className="text-sm text-white/60 leading-relaxed flex-1">{report.strategy.diagnosis}</p>
                      {report.strategy.key_concept && (
                        <div className="rounded-xl px-4 py-3 bg-emerald-500/5 border border-emerald-500/20">
                          <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1">Conceito Chave</p>
                          <p className="text-sm text-white/70 font-medium">{report.strategy.key_concept}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Monetization Ladder (Engagement Panorama) ── */}
                  {report.strategy.engagement_panorama && (() => {
                    const levels = ['Atenção', 'Confiança', 'Autoridade', 'Escala', 'Impacto'];
                    const cls = report.strategy.engagement_panorama.classification;
                    const currentLevel = cls === 'Ruim' || cls === 'Abaixo da Media' ? 0 : cls === 'Bom' ? 1 : cls === 'Muito Bom' ? 2 : cls === 'Otimo' ? 3 : 0;
                    const ep = report.strategy.engagement_panorama;
                    return (
                      <div className="rounded-[28px] bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg p-8">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-9 h-9 rounded-[12px] bg-white/5 border border-white/10 flex items-center justify-center">
                            <BarChart2 className="w-4 h-4 text-white" strokeWidth={1.5} />
                          </div>
                          <div>
                            <h3 className="text-[15px] font-semibold tracking-tight text-white">Escada de Monetização</h3>
                            <p className="text-[12px] text-zinc-400 font-medium">Caminho projetado para escala comercial no perfil</p>
                          </div>
                        </div>
                        {/* Steps */}
                        <div className="flex items-center gap-0 mb-6">
                          {levels.map((level, i) => {
                            const isActive = i === currentLevel;
                            const isPast = i < currentLevel;
                            return (
                              <div key={level} className="flex items-center flex-1">
                                <div className="flex flex-col items-center">
                                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${isActive ? 'border-emerald-500 bg-emerald-500/20 shadow-[0_0_16px_rgba(16,185,129,0.4)]' : isPast ? 'border-white/30 bg-white/10' : 'border-white/10 bg-white/3'}`}>
                                    {isActive && <div className="w-3 h-3 rounded-full bg-emerald-400" />}
                                  </div>
                                  <span className={`text-[10px] font-semibold mt-2 ${isActive ? 'text-white' : 'text-white/30'}`}>{level}</span>
                                </div>
                                {i < levels.length - 1 && (
                                  <div className={`h-px flex-1 mx-2 ${isPast ? 'bg-white/30' : 'bg-white/10'}`} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {/* Current level detail */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-5">
                            <p className="text-[10px] text-amber-400 uppercase tracking-widest font-black mb-2">Nível Atual</p>
                            <p className="text-2xl font-black text-white mb-1">{levels[currentLevel]}</p>
                            <p className="text-xs text-white/35 italic">"{ep.tier_benchmark}"</p>
                          </div>
                          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-5 relative overflow-hidden">
                            <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-black mb-2">Próximo Salto</p>
                            <p className="text-sm text-white/70 leading-relaxed">{ep.verdict || ep.market_position}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── Top Posts + Critical Patterns (2 col) ── */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Top Posts */}
                    <div className="rounded-[28px] bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg p-7 flex flex-col gap-4">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="w-9 h-9 rounded-[12px] bg-white/5 border border-white/10 flex items-center justify-center">
                          <Star className="w-4 h-4 text-white" strokeWidth={1.5} />
                        </div>
                        <div>
                          <h3 className="text-[15px] font-semibold tracking-tight text-white">Top Posts por Engajamento</h3>
                          <p className="text-[12px] text-zinc-400">Métricas baseadas nos dados extraídos</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {report.analysis.best_posts.slice(0, 3).map((post, i) => (
                          <div key={i} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center">
                                <span className="text-[10px] font-black text-white/60">#{i + 1}</span>
                              </div>
                              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Post</span>
                            </div>
                            <p className="text-xs text-white/70 leading-relaxed mb-2 italic">"{post.caption_preview}"</p>
                            <div className="rounded-lg bg-white/[0.05] border border-white/[0.06] px-3 py-2">
                              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1 font-bold">Por que funcionou</p>
                              <p className="text-xs text-white/55 leading-relaxed">{post.reason}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Critical Patterns */}
                    <div className="rounded-[28px] bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg p-7 flex flex-col gap-5">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="w-9 h-9 rounded-[12px] bg-white/5 border border-white/10 flex items-center justify-center">
                          <Search className="w-4 h-4 text-white" strokeWidth={1.5} />
                        </div>
                        <h3 className="text-[15px] font-semibold tracking-tight text-white">Padrões Críticos</h3>
                      </div>
                      {/* Gap de mercado */}
                      {report.analysis.profile_gaps[0] && (
                        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 px-4 py-3">
                          <p className="text-[10px] text-rose-400 uppercase tracking-widest font-black mb-1.5">Gap de Mercado Identificado</p>
                          <p className="text-sm text-white/70 leading-relaxed">{report.analysis.profile_gaps[0]}</p>
                        </div>
                      )}
                      {/* Formatos dominantes / pontos positivos */}
                      {report.analysis.positive_points.length > 0 && (
                        <div>
                          <p className="text-[10px] text-white/30 uppercase tracking-wider font-black mb-2">Formatos Dominantes</p>
                          <p className="text-sm text-white/55 leading-relaxed">{report.analysis.positive_points.slice(0, 2).join('. ')}</p>
                        </div>
                      )}
                      {/* Tom de voz */}
                      {report.strategy.citation && (
                        <div>
                          <p className="text-[10px] text-white/30 uppercase tracking-wider font-black mb-2">Tom de Voz</p>
                          <p className="text-xs text-white/50 leading-relaxed italic">{report.strategy.citation}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Posicionamento & ICP ── */}
                  {report.strategy.suggested_icp && (
                    <div className="rounded-[28px] bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg p-8">
                      <div className="grid grid-cols-2 gap-8">
                        {/* Left: Posicionamento */}
                        <div className="flex flex-col gap-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-[12px] bg-white/5 border border-white/10 flex items-center justify-center">
                              <Target className="w-4 h-4 text-white" strokeWidth={1.5} />
                            </div>
                            <div>
                              <h3 className="text-[15px] font-semibold text-white">Posicionamento & Tilt</h3>
                              <p className="text-[12px] text-zinc-400">O diferencial estratégico</p>
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] text-white/30 uppercase tracking-wider font-black mb-2">Posicionamento Ideal</p>
                            <p className="text-base font-bold text-white leading-relaxed">{report.strategy.suggested_icp.recommended_positioning}</p>
                          </div>
                          {report.strategy.suggested_icp.inferred_product && (
                            <div className="rounded-2xl bg-white/[0.03] border border-emerald-500/20 px-4 py-3">
                              <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-black mb-1.5">Content Tilt (Diferencial)</p>
                              <p className="text-sm font-bold text-white/80 leading-relaxed">{report.strategy.suggested_icp.inferred_product}</p>
                            </div>
                          )}
                          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
                            <p className="text-[10px] text-white/30 uppercase tracking-wider font-black mb-1.5">Público Inferido</p>
                            <p className="text-sm text-white/60 leading-relaxed">{report.strategy.suggested_icp.inferred_audience}</p>
                          </div>
                        </div>
                        {/* Right: Next steps as "pilares editoriais" */}
                        <div className="flex flex-col gap-4">
                          <p className="text-[10px] text-white/30 uppercase tracking-wider font-black">Próximos Passos</p>
                          <div className="space-y-2">
                            {report.strategy.suggested_icp.icp_next_steps?.slice(0, 5).map((step, i) => (
                              <div key={i} className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
                                <div>
                                  <p className="text-sm text-white/80 font-semibold">{step}</p>
                                </div>
                                <span className="text-[11px] font-black text-blue-400 ml-3 flex-shrink-0">#{i + 1}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Roteiros Ideias (next_steps como calendário editorial) ── */}
                  {report.strategy.next_steps.length > 0 && (
                    <div className="rounded-[28px] bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg p-8">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-9 h-9 rounded-[12px] bg-white/5 border border-white/10 flex items-center justify-center">
                          <BarChart2 className="w-4 h-4 text-white" strokeWidth={1.5} />
                        </div>
                        <div>
                          <h3 className="text-[15px] font-semibold text-white">Ideias de Roteiros</h3>
                          <p className="text-[12px] text-zinc-400">Pautas estratégicas sugeridas pelo @maverick</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {report.strategy.next_steps.map((step, i) => {
                          const formats = ['Reel 30s', 'Carousel', 'Reel 60s', 'Stories', 'Reel 30s', 'Carousel'];
                          const fmt = formats[i % formats.length];
                          const fmtColor = fmt.startsWith('Reel') ? 'text-blue-400' : fmt === 'Carousel' ? 'text-cyan-400' : 'text-purple-400';
                          return (
                            <div key={i} className="rounded-2xl bg-white/[0.03] border border-white/[0.08] px-4 py-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] text-white/30 font-semibold uppercase tracking-wider">Pauta {i + 1}</span>
                                <span className={`text-[10px] font-black ${fmtColor}`}>{fmt}</span>
                              </div>
                              <p className="text-sm text-white/70 leading-relaxed">{step}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Urgent Corrections + Validated Actions (2 col) ── */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Auditoria: Correções Urgentes */}
                    <div className="rounded-[28px] bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg p-7 flex flex-col gap-4">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="w-9 h-9 rounded-[12px] bg-white/5 border border-white/10 flex items-center justify-center">
                          <AlertTriangle className="w-4 h-4 text-white" strokeWidth={1.5} />
                        </div>
                        <div>
                          <h3 className="text-[15px] font-semibold text-white">Auditoria: Correções Urgentes</h3>
                          <p className="text-[12px] text-zinc-400">O que está afundando a performance</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {report.analysis.profile_gaps.map((gap, i) => (
                          <div key={i} className="rounded-2xl bg-white/[0.02] border border-white/[0.08] p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-6 h-6 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center">
                                <span className="text-[10px] font-black text-rose-400">{i + 1}</span>
                              </div>
                              <p className="text-sm font-bold text-white/80">{gap.split(':')[0]?.trim() || gap.slice(0, 60)}</p>
                            </div>
                            {gap.includes(':') && (
                              <p className="text-xs text-white/45 leading-relaxed">{gap.split(':').slice(1).join(':').trim()}</p>
                            )}
                          </div>
                        ))}
                        {report.analysis.worst_posts.slice(0, 1).map((post, i) => (
                          <div key={`wp-${i}`} className="rounded-xl bg-rose-500/5 border border-rose-500/20 px-4 py-3">
                            <p className="text-[10px] text-rose-400 uppercase tracking-widest font-black mb-1">Ação Corretiva</p>
                            <p className="text-xs text-white/50 leading-relaxed">{post.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Ações Validadas */}
                    <div className="rounded-[28px] bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg p-7 flex flex-col gap-4">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="w-9 h-9 rounded-[12px] bg-white/5 border border-white/10 flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-white" strokeWidth={1.5} />
                        </div>
                        <div>
                          <h3 className="text-[15px] font-semibold text-white">Ações Validadas</h3>
                          <p className="text-[12px] text-zinc-400">O que continuar fazendo</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {report.analysis.positive_points.map((point, i) => (
                          <div key={i} className="rounded-2xl bg-emerald-500/5 border border-emerald-500/15 p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                              <p className="text-sm font-bold text-white/80">{point.split(':')[0]?.trim() || point.slice(0, 60)}</p>
                            </div>
                            {point.includes(':') && (
                              <p className="text-xs text-white/45 leading-relaxed">{point.split(':').slice(1).join(':').trim()}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Score do Perfil */}
                  {report.strategy.profile_score && (
                    <ProfileScoreCard score={report.strategy.profile_score} />
                  )}

                  {/* Painel Antes/Depois */}
                  {showComparison && previousAnalysis && (
                    <ComparisonPanel
                      current={report}
                      previous={previousAnalysis}
                      previousDate={previousAnalysis.createdAt}
                    />
                  )}

                  {/* ── Roteiros salvos (carregados do histórico) ── */}
                  {parsedScripts && parsedScripts.length > 0 && (
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-emerald-400" />
                          <span className="text-emerald-300 text-sm font-medium">
                            {parsedScripts.length} roteiros gerados
                          </span>
                        </div>
                        <button
                          onClick={handleApprove}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/10 border border-white/10 rounded-lg text-white/45 hover:text-white/70 text-xs font-medium transition-all"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Gerar novamente
                        </button>
                      </div>
                      {trendResearch && <TrendReferencesPanel data={trendResearch} />}
                      <div className="grid grid-cols-2 gap-4">
                        {parsedScripts.map((script, i) => (
                          <ScriptPreviewCard
                            key={i}
                            script={script}
                            index={i}
                            onClick={() => setSelectedScript({ script, index: i })}
                          />
                        ))}
                      </div>
                      {selectedScript && (
                        <ScriptModal
                          script={selectedScript.script}
                          index={selectedScript.index}
                          onClose={() => setSelectedScript(null)}
                        />
                      )}

                      {/* ── Seção de Carrossel (phase report) ── */}
                      {(carouselState.loading || carouselState.carousel) && (
                        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 space-y-6 mt-4 shadow-lg">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <span className="text-xl">🎨</span>
                              <h3 className="text-white font-black text-base tracking-tight uppercase tracking-[0.05em]">Estrutura do Carrossel</h3>
                              {carouselState.loading && <Loader2 className="w-5 h-5 text-emerald-400 animate-spin ml-2" />}
                            </div>
                            {/* Theme toggle */}
                            <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5">
                              {(['dark', 'light'] as const).map(t => (
                                <button
                                  key={t}
                                  onClick={() => {
                                    setCarouselTheme(t);
                                    if (parsedScripts?.[0]) generateCarousel(parsedScripts[0], t);
                                  }}
                                  className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                                    carouselTheme === t
                                      ? 'bg-emerald-500 text-black shadow-lg'
                                      : 'bg-white/5 text-white/30 hover:text-white/60 border border-white/10'
                                  }`}
                                >
                                  {t === 'dark' ? '🌑 Dark' : '☀️ Light'}
                                </button>
                              ))}
                            </div>
                          </div>
                          {carouselState.loading && (
                            <p className="text-white/40 text-sm">Gerando estrutura do carrossel...</p>
                          )}
                          {carouselState.carousel && (
                            <>
                              <div className="flex gap-3 overflow-x-auto pb-2">
                                {carouselState.carousel.slides.map(slide => (
                                  <div
                                    key={slide.position}
                                    className="min-w-[200px] max-w-[220px] flex-shrink-0 rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] text-white/30 font-mono">
                                        {slide.position}/{carouselState.carousel!.total_slides}
                                      </span>
                                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                        slide.type === 'cover' ? 'bg-rose-500/20 text-rose-300' :
                                        slide.type === 'cta' ? 'bg-amber-500/20 text-amber-300' :
                                        'bg-blue-500/20 text-blue-300'
                                      }`}>{slide.type}</span>
                                    </div>
                                    <h4 className="text-white/85 text-xs font-bold leading-tight line-clamp-2">{slide.title}</h4>
                                    <p className="text-white/50 text-xs leading-relaxed line-clamp-3">{slide.body}</p>
                                    <p className="text-emerald-400/70 text-[11px] leading-tight font-bold">🎨 {slide.visual_hint}</p>
                                  </div>
                                ))}
                              </div>
                              <div className="flex gap-2 pt-1">
                                {carouselState.htmlExport && (
                                  <button
                                    onClick={() => downloadHtml(carouselState.htmlExport!)}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400 text-[10px] font-black uppercase tracking-widest transition-all"
                                  >
                                    ⬇️ HTML
                                  </button>
                                )}
                                {carouselState.carousel && (
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(JSON.stringify(carouselState.carousel, null, 2));
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/10 border border-white/10 rounded-lg text-white/50 hover:text-white/80 text-xs font-medium transition-all"
                                    title="Copie e cole no plugin Figma"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                    JSON Figma
                                  </button>
                                )}
                                {carouselState.figmaUrl && (
                                  <a
                                    href={carouselState.figmaUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/10 border border-white/10 rounded-lg text-white/50 hover:text-white/80 text-xs font-medium transition-all"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    Abrir no Figma
                                  </a>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                /* Fallback: resposta não-JSON do LLM */
                <div className="rounded-2xl p-6 border border-white/10 bg-white/[0.03]">
                  <p className="text-white/60 text-sm leading-relaxed whitespace-pre-wrap">{rawPlan}</p>
                </div>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════
              FASE: RUNNING-SCRIPTS — loading elegante
          ════════════════════════════════════════════════════════ */}
          {phase === 'running-scripts' && (
            <div className="flex flex-col items-center gap-8 pt-12">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-2 border-white/10 flex items-center justify-center text-4xl">
                  ✍️
                </div>
                <Loader2 className="absolute -right-1 -bottom-1 w-6 h-6 text-purple-400/60 animate-spin" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-white font-semibold">Gerando roteiros em paralelo</h3>
                <p className="text-white/40 text-sm">DeepSeek está escrevendo todos os roteiros ao mesmo tempo...</p>
              </div>
              <StepLog steps={steps} />
              {/* Skeleton cards */}
              <div className="w-full grid grid-cols-2 gap-4">
                {[0, 1, 2, 4].map(i => (
                  <div key={i} className="rounded-2xl border border-white/[0.06] overflow-hidden animate-pulse">
                    <div className="px-5 py-4 border-b border-white/[0.04] flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/[0.05]" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-white/[0.06] rounded w-3/4" />
                        <div className="h-2 bg-white/[0.04] rounded w-1/3" />
                      </div>
                    </div>
                    <div className="px-5 py-4 space-y-3">
                      <div className="h-12 bg-white/[0.04] rounded-xl" />
                      <div className="h-24 bg-white/[0.03] rounded-xl" />
                      <div className="h-8 bg-white/[0.04] rounded-xl" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              FASE: DONE — resumo do relatório + roteiros
          ════════════════════════════════════════════════════════ */}
          {phase === 'done' && (
            <div className="space-y-6">
              {/* Compact report summary */}
              {report && (
                <div className="rounded-2xl p-6 border border-white/10 bg-white/5 backdrop-blur-xl shadow-lg">
                  <div className="flex items-center gap-5 mb-5">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-black text-white tracking-tight">@{report.profile.username}</h3>
                      <p className="text-[10px] text-white/30 mt-1 uppercase tracking-widest font-bold">
                        {report.profile.followers} seguidores · {report.profile.posts_count} posts
                      </p>
                    </div>
                    {report.strategy.profile_score && (() => {
                      const s = report.strategy.profile_score.overall;
                      const c = s >= 75 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : s >= 50 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20';
                      return (
                        <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-2xl border flex-shrink-0 ${c}`}>
                          <span className="text-2xl font-black tracking-tighter">{s}</span>
                          <span className="text-[9px] text-white/20 uppercase tracking-[0.2em] font-black">score</span>
                        </div>
                      );
                    })()}
                  </div>
                  {report.strategy.diagnosis && (
                    <p className="text-sm text-white/50 leading-relaxed line-clamp-2 italic font-medium mb-5">{report.strategy.diagnosis}</p>
                  )}
                  {report.strategy.engagement_panorama && (
                    <div className="mt-4 flex items-center gap-4 pt-5 border-t border-white/5">
                      <span className="text-[10px] text-white/20 uppercase tracking-widest font-black">Engajamento</span>
                      <span className="text-base font-black text-white tracking-tighter">{report.strategy.engagement_panorama.profile_rate}</span>
                      <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${report.strategy.engagement_panorama.classification === 'Otimo' ? 'bg-violet-500/20 text-violet-300' :
                        report.strategy.engagement_panorama.classification === 'Muito Bom' ? 'bg-emerald-500/20 text-emerald-300' :
                          report.strategy.engagement_panorama.classification === 'Bom' ? 'bg-cyan-500/20 text-cyan-300' :
                            report.strategy.engagement_panorama.classification === 'Abaixo da Media' ? 'bg-amber-500/20 text-amber-300' :
                              'bg-rose-500/20 text-rose-300'
                        }`}>{report.strategy.engagement_panorama.classification}</span>
                      <span className="text-[10px] text-white/20 ml-auto font-black uppercase tracking-[0.1em]">{report.strategy.engagement_panorama.tier}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Trend references */}
              {trendResearch && <TrendReferencesPanel data={trendResearch} />}

              {/* Scripts header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <span className="text-emerald-300 text-sm font-medium">
                    {parsedScripts ? `${parsedScripts.length} roteiros prontos!` : 'Roteiros gerados!'}
                  </span>
                </div>
                <button
                  onClick={handleApprove}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/10 border border-white/10 rounded-lg text-white/45 hover:text-white/70 text-xs font-medium transition-all"
                  title="Buscar novos vídeos e regenerar roteiros"
                >
                  <RefreshCw className="w-3 h-3" />
                  Gerar novamente
                </button>
              </div>

              {parsedScripts && parsedScripts.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    {parsedScripts.map((script, i) => (
                      <ScriptPreviewCard
                        key={i}
                        script={script}
                        index={i}
                        onClick={() => setSelectedScript({ script, index: i })}
                      />
                    ))}
                  </div>
                  {selectedScript && (
                    <ScriptModal
                      script={selectedScript.script}
                      index={selectedScript.index}
                      onClose={() => setSelectedScript(null)}
                    />
                  )}
                </>
              ) : (
                /* Fallback: raw text if JSON parsing failed */
                <div className="rounded-2xl p-6 border border-white/10 bg-white/[0.03]">
                  <pre className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap font-sans">
                    {scripts || streamingScripts}
                  </pre>
                </div>
              )}

              {/* ── Seção de Carrossel ── */}
              {(carouselState.loading || carouselState.carousel) && (
                <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.04] p-6 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🎨</span>
                      <h3 className="text-purple-300 font-semibold text-sm">Estrutura do Carrossel</h3>
                      {carouselState.loading && <Loader2 className="w-4 h-4 text-purple-400/60 animate-spin ml-1" />}
                    </div>
                    {/* Theme toggle */}
                    <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5">
                      {(['dark', 'light'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => {
                            setCarouselTheme(t);
                            if (parsedScripts?.[0]) generateCarousel(parsedScripts[0], t);
                          }}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                            carouselTheme === t
                              ? 'bg-purple-500/30 text-purple-200'
                              : 'text-white/30 hover:text-white/60'
                          }`}
                        >
                          {t === 'dark' ? '🌑 Dark' : '☀️ Light'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {carouselState.loading && (
                    <p className="text-white/40 text-sm">Gerando estrutura do carrossel...</p>
                  )}
                  {carouselState.carousel && (
                    <>
                      <div className="flex gap-3 overflow-x-auto pb-2">
                        {carouselState.carousel.slides.map(slide => (
                          <div
                            key={slide.position}
                            className="min-w-[200px] max-w-[220px] flex-shrink-0 rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-white/30 font-mono">
                                {slide.position}/{carouselState.carousel!.total_slides}
                              </span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                slide.type === 'cover' ? 'bg-rose-500/20 text-rose-300' :
                                slide.type === 'cta' ? 'bg-amber-500/20 text-amber-300' :
                                'bg-blue-500/20 text-blue-300'
                              }`}>{slide.type}</span>
                            </div>
                            <h4 className="text-white/85 text-xs font-bold leading-tight line-clamp-2">{slide.title}</h4>
                            <p className="text-white/50 text-xs leading-relaxed line-clamp-3">{slide.body}</p>
                            <p className="text-purple-400/70 text-[11px] leading-tight">🎨 {slide.visual_hint}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 pt-1">
                        {carouselState.htmlExport && (
                          <button
                            onClick={() => downloadHtml(carouselState.htmlExport!)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg text-purple-300 text-xs font-medium transition-all"
                          >
                            ⬇️ Exportar HTML
                          </button>
                        )}
                        {carouselState.figmaUrl && (
                          <a
                            href={carouselState.figmaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/10 border border-white/10 rounded-lg text-white/50 hover:text-white/80 text-xs font-medium transition-all"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Abrir no Figma
                          </a>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              FASE: ERROR
          ════════════════════════════════════════════════════════ */}
          {phase === 'error' && (
            <div className="flex flex-col items-center gap-4 pt-8">
              <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-rose-400" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-rose-300 font-semibold">Erro durante a execução</h3>
                <p className="text-white/40 text-xs max-w-md font-mono leading-relaxed">{errorMsg}</p>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Footer sticky com CTAs ── */}
      {(phase === 'report' || phase === 'done' || phase === 'error') && (
        <div className="flex-shrink-0 border-t border-white/[0.06] px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            {phase === 'report' && (
              <>
                <button
                  onClick={handleToggleSpeech}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border transition-all flex-shrink-0 ${isSpeaking ? 'bg-purple-500/20 border-purple-500/30 text-purple-300' : 'bg-white/[0.05] border-white/10 text-white/50 hover:text-white/80 hover:bg-white/10'}`}
                  title={isSpeaking ? 'Parar' : 'Ouvir briefing'}
                >
                  {isSpeaking ? '⏹ Parar' : '🔊 Ouvir'}
                </button>
                <button
                  onClick={handleApprove}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl text-black text-sm font-black transition-all shadow-[0_12px_40px_rgba(16,185,129,0.3)] active:scale-[0.98]"
                >
                  ✍️ Gerar Roteiros com IA
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-3 text-white/40 hover:text-white/70 text-sm transition-colors"
                >
                  Cancelar
                </button>
              </>
            )}
            {(phase === 'done' || phase === 'error') && (
              <div className="flex items-center gap-3 w-full">
                <button
                  onClick={handleReset}
                  className="flex-1 px-4 py-3 bg-white/[0.05] hover:bg-white/10 border border-white/10 rounded-xl text-white/60 text-sm transition-all"
                >
                  Analisar outro perfil
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-3 text-white/30 hover:text-white/60 text-sm transition-colors"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
