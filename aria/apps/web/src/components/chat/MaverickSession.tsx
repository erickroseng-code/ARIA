'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, DollarSign, Type, ChevronRight, Copy, Check, RotateCcw } from 'lucide-react';
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

// ─── Mode Config ──────────────────────────────────────────────────────────────

const MODES = [
  {
    id: 'content' as const,
    icon: Zap,
    label: 'Criador de Conteúdo',
    sub: 'Reels · Carrossel',
    color: '#a855f7',
    border: 'border-violet-500/30 hover:border-violet-500/60',
    bg: 'bg-violet-500/5 hover:bg-violet-500/10',
    text: 'text-violet-400',
    dot: 'bg-violet-400',
  },
  {
    id: 'sales' as const,
    icon: DollarSign,
    label: 'Página de Vendas',
    sub: 'Sales Copy · VSL',
    color: '#22c55e',
    border: 'border-emerald-500/30 hover:border-emerald-500/60',
    bg: 'bg-emerald-500/5 hover:bg-emerald-500/10',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
  },
  {
    id: 'microcopy' as const,
    icon: Type,
    label: 'Micro-Copy',
    sub: 'Headlines · CTAs · Legendas',
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
  const abortRef = useRef<AbortController | null>(null);

  const modeConfig = MODES.find(m => m.id === mode);

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
        body: JSON.stringify({ mode, scopingAnswers }),
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
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
                    Maverick V2 online.
                  </p>
                  <p className="text-white/35 text-sm mt-1">
                    Selecione o campo de batalha abaixo para começar.
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
              </motion.div>
            )}

            {/* ── FASE 1: SCOPING ─────────────────────────────────────────── */}
            {phase === 'scoping' && mode && (
              <motion.div
                key="scoping"
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

                <div className="space-y-5">
                  {SCOPING_FIELDS[mode].map((field) => (
                    <div key={field.key}>
                      <label className="block text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">
                        {field.label}
                      </label>

                      {field.type === 'radio' && field.options ? (
                        <div className="flex gap-2 flex-wrap">
                          {field.options.map(opt => (
                            <button
                              key={opt}
                              onClick={() => setScopingAnswers(prev => ({ ...prev, [field.key]: opt }))}
                              className={cn(
                                'px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 border',
                                scopingAnswers[field.key] === opt
                                  ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                                  : 'border-white/[0.07] text-white/40 hover:border-white/20 hover:text-white/70'
                              )}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <textarea
                          rows={2}
                          placeholder={field.placeholder}
                          value={scopingAnswers[field.key] ?? ''}
                          onChange={e => setScopingAnswers(prev => ({ ...prev, [field.key]: e.target.value }))}
                          className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 text-white/80 text-sm placeholder-white/20 focus:outline-none focus:border-white/20 resize-none transition-colors"
                        />
                      )}
                    </div>
                  ))}
                </div>

                {error && (
                  <p className="text-red-400/80 text-sm">{error}</p>
                )}

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
                    onClick={() => { setPhase('dossie'); setScript(''); }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/60 hover:text-white transition-all"
                  >
                    Tentar outro gancho
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
