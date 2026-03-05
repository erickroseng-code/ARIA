'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Send, CheckCircle, XCircle, Loader2,
  Users, UserCheck, ImageIcon, TrendingUp, AlertTriangle,
  Star, ThumbsDown, Lightbulb, Quote, ChevronRight,
  BarChart2, History, ArrowUpRight, ArrowDownRight, Minus,
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
}

type Phase = 'asking' | 'running-plan' | 'report' | 'running-scripts' | 'done' | 'error';

interface MaverickSessionProps {
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function* streamSse(
  endpoint: string,
  body: Record<string, string>,
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
    <div className={`flex flex-col gap-2 rounded-2xl p-5 border ${color} bg-white/[0.03]`}>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 opacity-60" />
        <span className="text-xs text-white/50 uppercase tracking-wider font-medium">{label}</span>
      </div>
      <span className="text-3xl font-bold text-white leading-none">{value}</span>
    </div>
  );
}

function ListCard({ icon: Icon, title, items, color, emptyMsg }: {
  icon: React.ElementType; title: string; items: string[];
  color: { border: string; accent: string; dot: string }; emptyMsg: string;
}) {
  return (
    <div className={`rounded-2xl p-5 border ${color.border} bg-white/[0.03] flex flex-col gap-4`}>
      <div className={`flex items-center gap-2 ${color.accent}`}>
        <Icon className="w-4 h-4" />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-white/30 text-sm italic">{emptyMsg}</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-white/75 leading-relaxed">
              <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${color.dot}`} />
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
    <div className={`rounded-2xl p-5 border ${color.border} bg-white/[0.03] flex flex-col gap-4`}>
      <div className={`flex items-center gap-2 ${color.accent}`}>
        <Icon className="w-4 h-4" />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      {posts.length === 0 ? (
        <p className="text-white/30 text-sm italic">Sem dados suficientes</p>
      ) : (
        <div className="space-y-3">
          {posts.map((post, i) => (
            <div key={i} className={`rounded-xl p-3 border ${color.badge} bg-white/[0.02]`}>
              <p className="text-white/80 text-xs font-mono leading-relaxed mb-1.5 truncate">
                "{post.caption_preview}..."
              </p>
              <p className="text-white/50 text-xs leading-relaxed">{post.reason}</p>
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
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs">
        <span className="text-white/50">{label}</span>
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
      <div className="flex items-center gap-2 mb-5">
        <BarChart2 className="w-4 h-4 text-white/40" />
        <span className="text-sm font-semibold text-white/70">Score do Perfil</span>
      </div>

      <div className="flex items-center gap-6 mb-6">
        {/* Nota geral em destaque */}
        <div className="flex flex-col items-center justify-center w-24 h-24 rounded-2xl border border-white/[0.08] bg-white/[0.04] flex-shrink-0">
          <span className={`text-4xl font-black ${color}`}>{overall}</span>
          <span className="text-[10px] text-white/30 uppercase tracking-widest mt-0.5">/ 100</span>
        </div>
        {/* Barras de dimensões */}
        <div className="flex-1 space-y-2.5">
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
  const [errorMsg, setErrorMsg] = useState('');
  const [previousAnalysis, setPreviousAnalysis] = useState<HistoryEntry | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryListEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<boolean>(false);

  const { speak, stop: stopSpeech } = useAriaSpeech();

  // Para o TTS ao sair do modo Maverick
  useEffect(() => {
    return () => { stopSpeech(); };
  }, [stopSpeech]);

  useEffect(() => {
    if (phase === 'asking') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [phase]);

  // Briefing em voz quando o relatório fica pronto
  useEffect(() => {
    if (report && phase === 'report') {
      const text = buildBriefing(report);
      speak(text);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report]);

  // Briefing dos roteiros quando ficam prontos
  useEffect(() => {
    if (phase === 'done' && scripts) {
      speak('Roteiros prontos. Confira o conteúdo gerado na tela.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

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
    const reconstructed: MaverickReport = {
      profile: entry.profile,
      analysis: entry.analysis,
      strategy: entry.strategy,
    };
    setReport(reconstructed);
    setRawPlan(JSON.stringify(reconstructed));
    setUsername(entry.profile.username);
    setSteps([]);
    setPreviousAnalysis(null);
    setShowComparison(false);
    setShowHistory(false);
    setPhase('report');
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

  const handleAnalyze = useCallback(async () => {
    const clean = username.trim().replace(/^@/, '');
    if (!clean) return;

    setPhase('running-plan');
    setSteps([]);
    setReport(null);
    setRawPlan('');
    setPreviousAnalysis(null);
    setShowComparison(false);
    abortRef.current = false;

    try {
      for await (const event of streamSse('/api/maverick/plan', { username: clean })) {
        if (abortRef.current) break;

        switch (event.type) {
          case 'step':
            addStep(event.message as string);
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
    abortRef.current = false;
    setSteps([]);

    try {
      for await (const event of streamSse('/api/maverick/scripts', { plan: rawPlan })) {
        if (abortRef.current) break;

        switch (event.type) {
          case 'step':
            addStep(event.message as string);
            break;
          case 'chunk':
            setStreamingScripts(prev => prev + (event.content as string));
            break;
          case 'scripts':
            setScripts(event.content as string);
            setPhase('done');
            break;
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
    setPhase('asking');
    setUsername('');
    setSteps([]);
    setReport(null);
    setRawPlan('');
    setScripts('');
    setStreamingScripts('');
    setErrorMsg('');
    setPreviousAnalysis(null);
    setShowComparison(false);
    setShowHistory(false);
  }, [stopSpeech]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAnalyze();
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
        <div className="max-w-4xl mx-auto space-y-6">

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
                    onClick={handleAnalyze}
                    disabled={!username.trim()}
                    className="w-fit mx-auto px-10 py-4 bg-white text-black hover:bg-white/90 rounded-[20px] text-sm font-bold flex items-center justify-center gap-2.5 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-[0_12px_30px_rgba(255,255,255,0.1)]"
                  >
                    <TrendingUp className="w-4 h-4" />
                    Iniciar Análise Maverick
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
                      <p className="text-sm text-white/70 leading-relaxed">{report.profile.bio}</p>
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
                        <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Diagnóstico</p>
                        <p className="text-sm text-white/75 leading-relaxed">{report.strategy.diagnosis}</p>
                      </div>

                      {/* Conceito chave + citação */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-xl p-4 bg-white/[0.03] border border-white/[0.06]">
                          <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Conceito Chave</p>
                          <p className="text-sm font-medium text-purple-300">{report.strategy.key_concept}</p>
                        </div>
                        <div className="rounded-xl p-4 bg-white/[0.03] border border-white/[0.06]">
                          <div className="flex items-start gap-2">
                            <Quote className="w-3.5 h-3.5 text-white/30 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-white/50 leading-relaxed italic">{report.strategy.citation}</p>
                          </div>
                        </div>
                      </div>

                      {/* Próximos passos / ideias de roteiros */}
                      <div>
                        <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Ideias de Roteiros</p>
                        <div className="space-y-2">
                          {report.strategy.next_steps.map((step, i) => (
                            <div key={i} className="flex items-start gap-3 rounded-xl p-3 bg-white/[0.03] border border-white/[0.05]">
                              <span className="text-xs font-bold text-purple-400/60 flex-shrink-0 mt-0.5">#{i + 1}</span>
                              <p className="text-sm text-white/70 leading-relaxed">{step}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Score do Perfil (Feature 3) */}
                  {report.strategy.profile_score && (
                    <ProfileScoreCard score={report.strategy.profile_score} />
                  )}

                  {/* Painel Antes/Depois (Feature 4) */}
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
              FASE: RUNNING-SCRIPTS — streaming
          ════════════════════════════════════════════════════════ */}
          {phase === 'running-scripts' && (
            <div className="space-y-4">
              <StepLog steps={steps} />
              <div className="flex items-center gap-3 mb-4">
                <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
                <span className="text-white/50 text-sm">Copywriter gerando roteiros...</span>
              </div>
              {streamingScripts && (
                <div className="rounded-2xl p-6 border border-white/10 bg-white/[0.03]">
                  <pre className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap font-sans">
                    {streamingScripts}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              FASE: DONE — roteiros finais
          ════════════════════════════════════════════════════════ */}
          {phase === 'done' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span className="text-emerald-300 text-sm font-medium">Roteiros gerados com sucesso!</span>
              </div>
              <div className="rounded-2xl p-6 border border-white/10 bg-white/[0.03]">
                <pre className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap font-sans">
                  {scripts || streamingScripts}
                </pre>
              </div>
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
