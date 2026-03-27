'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, DollarSign, Type, ChevronRight, Copy, Check, RotateCcw, Compass, Loader2, ExternalLink, ArrowLeft, Film } from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = 'content' | 'sales' | 'microcopy' | null;
type Phase = 'landing' | 'scoping' | 'dossie' | 'generating' | 'result';

interface Dossie {
  strategy: string;
  hooks: string[];
}

interface MaverickSessionProps {
  onClose: () => void;
}

interface IgVideo { title: string; content: string; url: string; views: number; viralScore: number }

interface HistoryEntry {
  id: string;
  timestamp: string;
  mode: string;
  label: string;
  hook: string;
  scriptPreview: string;
  script: string;
  keywords?: string[];
}

interface SherlockTrendContext {
  mode?: string;
  objective?: string;
  cta?: string;
  source?: string;
  title?: string;
  content?: string;
  url?: string;
  contextText?: string;
}

// ─── Mode Config ──────────────────────────────────────────────────────────────

const MODES = [
  {
    id: 'content' as const,
    icon: Zap,
    label: 'Quero postar no Instagram',
    sub: 'Reels · Carrossel · Stories',
    color: '#a855f7',
    border: 'border-violet-500/30 hover:border-violet-500/60',
    bg: 'bg-violet-500/5 hover:bg-violet-500/10',
    text: 'text-violet-400',
    dot: 'bg-violet-400',
  },
  {
    id: 'sales' as const,
    icon: DollarSign,
    label: 'Quero vender um produto ou serviço',
    sub: 'Página de Vendas · VSL · Oferta',
    color: '#22c55e',
    border: 'border-emerald-500/30 hover:border-emerald-500/60',
    bg: 'bg-emerald-500/5 hover:bg-emerald-500/10',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
  },
  {
    id: 'microcopy' as const,
    icon: Type,
    label: 'Preciso de um texto curto',
    sub: 'Headline · Botão · Legenda · CTA',
    color: '#f59e0b',
    border: 'border-amber-500/30 hover:border-amber-500/60',
    bg: 'bg-amber-500/5 hover:bg-amber-500/10',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
  },
];

// ─── Scoping Questions per Mode ───────────────────────────────────────────────

const SCOPING_FIELDS: Record<NonNullable<Mode>, { key: string; label: string; placeholder: string; type?: 'radio'; options?: string[] }[]> = {
  content: [
    {
      key: 'objetivo',
      label: 'Objetivo',
      placeholder: '',
      type: 'radio',
      options: ['🚀 Viral', '💎 Autoridade', '💰 Venda'],
    },
    {
      key: 'temaInimigo',
      label: 'Tema e Inimigo Comum',
      placeholder: 'O que vamos falar e quem vamos atacar?',
    },
    {
      key: 'cta',
      label: 'CTA desejada',
      placeholder: 'O que o seguidor deve fazer?',
    },
  ],
  sales: [
    {
      key: 'produto',
      label: 'Produto e Valor',
      placeholder: 'O que é e quanto custa?',
    },
    {
      key: 'mecanismo',
      label: 'Mecanismo Único',
      placeholder: 'Qual o seu diferencial?',
    },
    {
      key: 'objecao',
      label: 'A Maior Objeção',
      placeholder: 'Por que eles não compram?',
    },
  ],
  microcopy: [
    {
      key: 'local',
      label: 'Local da Copy',
      placeholder: 'Onde será usado? (ex: botão de CTA, header da LP)',
    },
    {
      key: 'contexto',
      label: 'Contexto / Gatilho',
      placeholder: 'Escassez, Curiosidade, Lembrete?',
    },
    {
      key: 'acao',
      label: 'Ação Imediata',
      placeholder: 'O que o lead deve clicar/fazer?',
    },
  ],
};

// ─── Component ────────────────────────────────────────────────────────────────

export function MaverickSession({ onClose }: MaverickSessionProps) {
  const [phase, setPhase] = useState<Phase>('landing');
  const [mode, setMode] = useState<Mode>(null);
  const [scopingAnswers, setScopingAnswers] = useState<Record<string, string>>({});
  const [dossie, setDossie] = useState<Dossie | null>(null);
  const [chosenHook, setChosenHook] = useState<string | null>(null);
  const [script, setScript] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [contentStep, setContentStep] = useState<1 | 2 | 3>(1);
  const [trendContext, setTrendContext] = useState<{ source: string; title: string; url: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Oracle state (usado nos modos sales/microcopy)
  const [oracleOpen, setOracleOpen] = useState(false);
  const [oracleIdea, setOracleIdea] = useState('');
  const [oracleLoading, setOracleLoading] = useState(false);
  const [oracleResult, setOracleResult] = useState<{
    niche: string; targetAudience: string; enemy: string;
    mechanism: string; pains: string[];
    sources: { title: string; url: string; snippet: string }[];
  } | null>(null);

  // Discover state (novo fluxo Sherlock — modo content)
  const [discoverNiche, setDiscoverNiche] = useState('');
  const [discoverPeriod, setDiscoverPeriod] = useState<30 | 45 | 60 | 90>(30);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverResult, setDiscoverResult] = useState<{
    keywords: string[];
    themes: { title: string; pain: string }[];
    niche: string;
    enemy: string;
  } | null>(null);

  // Instagram videos state (Opção B)
  const [igVideos, setIgVideos] = useState<IgVideo[]>([]);
  const [igVideosLoading, setIgVideosLoading] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState<IgVideo[]>([]);

  // Histórico
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const modeConfig = MODES.find(m => m.id === mode);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem('aria_maverick_trend_context');
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as SherlockTrendContext;
      if (parsed.mode === 'content' && parsed.contextText?.trim()) {
        setMode('content');
        setPhase('scoping');
        setContentStep(3);
        setScopingAnswers({
          objetivo: parsed.objective || '🚀 Viral',
          temaInimigo: parsed.contextText,
          cta: parsed.cta || 'Salvar e compartilhar',
        });
        setTrendContext({
          source: parsed.source || 'Fonte desconhecida',
          title: parsed.title || 'Trend selecionado',
          url: parsed.url || '',
        });
      }
    } catch {
      // no-op
    } finally {
      localStorage.removeItem('aria_maverick_trend_context');
    }
  }, []);

  // Carrega histórico ao montar
  useEffect(() => {
    fetch(`${API_BASE}/api/maverick/history`)
      .then(r => r.json())
      .then(d => setHistory(d.entries ?? []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, []);

  // Salva no histórico quando roteiro é gerado
  useEffect(() => {
    if (phase !== 'result' || !script || !mode || !chosenHook) return;
    const label = mode === 'content'
      ? (discoverResult?.niche ?? scopingAnswers.temaInimigo ?? '')
      : mode === 'sales'
      ? (scopingAnswers.produto ?? '')
      : (scopingAnswers.local ?? '');
    fetch(`${API_BASE}/api/maverick/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        label,
        hook: chosenHook,
        scriptPreview: script.slice(0, 140),
        script,
        keywords: discoverResult?.keywords,
      }),
    })
      .then(r => r.json())
      .then(d => { if (d.entry) setHistory(prev => [d.entry, ...prev]); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Oracle para modos sales/microcopy ──────────────────────────────────────
  const handleOracle = async () => {
    if (!oracleIdea.trim()) return;
    setOracleLoading(true); setError(null); setOracleResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/maverick/oracle`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawIdea: oracleIdea }),
      });
      if (!res.ok) throw new Error('Falha no Oráculo');
      const data = await res.json();
      setOracleResult(data.blueprint);
    } catch (e: any) { setError(e.message ?? 'Erro no oráculo'); }
    finally { setOracleLoading(false); }
  };

  const applyOracleToScoping = () => {
    if (!oracleResult || !mode) return;
    if (mode === 'sales') {
      setScopingAnswers(prev => ({ ...prev, produto: oracleResult!.mechanism, objecao: oracleResult!.pains[0] ?? '' }));
    } else if (mode === 'microcopy') {
      setScopingAnswers(prev => ({ ...prev, contexto: `${oracleResult!.niche}: ${oracleResult!.pains.join(', ')}` }));
    }
    setOracleOpen(false); setOracleResult(null);
  };

  // ── Discover (Sherlock + Tavily) ─────────────────────────────────────────────
  const handleDiscover = async () => {
    if (!discoverNiche.trim()) return;
    setDiscoverLoading(true);
    setError(null);
    setDiscoverResult(null);
    setIgVideos([]);
    setSelectedVideos([]);
    try {
      // 1. Descobre keywords do nicho via Tavily
      const discoverRes = await fetch(`${API_BASE}/api/maverick/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche: discoverNiche,
          objective: scopingAnswers.objetivo ?? '🚀 Viral',
          period: discoverPeriod,
        }),
      });
      if (!discoverRes.ok) throw new Error('Falha ao descobrir tendências');
      const data = await discoverRes.json();
      setDiscoverResult(data.discovery);
      // Vídeos serão buscados em applyDiscoverToScoping (Sherlock precisa de tempo para rodar)
    } catch (e: any) {
      setError(e.message ?? 'Erro ao descobrir tendências');
    } finally {
      setDiscoverLoading(false);
    }
  };

  const applyDiscoverToScoping = async () => {
    if (!discoverResult) return;
    setScopingAnswers(prev => ({
      ...prev,
      temaInimigo: `${discoverResult.niche} — Inimigo: ${discoverResult.enemy}`,
      nicheContext: JSON.stringify(discoverResult),
    }));
    setContentStep(3);

    // Busca vídeos agora — Sherlock teve tempo de rodar enquanto o user lia o discovery
    setIgVideosLoading(true);
    setIgVideos([]);
    setSelectedVideos([]);
    const keywords = discoverResult.keywords ?? [];
    try {
      const res = await fetch(
        `${API_BASE}/api/maverick/instagram-videos?keywords=${encodeURIComponent(keywords.join(','))}`
      );
      if (res.ok) {
        const vData = await res.json();
        setIgVideos(vData.videos ?? []);
      }
    } catch { /* vídeos são opcionais — não bloqueia o fluxo */ }
    finally { setIgVideosLoading(false); }
  };

  // ── Scoping → Dossiê ────────────────────────────────────────────────────────
  const handleScoping = async () => {
    if (!mode) return;
    const fields = SCOPING_FIELDS[mode];
    const allFilled = fields.every(f => scopingAnswers[f.key]?.trim());
    if (!allFilled) {
      setError('Preencha todos os campos antes de continuar.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/maverick/dossie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          scopingAnswers,
          referenceVideos: selectedVideos.length > 0 ? selectedVideos : undefined,
        }),
      });
      if (!res.ok) throw new Error('Erro ao gerar dossiê');
      const data = await res.json();
      setDossie(data.dossie);
      setPhase('dossie');
    } catch (e: any) {
      setError(e.message ?? 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Dossiê → Geração ────────────────────────────────────────────────────────
  const handleGenerate = async (hook: string) => {
    if (!mode) return;
    setChosenHook(hook);
    setScript('');
    setPhase('generating');

    abortRef.current = new AbortController();
    try {
      const res = await fetch(`${API_BASE}/api/maverick/generate-v2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, scopingAnswers, chosenHook: hook }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error('Falha na geração');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accum = '';

      let done = false;
      while (!done) {
        const chunk = await reader.read();
        done = chunk.done;
        if (done) break;
        const value = chunk.value;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const t = line.trim();
          if (!t || t === 'data: [DONE]') continue;
          if (t.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(t.slice(6));
              if (parsed.chunk) {
                accum += parsed.chunk;
                setScript(accum);
              }
            } catch { /* skip */ }
          }
        }
      }

      setPhase('result');
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(e.message ?? 'Erro durante geração');
        setPhase('dossie');
      }
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    abortRef.current?.abort();
    setPhase('landing');
    setMode(null);
    setScopingAnswers({});
    setDossie(null);
    setChosenHook(null);
    setScript('');
    setError(null);
    setContentStep(1);
    setTrendContext(null);
    setDiscoverNiche('');
    setDiscoverPeriod(30);
    setDiscoverLoading(false);
    setDiscoverResult(null);
    setIgVideos([]);
    setSelectedVideos([]);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-[#080809]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <Zap className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm tracking-tight">Maverick V2</p>
            <p className="text-white/30 text-[11px] uppercase tracking-widest">Copywriter A-List</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {phase !== 'landing' && (
            <button
              onClick={handleReset}
              className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-colors"
              title="Recomeçar"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto scrollbar-hidden">
        <div className="max-w-2xl mx-auto px-6 py-10">
          <AnimatePresence mode="wait">

            {/* ── FASE 0: LANDING ─────────────────────────────────────────── */}
            {phase === 'landing' && (
              <motion.div
                key="landing"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="space-y-8"
              >
                <div>
                  <p className="text-white/80 text-xl font-semibold tracking-tight">
                    O que você precisa agora?
                  </p>
                  <p className="text-white/35 text-sm mt-1">
                    Maverick gera a copy. Você escolhe o objetivo.
                  </p>
                </div>

                <div className="space-y-3">
                  {MODES.map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        onClick={() => { setMode(m.id); setPhase('scoping'); setScopingAnswers({}); }}
                        className={cn(
                          'w-full text-left flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200',
                          m.border, m.bg
                        )}
                      >
                        <div className="p-2.5 rounded-xl" style={{ background: `${m.color}15`, border: `1px solid ${m.color}30` }}>
                          <Icon className="w-4 h-4" style={{ color: m.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white/90 font-medium text-sm">{m.label}</p>
                          <p className="text-white/35 text-xs mt-0.5">{m.sub}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-white/20 flex-shrink-0" />
                      </button>
                    );
                  })}
                </div>

                {/* Histórico de roteiros */}
                {!historyLoading && history.length > 0 && (
                  <div className="space-y-2.5">
                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Roteiros anteriores</p>
                    {history.slice(0, 4).map(entry => {
                      const modeConf = MODES.find(m => m.id === entry.mode);
                      const relTime = (() => {
                        const diff = Date.now() - new Date(entry.timestamp).getTime();
                        const h = Math.floor(diff / 3600000);
                        const d = Math.floor(diff / 86400000);
                        if (d > 0) return `${d}d atrás`;
                        if (h > 0) return `${h}h atrás`;
                        return 'Agora';
                      })();
                      return (
                        <button
                          key={entry.id}
                          onClick={() => {
                            setMode(entry.mode as Mode);
                            setChosenHook(entry.hook);
                            setScript(entry.script);
                            setPhase('result');
                          }}
                          className="w-full text-left p-3.5 rounded-2xl border border-white/[0.05] bg-white/[0.02] hover:border-white/[0.10] hover:bg-white/[0.04] transition-all duration-200 group"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {modeConf && (
                                  <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                                    style={{ color: modeConf.color, background: `${modeConf.color}18`, border: `1px solid ${modeConf.color}30` }}>
                                    {modeConf.id === 'content' ? 'Instagram' : modeConf.id === 'sales' ? 'Vendas' : 'Micro-copy'}
                                  </span>
                                )}
                                <span className="text-[10px] text-white/20">{relTime}</span>
                              </div>
                              {entry.label && (
                                <p className="text-white/50 text-xs font-medium truncate">{entry.label}</p>
                              )}
                              <p className="text-white/30 text-[11px] mt-0.5 italic truncate">"{entry.hook}"</p>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-white/15 group-hover:text-white/35 flex-shrink-0 mt-1 transition-colors" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── FASE 1: SCOPING — Content (passo a passo) ───────────── */}
            {phase === 'scoping' && mode === 'content' && (
              <motion.div
                key="scoping-content"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="space-y-8"
              >
                {/* Progress */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => contentStep > 1 ? setContentStep(s => (s - 1) as 1 | 2 | 3) : handleReset()}
                    className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="flex-1">
                    <div className="flex gap-1.5">
                      {([1, 2, 3] as const).map(s => (
                        <div
                          key={s}
                          className={cn('h-0.5 flex-1 rounded-full transition-all duration-300', s <= contentStep ? 'bg-violet-400' : 'bg-white/10')}
                        />
                      ))}
                    </div>
                    <p className="text-white/25 text-[11px] mt-1.5">{contentStep} de 3</p>
                  </div>
                </div>

                {trendContext && (
                  <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/25">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-violet-300/70 mb-1">
                      Contexto importado do Sherlock
                    </p>
                    <p className="text-white/75 text-xs leading-relaxed">{trendContext.title}</p>
                    <p className="text-white/40 text-[11px] mt-1">
                      {trendContext.source}
                      {trendContext.url ? (
                        <>
                          {' '}·{' '}
                          <a href={trendContext.url} target="_blank" rel="noopener noreferrer" className="hover:text-white/70 underline underline-offset-2">
                            abrir fonte
                          </a>
                        </>
                      ) : null}
                    </p>
                  </div>
                )}

                <AnimatePresence mode="wait">

                  {/* Passo 1 — Objetivo */}
                  {contentStep === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-6"
                    >
                      <div>
                        <p className="text-white/80 text-lg font-semibold tracking-tight">Qual o objetivo do conteúdo?</p>
                        <p className="text-white/30 text-sm mt-1">Isso define o tom e a estrutura do roteiro.</p>
                      </div>
                      <div className="space-y-2.5">
                        {[
                          { value: '🚀 Viral', desc: 'Máximo alcance — conteúdo para parar o scroll' },
                          { value: '💎 Autoridade', desc: 'Posicionar como especialista no nicho' },
                          { value: '💰 Venda', desc: 'Converter visualização em lead ou compra' },
                        ].map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => { setScopingAnswers(prev => ({ ...prev, objetivo: opt.value })); setContentStep(2); }}
                            className={cn(
                              'w-full text-left flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200',
                              scopingAnswers.objetivo === opt.value
                                ? 'bg-violet-500/15 border-violet-500/50'
                                : 'border-white/[0.06] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                            )}
                          >
                            <span className="text-lg">{opt.value.split(' ')[0]}</span>
                            <div>
                              <p className="text-white/80 text-sm font-medium">{opt.value.split(' ').slice(1).join(' ')}</p>
                              <p className="text-white/30 text-xs mt-0.5">{opt.desc}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-white/20 ml-auto flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Passo 2 — Sherlock Discovery */}
                  {contentStep === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-5"
                    >
                      <div>
                        <p className="text-white/80 text-lg font-semibold tracking-tight">Qual é o seu nicho?</p>
                        <p className="text-white/30 text-sm mt-1">O Sherlock vai buscar vídeos virais e tendências do seu mercado.</p>
                      </div>

                      <textarea
                        rows={2}
                        autoFocus
                        placeholder='Ex: "Sou coach de negócios e vendo mentoria de R$ 5k"'
                        value={discoverNiche}
                        onChange={e => setDiscoverNiche(e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 text-white/80 text-sm placeholder-white/20 focus:outline-none focus:border-cyan-500/30 resize-none transition-colors"
                      />

                      {/* Período */}
                      <div>
                        <p className="text-[10px] text-white/25 uppercase tracking-widest mb-2">Período de análise</p>
                        <div className="grid grid-cols-4 gap-2">
                          {([30, 45, 60, 90] as const).map(d => (
                            <button
                              key={d}
                              onClick={() => setDiscoverPeriod(d)}
                              className={cn(
                                'py-2 rounded-xl text-xs font-semibold border transition-all',
                                discoverPeriod === d
                                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                                  : 'border-white/[0.06] bg-white/[0.02] text-white/35 hover:border-white/15'
                              )}
                            >
                              {d}d
                            </button>
                          ))}
                        </div>
                      </div>

                      {error && <p className="text-red-400/80 text-sm">{error}</p>}

                      {/* Resultado do Discovery */}
                      {discoverResult && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 rounded-2xl bg-cyan-500/[0.03] border border-cyan-500/15 space-y-3"
                        >
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { label: 'Nicho', value: discoverResult.niche },
                              { label: 'Inimigo', value: discoverResult.enemy },
                            ].map(item => (
                              <div key={item.label} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                                <p className="text-[10px] text-white/25 uppercase tracking-widest mb-1">{item.label}</p>
                                <p className="text-white/70 text-xs leading-relaxed">{item.value}</p>
                              </div>
                            ))}
                          </div>
                          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                            <p className="text-[10px] text-white/25 uppercase tracking-widest mb-2">Temas em alta</p>
                            <ul className="space-y-1.5">
                              {discoverResult.themes.slice(0, 4).map((t, i) => (
                                <li key={i} className="text-white/55 text-xs flex items-start gap-2">
                                  <span className="text-cyan-400/50 mt-0.5">•</span>
                                  <span><span className="text-white/70 font-medium">{t.title}</span> — {t.pain}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                            <p className="text-[10px] text-white/25 uppercase tracking-widest mb-1.5">Keywords para Instagram</p>
                            <div className="flex flex-wrap gap-1.5">
                              {discoverResult.keywords.map((kw, i) => (
                                <span key={i} className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300/70 text-[11px]">
                                  {kw}
                                </span>
                              ))}
                            </div>
                          </div>
                          <p className="text-[10px] text-white/20 text-center">
                            ✓ Sherlock vai buscar vídeos reais do Instagram no próximo passo
                          </p>

                          <button
                            onClick={applyDiscoverToScoping}
                            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30 transition-all"
                          >
                            ⚡ Usar esses dados e continuar
                          </button>
                        </motion.div>
                      )}

                      {!discoverResult && (
                        <button
                          onClick={handleDiscover}
                          disabled={discoverLoading || !discoverNiche.trim()}
                          className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-40 flex items-center justify-center gap-2"
                          style={{ background: '#06b6d425', border: '1px solid #06b6d440' }}
                        >
                          {discoverLoading ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Sherlock analisando tendências...
                            </>
                          ) : (
                            <>
                              <Compass className="w-4 h-4" />
                              Descobrir tendências do nicho
                            </>
                          )}
                        </button>
                      )}
                    </motion.div>
                  )}

                  {/* Passo 3 — Vídeos + CTA */}
                  {contentStep === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-5"
                    >
                      {/* Vídeos reais do Instagram */}
                      {(igVideosLoading || igVideos.length > 0) && (
                        <div className="p-3.5 rounded-2xl bg-violet-500/[0.04] border border-violet-500/15 space-y-3">
                          <div className="flex items-center gap-2">
                            <Film className="w-3.5 h-3.5 text-violet-400/70" />
                            <p className="text-[11px] font-bold text-violet-300/60 uppercase tracking-widest">
                              Vídeos reais do Instagram
                            </p>
                            {igVideosLoading && <Loader2 className="w-3 h-3 animate-spin text-violet-400/50 ml-auto" />}
                          </div>
                          {igVideosLoading ? (
                            <p className="text-[11px] text-white/25 text-center py-2">Buscando vídeos do nicho...</p>
                          ) : (
                            <>
                              <p className="text-[10px] text-white/25">Selecione até 3 como referência — Maverick vai espelhar o que viralizou</p>
                              <div className="space-y-1.5">
                                {igVideos.map((v, i) => {
                                  const isSelected = selectedVideos.some(s => s.url === v.url);
                                  const canSelect = isSelected || selectedVideos.length < 3;
                                  return (
                                    <button
                                      key={i}
                                      onClick={() => {
                                        if (isSelected) {
                                          setSelectedVideos(prev => prev.filter(s => s.url !== v.url));
                                        } else if (canSelect) {
                                          setSelectedVideos(prev => [...prev, v]);
                                        }
                                      }}
                                      className={cn(
                                        'w-full text-left p-3 rounded-xl border transition-all duration-150',
                                        isSelected
                                          ? 'bg-violet-500/15 border-violet-500/40'
                                          : canSelect
                                          ? 'border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.03]'
                                          : 'border-white/[0.04] bg-white/[0.01] opacity-40 cursor-not-allowed'
                                      )}
                                    >
                                      <div className="flex items-start gap-2.5">
                                        <div className={cn(
                                          'w-4 h-4 rounded-full border flex-shrink-0 mt-0.5 flex items-center justify-center',
                                          isSelected ? 'bg-violet-500 border-violet-400' : 'border-white/20'
                                        )}>
                                          {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <p className="text-white/70 text-xs font-medium leading-snug line-clamp-1">{v.title}</p>
                                          <p className="text-white/35 text-[11px] mt-0.5 line-clamp-1">{v.content}</p>
                                          {v.views > 0 && (
                                            <p className="text-violet-400/60 text-[10px] mt-1">
                                              {v.views >= 1000000
                                                ? `${(v.views / 1000000).toFixed(1)}M views`
                                                : `${(v.views / 1000).toFixed(0)}K views`}
                                            </p>
                                          )}
                                        </div>
                                        {v.url && (
                                          <a href={v.url} target="_blank" rel="noopener noreferrer"
                                            onClick={e => e.stopPropagation()}
                                            className="flex-shrink-0 text-white/20 hover:text-white/50 transition-colors">
                                            <ExternalLink className="w-3 h-3" />
                                          </a>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                              {selectedVideos.length > 0 && (
                                <p className="text-[10px] text-violet-400/60 text-center">
                                  {selectedVideos.length} vídeo{selectedVideos.length > 1 ? 's' : ''} selecionado{selectedVideos.length > 1 ? 's' : ''} como referência
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      <div>
                        <p className="text-white/80 text-lg font-semibold tracking-tight">O que você quer que quem assistiu faça?</p>
                        <p className="text-white/30 text-sm mt-1">Escolha uma ação ou escreva a sua.</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'Comentar abaixo', emoji: '💬' },
                          { value: 'Me seguir', emoji: '👤' },
                          { value: 'Acessar o link da bio', emoji: '🔗' },
                          { value: 'Salvar esse vídeo', emoji: '🔖' },
                        ].map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setScopingAnswers(prev => ({ ...prev, cta: opt.value }))}
                            className={cn(
                              'flex items-center gap-2.5 p-3.5 rounded-2xl border text-left transition-all duration-150',
                              scopingAnswers.cta === opt.value
                                ? 'bg-violet-500/15 border-violet-500/50 text-white/90'
                                : 'border-white/[0.06] bg-white/[0.02] text-white/50 hover:border-white/15 hover:text-white/70'
                            )}
                          >
                            <span>{opt.emoji}</span>
                            <span className="text-sm font-medium">{opt.value}</span>
                          </button>
                        ))}
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Ou escreva o seu..."
                          value={!['Comentar abaixo', 'Me seguir', 'Acessar o link da bio', 'Salvar esse vídeo'].includes(scopingAnswers.cta ?? '') ? (scopingAnswers.cta ?? '') : ''}
                          onChange={e => setScopingAnswers(prev => ({ ...prev, cta: e.target.value }))}
                          className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 text-white/80 text-sm placeholder-white/20 focus:outline-none focus:border-violet-500/30 transition-colors"
                        />
                      </div>

                      {error && <p className="text-red-400/80 text-sm">{error}</p>}

                      <button
                        onClick={handleScoping}
                        disabled={isLoading}
                        className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-40"
                        style={{ background: '#a855f725', border: '1px solid #a855f740' }}
                      >
                        {isLoading ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
                            Gerando dossiê...
                          </span>
                        ) : (
                          '⚡ Gerar Dossiê Estratégico'
                        )}
                      </button>
                    </motion.div>
                  )}

                </AnimatePresence>
              </motion.div>
            )}

            {/* ── FASE 1: SCOPING — Outros modos (formulário) ─────────────── */}
            {phase === 'scoping' && mode && mode !== 'content' && (
              <motion.div
                key="scoping-other"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-2">
                  <div className={cn('w-1.5 h-1.5 rounded-full', modeConfig?.dot)} />
                  <span className={cn('text-xs font-bold uppercase tracking-widest', modeConfig?.text)}>
                    {modeConfig?.label}
                  </span>
                </div>

                {/* Oracle Button */}
                <button
                  onClick={() => { setOracleOpen(!oracleOpen); setOracleResult(null); }}
                  className={cn(
                    'w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all duration-200 text-left',
                    oracleOpen
                      ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                      : 'bg-white/[0.02] border-white/[0.06] text-white/40 hover:border-cyan-500/30 hover:text-cyan-400 hover:bg-cyan-500/5'
                  )}
                >
                  <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                    <Compass className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">🔮 Perguntar ao Oráculo</p>
                    <p className="text-[11px] text-white/30 mt-0.5">Não sabe o que preencher? O Oráculo pesquisa a internet por você.</p>
                  </div>
                </button>

                {/* Oracle Panel */}
                <AnimatePresence>
                  {oracleOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 rounded-2xl bg-cyan-500/[0.03] border border-cyan-500/15 space-y-4">
                        <div>
                          <label className="block text-cyan-400/70 text-[10px] font-bold uppercase tracking-widest mb-2">
                            Descreva sua ideia bruta
                          </label>
                          <textarea
                            rows={2}
                            placeholder='Ex: "Sou dentista e quero vender clareamento premium"'
                            value={oracleIdea}
                            onChange={e => setOracleIdea(e.target.value)}
                            className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 text-white/80 text-sm placeholder-white/20 focus:outline-none focus:border-cyan-500/30 resize-none transition-colors"
                          />
                        </div>
                        <button
                          onClick={handleOracle}
                          disabled={oracleLoading || !oracleIdea.trim()}
                          className="w-full py-3 rounded-xl text-sm font-semibold bg-cyan-500/15 border border-cyan-500/25 text-cyan-300 hover:bg-cyan-500/25 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                        >
                          {oracleLoading ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Pesquisando Reddit, YouTube, Quora...
                            </>
                          ) : (
                            '🔮 Pesquisar na Internet'
                          )}
                        </button>

                        {oracleResult && (
                          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 pt-2">
                            <p className="text-[10px] font-bold text-cyan-400/50 uppercase tracking-widest">Niche Blueprint</p>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { label: 'Nicho', value: oracleResult.niche },
                                { label: 'Público', value: oracleResult.targetAudience },
                                { label: 'Inimigo', value: oracleResult.enemy },
                                { label: 'Mecanismo', value: oracleResult.mechanism },
                              ].map(item => (
                                <div key={item.label} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">{item.label}</p>
                                  <p className="text-white/80 text-xs leading-relaxed">{item.value}</p>
                                </div>
                              ))}
                            </div>
                            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Dores Reais</p>
                              <ul className="space-y-1">
                                {oracleResult.pains.map((pain, i) => (
                                  <li key={i} className="text-white/60 text-xs flex items-start gap-2">
                                    <span className="text-red-400/60 mt-0.5">•</span>{pain}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            {oracleResult.sources.length > 0 && (
                              <details className="group">
                                <summary className="text-[10px] text-white/25 uppercase tracking-widest cursor-pointer hover:text-white/40 transition-colors flex items-center gap-1">
                                  <ExternalLink className="w-3 h-3" />
                                  {oracleResult.sources.length} fontes da web
                                </summary>
                                <div className="mt-2 space-y-1.5">
                                  {oracleResult.sources.map((s, i) => (
                                    <a key={i} href={s.url} target="_blank" rel="noopener"
                                      className="block p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] text-xs text-white/40 hover:text-white/60 transition-colors truncate">
                                      {s.title || s.url}
                                    </a>
                                  ))}
                                </div>
                              </details>
                            )}
                            <button
                              onClick={applyOracleToScoping}
                              className="w-full py-3 rounded-xl text-sm font-semibold bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30 transition-all"
                            >
                              ⚡ Aceitar e Preencher Campos
                            </button>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-5">
                  {SCOPING_FIELDS[mode].map((field) => (
                    <div key={field.key}>
                      <label className="block text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">
                        {field.label}
                      </label>
                      <textarea
                        rows={2}
                        placeholder={field.placeholder}
                        value={scopingAnswers[field.key] ?? ''}
                        onChange={e => setScopingAnswers(prev => ({ ...prev, [field.key]: e.target.value }))}
                        className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 text-white/80 text-sm placeholder-white/20 focus:outline-none focus:border-white/20 resize-none transition-colors"
                      />
                    </div>
                  ))}
                </div>

                {error && <p className="text-red-400/80 text-sm">{error}</p>}

                <button
                  onClick={handleScoping}
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-40"
                  style={{ background: modeConfig ? `${modeConfig.color}25` : '#8b5cf630', border: `1px solid ${modeConfig?.color ?? '#8b5cf6'}40` }}
                >
                  {isLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
                      Gerando dossiê...
                    </span>
                  ) : (
                    '⚡ Gerar Dossiê Estratégico'
                  )}
                </button>
              </motion.div>
            )}

            {/* ── FASE 2: DOSSIÊ ──────────────────────────────────────────── */}
            {phase === 'dossie' && dossie && (
              <motion.div
                key="dossie"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                {/* Strategy */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                  <p className="text-[11px] font-bold text-white/25 uppercase tracking-widest mb-3">Estratégia</p>
                  <p className="text-white/80 text-sm leading-relaxed">{dossie.strategy}</p>
                </div>

                {/* Hooks */}
                <div>
                  <p className="text-[11px] font-bold text-white/25 uppercase tracking-widest mb-3">
                    ⚡ Ganchos Disponíveis — escolha um para gerar a copy
                  </p>
                  <div className="space-y-2.5">
                    {dossie.hooks.map((hook, i) => (
                      <button
                        key={i}
                        onClick={() => handleGenerate(hook)}
                        className="w-full text-left p-4 rounded-2xl border border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.03] transition-all duration-200 group"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-white/20 text-xs font-mono mt-0.5 flex-shrink-0 group-hover:text-white/40 transition-colors">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <p className="text-white/70 text-sm leading-relaxed group-hover:text-white/90 transition-colors">
                            {hook}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {error && <p className="text-red-400/80 text-sm">{error}</p>}
              </motion.div>
            )}

            {/* ── FASE 3: GERANDO ─────────────────────────────────────────── */}
            {phase === 'generating' && (
              <motion.div
                key="generating"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Chosen hook preview */}
                {chosenHook && (
                  <div className="p-4 rounded-2xl bg-violet-500/5 border border-violet-500/15">
                    <p className="text-[10px] font-bold text-violet-400/60 uppercase tracking-widest mb-2">Gancho selecionado</p>
                    <p className="text-white/60 text-sm">{chosenHook}</p>
                  </div>
                )}

                {/* Streaming output */}
                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] min-h-[200px]">
                  <p className="text-white/70 text-sm leading-7 whitespace-pre-wrap font-mono">
                    {script}
                    <span className="inline-block w-0.5 h-4 bg-violet-400 animate-pulse ml-0.5 align-middle" />
                  </p>
                </div>
              </motion.div>
            )}

            {/* ── FASE 4: RESULT ──────────────────────────────────────────── */}
            {phase === 'result' && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                {/* Gancho chosen */}
                {chosenHook && (
                  <div className="p-3.5 rounded-xl bg-violet-500/5 border border-violet-500/15">
                    <p className="text-[10px] font-bold text-violet-400/60 uppercase tracking-widest mb-1.5">Gancho</p>
                    <p className="text-white/55 text-xs">{chosenHook}</p>
                  </div>
                )}

                {/* Copy result */}
                <div className="relative group">
                  <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] group-hover:border-white/[0.10] transition-colors">
                    <p className="text-white/80 text-sm leading-7 whitespace-pre-wrap">{script}</p>
                  </div>
                  <button
                    onClick={handleCopy}
                    className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-all opacity-0 group-hover:opacity-100"
                    title="Copiar"
                  >
                    {copied
                      ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                      : <Copy className="w-3.5 h-3.5 text-white/40" />
                    }
                  </button>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/60 hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                  <button
                    onClick={() => chosenHook && handleGenerate(chosenHook)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/25 text-violet-300 hover:text-violet-200 transition-all flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Gerar variação
                  </button>
                  <button
                    onClick={() => { setPhase('dossie'); setScript(''); }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/60 hover:text-white transition-all"
                  >
                    Outro gancho
                  </button>
                  <button
                    onClick={handleReset}
                    className="py-2.5 px-4 rounded-xl text-sm font-medium bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 text-violet-400 hover:text-violet-300 transition-all flex items-center gap-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Nova
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
