'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Send, CheckCircle, XCircle, Loader2,
  Users, UserCheck, ImageIcon, TrendingUp, AlertTriangle,
  Star, ThumbsDown, Lightbulb, Quote, ChevronRight,
  BarChart2, History, ArrowUpRight, ArrowDownRight, Minus,
  Copy, Check, Zap, Film, LayoutGrid, MessageCircle,
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

interface ScriptData {
  title: string;
  format: string;
  format_type: string;
  format_name: string;
  funnel_stage?: string;
  funnel_goal?: string;
  conversion_angle?: string;
  why_format: string;
  framework: string;
  why_framework: string;
  hook: string;
  body: string;
  visual_cues: string[];
  filming_tip: string;
  cta: string;
}

interface ICPData {
  product: string;
  price_range: string;
  main_objection: string;
  ideal_customer: string;
  transformation: string;
}

interface EngagementPanorama {
  profile_rate: string;
  classification: string;
  tier: string;
  tier_benchmark: string;
  verdict: string;
  market_position: string;
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
}

type Phase = 'asking' | 'icp-form' | 'running-plan' | 'report' | 'running-scripts' | 'done' | 'error';

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
    <div className={`flex flex-col gap-3 rounded-2xl p-6 border ${color} bg-white/[0.03]`}>
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 opacity-60" />
        <span className="text-sm text-white/50 uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <span className="text-4xl font-bold text-white leading-none">{value}</span>
    </div>
  );
}

function ListCard({ icon: Icon, title, items, color, emptyMsg }: {
  icon: React.ElementType; title: string; items: string[];
  color: { border: string; accent: string; dot: string }; emptyMsg: string;
}) {
  return (
    <div className={`rounded-2xl p-6 border ${color.border} bg-white/[0.03] flex flex-col gap-5`}>
      <div className={`flex items-center gap-2.5 ${color.accent}`}>
        <Icon className="w-5 h-5" />
        <span className="text-base font-bold">{title}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-white/30 text-base italic">{emptyMsg}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-base text-white/78 leading-relaxed">
              <span className={`mt-2.5 w-2 h-2 rounded-full flex-shrink-0 ${color.dot}`} />
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
    <div className={`rounded-2xl p-6 border ${color.border} bg-white/[0.03] flex flex-col gap-5`}>
      <div className={`flex items-center gap-2.5 ${color.accent}`}>
        <Icon className="w-5 h-5" />
        <span className="text-base font-bold">{title}</span>
      </div>
      {posts.length === 0 ? (
        <p className="text-white/30 text-base italic">Sem dados suficientes</p>
      ) : (
        <div className="space-y-3">
          {posts.map((post, i) => (
            <div key={i} className={`rounded-xl p-4 border ${color.badge} bg-white/[0.02]`}>
              <p className="text-white/80 text-sm font-mono leading-relaxed mb-2 truncate">
                "{post.caption_preview}..."
              </p>
              <p className="text-white/65 text-base leading-relaxed">{post.reason}</p>
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
    <div className="rounded-2xl p-6 border border-white/[0.08] bg-white/[0.03]">
      <div className="flex items-center gap-2.5 mb-6">
        <BarChart2 className="w-5 h-5 text-white/40" />
        <span className="text-base font-bold text-white/70">Score do Perfil</span>
      </div>

      <div className="flex items-center gap-8 mb-2">
        {/* Nota geral em destaque */}
        <div className="flex flex-col items-center justify-center w-28 h-28 rounded-2xl border border-white/[0.08] bg-white/[0.04] flex-shrink-0">
          <span className={`text-5xl font-black ${color}`}>{overall}</span>
          <span className="text-xs text-white/30 uppercase tracking-widest mt-1">/ 100</span>
        </div>
        {/* Barras de dimensões */}
        <div className="flex-1 space-y-3">
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
  'Reels':     { icon: Film,       gradient: 'from-purple-600/15 to-violet-500/5',  badge: 'bg-purple-500/20 text-purple-300 border border-purple-500/30' },
  'Carrossel': { icon: LayoutGrid, gradient: 'from-cyan-600/15 to-blue-500/5',      badge: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' },
};

// Format-type emoji icons
const FORMAT_TYPE_EMOJI: Record<string, string> = {
  reels_react:           '😲',
  reels_caixinha:        '❓',
  reels_terceira_pessoa: '🎥',
  reels_primeira_pessoa: '🤳',
  reels_talking_head:    '🎙️',
  reels_tutorial:        '📋',
  reels_broll_texto:     '✨',
  reels_trend_meme:      '🔥',
  carrossel_educativo:   '📚',
  carrossel_narrativo:   '📖',
  carrossel_antes_depois:'⚡',
  carrossel_opinion:     '💬',
};

// ── Script Preview Card (compact, grid-friendly) ─────────────────────────────

function ScriptPreviewCard({ script, index, onClick }: {
  script: ScriptData; index: number; onClick: () => void;
}) {
  const cat = CATEGORY_CONFIG[script.format] ?? CATEGORY_CONFIG['Reels'];
  const formatEmoji = FORMAT_TYPE_EMOJI[script.format_type] ?? '🎬';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl border border-white/[0.08] overflow-hidden bg-gradient-to-br ${cat.gradient} hover:border-white/[0.18] hover:scale-[1.01] transition-all duration-200 group`}
    >
      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <span className="text-base font-black text-white/15 flex-shrink-0 leading-none mt-0.5">#{index + 1}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-white leading-snug mb-2 line-clamp-2">{script.title}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cat.badge}`}>
              {formatEmoji} {script.format_name || script.format}
            </span>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/[0.06] text-white/40 border border-white/[0.08]">
              {script.framework}
            </span>
            {script.funnel_stage && (
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                script.funnel_stage === 'TOFU' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20' :
                script.funnel_stage === 'MOFU' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' :
                'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
              }`}>
                {script.funnel_stage}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Hook preview */}
      <div className="px-4 py-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Zap className="w-3 h-3 text-amber-400/70" />
          <p className="text-[11px] font-bold text-amber-400/70 uppercase tracking-widest">Hook</p>
        </div>
        <p className="text-sm text-white/60 leading-relaxed line-clamp-3">{script.hook}</p>
      </div>

      {/* CTA preview + open hint */}
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <p className="text-xs text-emerald-400/60 truncate flex-1">{script.cta}</p>
        <span className="text-[11px] text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0 font-medium">
          Ver roteiro →
        </span>
      </div>
    </button>
  );
}

// ── Script Modal (popup com roteiro completo) ─────────────────────────────────

function ScriptModal({ script, index, onClose }: {
  script: ScriptData; index: number; onClose: () => void;
}) {
  const cat = CATEGORY_CONFIG[script.format] ?? CATEGORY_CONFIG['Reels'];
  const formatEmoji = FORMAT_TYPE_EMOJI[script.format_type] ?? '🎬';
  const bodyLines = script.body?.split('\n').filter(Boolean) ?? [];
  const fullText = `HOOK:\n${script.hook}\n\nROTEIRO:\n${script.body}\n\nCTA:\n${script.cta}`;

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
      <div className={`relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-white/[0.12] overflow-hidden bg-[#0d0d12] bg-gradient-to-br ${cat.gradient}`}>
        {/* Modal header */}
        <div className="flex items-start gap-3 px-6 pt-5 pb-4 border-b border-white/[0.08] flex-shrink-0">
          <span className="text-xl font-black text-white/15 flex-shrink-0 leading-none mt-1">#{index + 1}</span>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white leading-snug mb-2">{script.title}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${cat.badge}`}>
                {formatEmoji} {script.format_name || script.format}
              </span>
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-white/[0.06] text-white/50 border border-white/[0.08]">
                {script.framework}
              </span>
              {script.funnel_stage && (
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  script.funnel_stage === 'TOFU' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20' :
                  script.funnel_stage === 'MOFU' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' :
                  'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                }`}>
                  {script.funnel_stage} · {script.funnel_goal}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <CopyButton text={fullText} label="Copiar tudo" />
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Why choices + conversion angle */}
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
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold text-amber-400 uppercase tracking-widest">Hook</span>
              </div>
              <CopyButton text={script.hook} label="Copiar hook" />
            </div>
            <div className="rounded-xl px-5 py-4 bg-amber-500/[0.08] border border-amber-500/20">
              <p className="text-base text-white/90 leading-relaxed font-medium">{script.hook}</p>
            </div>
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-sm font-bold text-white/35 uppercase tracking-widest">Roteiro</span>
              <CopyButton text={script.body} label="Copiar roteiro" />
            </div>
            <div className="rounded-xl px-5 py-4 bg-white/[0.03] border border-white/[0.06] space-y-2.5">
              {bodyLines.map((line, i) => {
                const isDirective = /^\[.+\]/.test(line.trim());
                const isSlideHeader = /^(Slide|SLIDE|##)\s/.test(line.trim());
                return (
                  <p key={i} className={`leading-relaxed ${
                    isDirective ? 'text-white/30 italic text-sm' :
                    isSlideHeader ? 'text-white/55 text-sm font-bold uppercase tracking-wider pt-2' :
                    'text-base text-white/82'
                  }`}>
                    {line}
                  </p>
                );
              })}
            </div>
          </div>

          {/* Visual cues */}
          {script.visual_cues?.length > 0 && (
            <div>
              <p className="text-sm font-bold text-white/25 uppercase tracking-widest mb-2.5">Direção Visual</p>
              <div className="flex flex-wrap gap-2">
                {script.visual_cues.map((cue, i) => (
                  <span key={i} className="text-sm px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/45">
                    {cue}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Filming tip */}
          {script.filming_tip && (
            <div className="flex items-start gap-3 rounded-xl px-5 py-4 bg-white/[0.02] border border-white/[0.05]">
              <Film className="w-4 h-4 text-white/25 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-white/50 leading-relaxed">{script.filming_tip}</p>
            </div>
          )}

          {/* CTA */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-sm font-bold text-emerald-500/70 uppercase tracking-widest">CTA</span>
              <CopyButton text={script.cta} label="Copiar CTA" />
            </div>
            <div className="rounded-xl px-5 py-4 bg-emerald-500/[0.08] border border-emerald-500/20">
              <p className="text-base text-emerald-300 font-semibold leading-relaxed">{script.cta}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Engagement Panorama Card ──────────────────────────────────────────────────

const PANORAMA_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  'Otimo':           { bg: 'bg-violet-500/10', border: 'border-violet-500/30', text: 'text-violet-300', badge: 'bg-violet-500/20 text-violet-200' },
  'Muito Bom':       { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300', badge: 'bg-emerald-500/20 text-emerald-200' },
  'Bom':             { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-300', badge: 'bg-cyan-500/20 text-cyan-200' },
  'Abaixo da Media': { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-300', badge: 'bg-amber-500/20 text-amber-200' },
  'Ruim':            { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-300', badge: 'bg-rose-500/20 text-rose-200' },
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
    <div className={`rounded-2xl p-6 border ${colors.border} ${colors.bg}`}>
      <div className="flex items-center gap-2.5 mb-6">
        <TrendingUp className={`w-5 h-5 ${colors.text}`} />
        <span className={`text-base font-bold ${colors.text}`}>Panorama de Engajamento</span>
        <span className={`ml-auto text-sm font-bold px-3 py-1 rounded-full ${colors.badge}`}>
          {classification}
        </span>
      </div>

      {/* Rate + tier */}
      <div className="flex items-baseline gap-4 mb-6">
        <span className={`text-5xl font-black ${colors.text}`}>{panorama.profile_rate}</span>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-white/45">taxa média de engajamento</span>
          <span className="text-sm text-white/55 font-medium">{panorama.tier} · {panorama.market_position}</span>
        </div>
      </div>

      {/* Visual scale bar */}
      <div className="mb-4">
        <div className="flex h-2 rounded-full overflow-hidden gap-0.5 mb-1.5">
          {scaleColors.map((c, i) => (
            <div key={i} className={`flex-1 ${c} opacity-30`} />
          ))}
        </div>
        <div className="relative h-1">
          <div
            className={`absolute top-0 w-2 h-2 rounded-full -translate-y-0.5 ${colors.text.replace('text-', 'bg-')} shadow-lg`}
            style={{ left: `${scalePercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-white/25 mt-2 uppercase tracking-wider">
          <span>Ruim</span>
          <span>Abaixo</span>
          <span>Bom</span>
          <span>Muito Bom</span>
          <span>Ótimo</span>
        </div>
      </div>

      {/* Benchmark reference */}
      <div className="rounded-xl p-3 bg-white/[0.03] border border-white/[0.06] mb-3">
        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Referência para {panorama.tier}</p>
        <p className="text-xs text-white/60 font-mono">{panorama.tier_benchmark}</p>
      </div>

      {/* Verdict */}
      <p className="text-base text-white/70 leading-relaxed">{panorama.verdict}</p>
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
    <div className="rounded-2xl p-6 border border-indigo-500/20 bg-white/[0.03]">
      <div className="flex items-center gap-2 mb-5">
        <History className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-semibold text-indigo-300">Evolução vs. análise de {dateStr}</span>
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

export function MaverickSession({ onClose }: MaverickSessionProps) {
  const [phase, setPhase] = useState<Phase>('asking');
  const [username, setUsername] = useState('');
  const [steps, setSteps] = useState<string[]>([]);
  const [report, setReport] = useState<MaverickReport | null>(null);
  const [rawPlan, setRawPlan] = useState('');
  const [scripts, setScripts] = useState('');
  const [streamingScripts, setStreamingScripts] = useState('');
  const [parsedScripts, setParsedScripts] = useState<ScriptData[] | null>(null);
  const [selectedScript, setSelectedScript] = useState<{ script: ScriptData; index: number } | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [icp, setIcp] = useState<ICPData>({
    product: '', price_range: '', main_objection: '', ideal_customer: '', transformation: '',
  });
  const [previousAnalysis, setPreviousAnalysis] = useState<HistoryEntry | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryListEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
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

  // Carrega lista de análises passadas no mount
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch(`${API_URL}/api/maverick/history?limit=20`);
        if (!res.ok) return;
        const data = await res.json();
        setHistoryItems(data.analyses ?? []);
      } catch { /* ignora */ }
    }
    loadHistory();
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
    // Se já tem roteiros salvos, vai direto para done
    if (entry.scripts && Array.isArray(entry.scripts) && entry.scripts.length > 0) {
      setParsedScripts(entry.scripts as ScriptData[]);
      setPhase('done');
    } else {
      setPhase('report');
    }
  }, [stopSpeech]);

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

  const handleApprove = useCallback(async () => {
    setPhase('running-scripts');
    setStreamingScripts('');
    setScripts('');
    setParsedScripts(null);
    abortRef.current = false;
    setSteps([]);

    try {
      for await (const event of streamSse('/api/maverick/scripts', { plan: rawPlan, ...(analysisId ? { analysisId } : {}) } as Record<string, unknown>)) {
        if (abortRef.current) break;

        switch (event.type) {
          case 'step':
            addStep(event.message as string);
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
  }, [rawPlan, addStep]);

  const handleReset = useCallback(() => {
    abortRef.current = true;
    stopSpeech();
    setIsSpeaking(false);
    setPhase('asking');
    setUsername('');
    setSteps([]);
    setReport(null);
    setRawPlan('');
    setScripts('');
    setStreamingScripts('');
    setParsedScripts(null);
    setSelectedScript(null);
    setAnalysisId(null);
    setErrorMsg('');
    setPreviousAnalysis(null);
    setShowComparison(false);
    setShowHistory(false);
    setIcp({ product: '', price_range: '', main_objection: '', ideal_customer: '', transformation: '' });
  }, [stopSpeech]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGoToIcpForm();
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <header className="flex items-center gap-3 px-6 h-14 border-b border-white/[0.06] flex-shrink-0">
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          title="Voltar ao chat"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-lg">🦅</span>
        <div>
          <span className="text-sm font-semibold text-white">Squad Maverick</span>
          {report && (
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
              FASE: ASKING — formulário de input
          ════════════════════════════════════════════════════════ */}
          {phase === 'asking' && (
            <div className="flex flex-col items-center justify-center pt-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="bg-white/[0.02] backdrop-blur-3xl border border-white/[0.08] shadow-[0_24px_50px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.1)] rounded-[32px] p-10 w-full max-w-[580px] flex flex-col gap-8 relative overflow-hidden group">
                {/* Discrete background glow */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-500/10 blur-[80px] pointer-events-none group-hover:bg-purple-500/20 transition-colors duration-700" />
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 blur-[80px] pointer-events-none group-hover:bg-blue-500/20 transition-colors duration-700" />

                {/* Headline */}
                <div className="text-center space-y-3 relative z-10">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-white/10 to-white/[0.02] border border-white/10 flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">
                    🦅
                  </div>
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">Análise de Perfil</h2>
                  <p className="text-white/50 text-sm max-w-[340px] mx-auto leading-relaxed">
                    Estratégia e Inteligência para crescer com autoridade no Instagram.
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
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-white/40 text-xl font-semibold transition-colors group-focus-within/input:text-purple-400">@</span>
                    <input
                      ref={inputRef}
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="username do perfil"
                      className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 rounded-[24px] pl-14 pr-6 py-6 text-white placeholder:text-white/20 text-lg focus:outline-none focus:border-white/20 focus:bg-white/[0.08] transition-all duration-300 shadow-inner"
                    />
                  </div>
                  <button
                    onClick={handleGoToIcpForm}
                    disabled={!username.trim()}
                    className="w-fit mx-auto px-10 py-4 bg-white text-black hover:bg-white/90 rounded-[20px] text-sm font-bold flex items-center justify-center gap-2.5 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-[0_12px_30px_rgba(255,255,255,0.1)]"
                  >
                    <TrendingUp className="w-4 h-4" />
                    Continuar
                  </button>
                </div>
              </div>

              <div className="mt-8 text-center text-[11px] text-white/20 uppercase tracking-widest font-medium">
                Powered by AIOS Core & OpenRouter
              </div>

              {/* ── Histórico de análises passadas ── */}
              {historyItems.length > 0 && (
                <div className="w-full max-w-[580px] mt-2">
                  <button
                    onClick={() => setShowHistory(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] transition-colors group"
                  >
                    <div className="flex items-center gap-2 text-sm text-white/50 group-hover:text-white/70 transition-colors">
                      <History className="w-4 h-4" />
                      <span>Análises anteriores</span>
                      <span className="text-[11px] bg-white/10 rounded-full px-2 py-0.5">{historyItems.length}</span>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-white/30 transition-transform duration-200 ${showHistory ? 'rotate-90' : ''}`} />
                  </button>

                  {showHistory && (
                    <div className="mt-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                      <div className="max-h-72 overflow-y-auto">
                        {historyItems.map((item, i) => {
                          const score = item.strategy?.profile_score?.overall;
                          const scoreColor = score == null ? '' : score >= 75 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-rose-400';
                          const date = new Date(item.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
                          const canLoad = !!(item.profile && item.analysis && item.strategy);
                          return (
                            <button
                              key={item.id}
                              onClick={() => canLoad && handleLoadHistoryEntry(item)}
                              disabled={!canLoad}
                              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${i > 0 ? 'border-t border-white/[0.05]' : ''} ${canLoad ? 'hover:bg-white/[0.05] cursor-pointer' : 'opacity-40 cursor-default'}`}
                            >
                              <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-sm flex-shrink-0">
                                🦅
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white/80 truncate">@{item.username}</p>
                                <p className="text-[11px] text-white/30">{date}</p>
                              </div>
                              {item.scripts && item.scripts.length > 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 flex-shrink-0">
                                  {item.scripts.length} roteiros
                                </span>
                              )}
                              {score != null && (
                                <span className={`text-sm font-bold flex-shrink-0 ${scoreColor}`}>{score}</span>
                              )}
                              <ChevronRight className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              FASE: ICP-FORM — coleta do perfil de cliente ideal
          ════════════════════════════════════════════════════════ */}
          {phase === 'icp-form' && (
            <div className="flex flex-col items-center justify-center pt-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="bg-white/[0.02] backdrop-blur-3xl border border-white/[0.08] shadow-[0_24px_50px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.1)] rounded-[32px] p-10 w-full max-w-[580px] flex flex-col gap-7 relative overflow-hidden">
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-500/10 blur-[60px] pointer-events-none" />

                <div className="text-center space-y-2">
                  <div className="text-2xl mb-2">🎯</div>
                  <h2 className="text-2xl font-extrabold text-white tracking-tight">Perfil do Cliente Ideal</h2>
                  <p className="text-white/45 text-sm leading-relaxed">
                    Opcional — quanto mais contexto você der, mais precisa é a análise e os roteiros.
                  </p>
                  <p className="text-white/25 text-xs">Analisando <span className="text-white/50 font-semibold">@{username.replace(/^@/, '')}</span></p>
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
                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/25 focus:bg-white/[0.06] transition-all"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setPhase('asking')}
                    className="flex-1 py-3.5 rounded-2xl border border-white/10 text-white/40 text-sm font-medium hover:text-white/70 hover:border-white/20 transition-all"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={() => handleAnalyze(icp)}
                    className="flex-[2] py-3.5 bg-white text-black rounded-2xl text-sm font-bold hover:bg-white/90 transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(255,255,255,0.1)]"
                  >
                    <TrendingUp className="w-4 h-4" />
                    Iniciar Análise Maverick
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              FASE: RUNNING-PLAN — loading com logs
          ════════════════════════════════════════════════════════ */}
          {phase === 'running-plan' && (
            <div className="flex flex-col items-center gap-8 pt-12">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-2 border-white/10 flex items-center justify-center text-4xl">
                  🦅
                </div>
                <Loader2 className="absolute -right-1 -bottom-1 w-6 h-6 text-white/40 animate-spin" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-white font-semibold">Analisando perfil</h3>
                <p className="text-white/40 text-sm">Isso pode levar alguns minutos...</p>
              </div>
              <div className="w-full max-w-md space-y-2">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-white/50">
                    <CheckCircle className="w-4 h-4 text-emerald-500/60 flex-shrink-0" />
                    <span>{step}</span>
                  </div>
                ))}
                {steps.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-white/30">
                    <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                    <span>Processando...</span>
                  </div>
                )}
              </div>
            </div>
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
                  {/* Métricas do perfil — 3 colunas */}
                  <div className="grid grid-cols-3 gap-4">
                    <MetricCard
                      icon={Users}
                      label="Seguidores"
                      value={report.profile.followers}
                      color="border-violet-500/20 text-violet-300"
                    />
                    <MetricCard
                      icon={UserCheck}
                      label="Seguindo"
                      value={report.profile.following}
                      color="border-blue-500/20 text-blue-300"
                    />
                    <MetricCard
                      icon={ImageIcon}
                      label="Posts"
                      value={report.profile.posts_count}
                      color="border-cyan-500/20 text-cyan-300"
                    />
                  </div>

                  {/* Bio */}
                  {report.profile.bio && (
                    <div className="rounded-2xl px-5 py-4 border border-white/[0.06] bg-white/[0.02]">
                      <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Bio</p>
                      <p className="text-base text-white/70 leading-relaxed">{report.profile.bio}</p>
                    </div>
                  )}

                  {/* Análise — 2 colunas */}
                  <div className="grid grid-cols-2 gap-4">
                    <ListCard
                      icon={TrendingUp}
                      title="Pontos Positivos"
                      items={report.analysis.positive_points}
                      color={{
                        border: 'border-emerald-500/20',
                        accent: 'text-emerald-400',
                        dot: 'bg-emerald-400',
                      }}
                      emptyMsg="Nenhum ponto positivo identificado"
                    />
                    <ListCard
                      icon={AlertTriangle}
                      title="Brechas do Perfil"
                      items={report.analysis.profile_gaps}
                      color={{
                        border: 'border-amber-500/20',
                        accent: 'text-amber-400',
                        dot: 'bg-amber-400',
                      }}
                      emptyMsg="Nenhuma brecha identificada"
                    />
                  </div>

                  {/* Posts — 2 colunas */}
                  <div className="grid grid-cols-2 gap-4">
                    <PostCard
                      icon={Star}
                      title="Melhores Posts"
                      posts={report.analysis.best_posts}
                      color={{
                        border: 'border-cyan-500/20',
                        accent: 'text-cyan-400',
                        badge: 'border-cyan-500/10',
                      }}
                    />
                    <PostCard
                      icon={ThumbsDown}
                      title="Piores Posts"
                      posts={report.analysis.worst_posts}
                      color={{
                        border: 'border-rose-500/20',
                        accent: 'text-rose-400',
                        badge: 'border-rose-500/10',
                      }}
                    />
                  </div>

                  {/* Estratégia — full width */}
                  <div className="rounded-2xl p-6 border border-purple-500/20 bg-white/[0.03]">
                    <div className="flex items-center gap-2 text-purple-400 mb-5">
                      <Lightbulb className="w-4 h-4" />
                      <span className="text-sm font-semibold">Análise Estratégica Maverick</span>
                    </div>

                    <div className="space-y-4">
                      {/* Diagnóstico */}
                      <div>
                        <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Diagnóstico</p>
                        <p className="text-base text-white/78 leading-relaxed">{report.strategy.diagnosis}</p>
                      </div>

                      {/* Conceito chave + citação */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-xl p-4 bg-white/[0.03] border border-white/[0.06]">
                          <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Conceito Chave</p>
                          <p className="text-base font-medium text-purple-300">{report.strategy.key_concept}</p>
                        </div>
                        <div className="rounded-xl p-4 bg-white/[0.03] border border-white/[0.06]">
                          <div className="flex items-start gap-2">
                            <Quote className="w-4 h-4 text-white/30 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-white/55 leading-relaxed italic">{report.strategy.citation}</p>
                          </div>
                        </div>
                      </div>

                      {/* Próximos passos / ideias de roteiros */}
                      <div>
                        <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Ideias de Roteiros</p>
                        <div className="space-y-2.5">
                          {report.strategy.next_steps.map((step, i) => (
                            <div key={i} className="flex items-start gap-3 rounded-xl p-4 bg-white/[0.03] border border-white/[0.05]">
                              <span className="text-sm font-bold text-purple-400/60 flex-shrink-0 mt-0.5">#{i + 1}</span>
                              <p className="text-base text-white/72 leading-relaxed">{step}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Score do Perfil */}
                  {report.strategy.profile_score && (
                    <ProfileScoreCard score={report.strategy.profile_score} />
                  )}

                  {/* Panorama de Engajamento */}
                  {report.strategy.engagement_panorama && (
                    <EngagementPanoramaCard panorama={report.strategy.engagement_panorama} />
                  )}

                  {/* Painel Antes/Depois */}
                  {showComparison && previousAnalysis && (
                    <ComparisonPanel
                      current={report}
                      previous={previousAnalysis}
                      previousDate={previousAnalysis.createdAt}
                    />
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
              FASE: DONE — roteiros em cards
          ════════════════════════════════════════════════════════ */}
          {phase === 'done' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span className="text-emerald-300 text-sm font-medium">
                  {parsedScripts ? `${parsedScripts.length} roteiros prontos!` : 'Roteiros gerados!'}
                </span>
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
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl text-white text-sm font-semibold transition-all"
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
              <button
                onClick={handleReset}
                className="w-full px-4 py-3 bg-white/[0.05] hover:bg-white/10 border border-white/10 rounded-xl text-white/60 text-sm transition-all"
              >
                Analisar outro perfil
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
