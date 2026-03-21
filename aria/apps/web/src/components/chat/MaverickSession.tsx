'use client';

import { useState, useRef, useCallback } from 'react';
import {
  ArrowLeft, Loader2, Zap, Copy, Check, ChevronRight,
  Sparkles, RefreshCw, FileText, Film, LayoutGrid,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ContentPillar {
  name: string;
  topics: string[];
}

interface IdeaCard {
  id: string;
  angle: string;
  hook: string;
}

type Phase = 'onboarding' | 'ideator' | 'generating' | 'result';
type Format = 'reels' | 'carousel' | 'sales_page';

interface MaverickSessionProps {
  onClose: () => void;
}

// ── Mapa de Formatos ──────────────────────────────────────────────────────────

const FORMATS: { id: Format; label: string; description: string; icon: typeof Film }[] = [
  { id: 'reels', label: 'Reels', description: '60–90 segundos de roteiro narrado', icon: Film },
  { id: 'carousel', label: 'Carrossel', description: 'Slides curtos com gancho e CTA', icon: LayoutGrid },
  { id: 'sales_page', label: 'Página de Vendas', description: 'Copy long-form com múltiplos CTAs', icon: FileText },
];

// ── Componente Principal ──────────────────────────────────────────────────────

export function MaverickSession({ onClose }: MaverickSessionProps) {
  const [phase, setPhase] = useState<Phase>('onboarding');

  // Onboarding state
  const [niche, setNiche] = useState('');
  const [audience, setAudience] = useState('');
  const [pillars, setPillars] = useState<ContentPillar[]>([]);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [loadingPyramid, setLoadingPyramid] = useState(false);

  // Ideator state
  const [cards, setCards] = useState<IdeaCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<IdeaCard | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<Format>('reels');
  const [loadingCards, setLoadingCards] = useState(false);

  // Gerador state
  const [script, setScript] = useState('');
  const [copied, setCopied] = useState(false);

  const generationRef = useRef<boolean>(false);

  // ── Step 1: Gerar Pirâmide de Conteúdo ────────────────────────────────────

  const handleOnboarding = useCallback(async () => {
    if (!niche.trim() || !audience.trim() || loadingPyramid) return;
    setLoadingPyramid(true);
    setPillars([]);
    setSelectedTopic('');

    try {
      const res = await fetch(`${API_URL}/api/maverick/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, targetAudience: audience }),
      });
      const data = await res.json();
      if (data.pyramid?.pillars) setPillars(data.pyramid.pillars);
    } catch {
      console.error('[Maverick] Onboarding failed');
    } finally {
      setLoadingPyramid(false);
    }
  }, [niche, audience, loadingPyramid]);

  // ── Step 2: Gerar Cards de Ângulo ─────────────────────────────────────────

  const handleIdeate = useCallback(async (topic: string) => {
    if (!topic.trim() || loadingCards) return;
    setSelectedTopic(topic);
    setCards([]);
    setSelectedCard(null);
    setLoadingCards(true);
    setPhase('ideator');

    try {
      const res = await fetch(`${API_URL}/api/maverick/ideator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, targetAudience: audience, topic }),
      });
      const data = await res.json();
      if (data.cards) setCards(data.cards);
    } catch {
      console.error('[Maverick] Ideator failed');
    } finally {
      setLoadingCards(false);
    }
  }, [niche, audience, loadingCards]);

  // ── Step 3: Gerar Script via Streaming ───────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!selectedCard || generationRef.current) return;

    setScript('');
    setPhase('generating');
    generationRef.current = true;

    try {
      const res = await fetch(`${API_URL}/api/maverick/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche,
          targetAudience: audience,
          angle: selectedCard.angle,
          hook: selectedCard.hook,
          format: selectedFormat,
        }),
      });

      if (!res.ok || !res.body) throw new Error('Stream falhou');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      setPhase('result');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (trimmed.startsWith('data: ')) {
            try {
              const payload = JSON.parse(trimmed.slice(6));
              if (payload.chunk) {
                setScript(prev => prev + payload.chunk);
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (err) {
      console.error('[Maverick] Generate failed:', err);
      setPhase('ideator');
    } finally {
      generationRef.current = false;
    }
  }, [selectedCard, selectedFormat, niche, audience]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [script]);

  // ── Renderização ──────────────────────────────────────────────────────────

  return (
    <div className="relative flex flex-col h-full bg-background text-white overflow-hidden font-sans antialiased">

      {/* Header */}
      <div className="relative z-20 flex items-center gap-3 px-6 py-4 border-b border-white/5 bg-background/80 backdrop-blur-3xl shrink-0">
        <button
          onClick={onClose}
          className="p-2.5 rounded-2xl hover:bg-white/10 transition-all text-white/50 hover:text-white group"
        >
          <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" />
        </button>

        <div className="flex items-center gap-3.5 flex-1 min-w-0">
          <div className="w-11 h-11 rounded-[1.2rem] bg-[#161618] border border-violet-500/30 flex items-center justify-center shrink-0 shadow-sm">
            <Zap className="w-5 h-5 text-violet-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[17px] font-semibold tracking-tight text-white/95">Maverick</p>
            <p className="text-[10px] text-violet-400/60 font-bold tracking-widest uppercase">
              Copywriter A-List
            </p>
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-1.5 shrink-0">
          {(['onboarding', 'ideator', 'result'] as const).map((p, i) => (
            <div
              key={p}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                phase === p || (phase === 'generating' && p === 'result')
                  ? 'w-6 bg-violet-400'
                  : (phase === 'result' && i < 2) || (phase === 'ideator' && i === 0)
                    ? 'w-1.5 bg-violet-400/40'
                    : 'w-1.5 bg-white/10'
              }`}
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">

        {/* ── FASE 1: ONBOARDING ────────────────────────────────────────── */}
        {phase === 'onboarding' && (
          <motion.div
            key="onboarding"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 overflow-y-auto px-6 py-8 flex flex-col gap-8 max-w-2xl mx-auto w-full"
          >
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-violet-400" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Configure seu Maverick</h2>
              <p className="text-white/40 text-sm">
                Diga o seu nicho e público. O Maverick gera os temas automáticamente.
              </p>
            </div>

            {/* Campos */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">
                  Seu Nicho
                </label>
                <input
                  type="text"
                  value={niche}
                  onChange={e => setNiche(e.target.value)}
                  placeholder="Ex: Marketing Digital para Pequenos Negócios"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-5 py-4 text-[15px] text-white placeholder-white/20 outline-none focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/10 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">
                  Público-Alvo
                </label>
                <input
                  type="text"
                  value={audience}
                  onChange={e => setAudience(e.target.value)}
                  placeholder="Ex: Donos de agências com equipes de até 10 pessoas"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-5 py-4 text-[15px] text-white placeholder-white/20 outline-none focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/10 transition-all"
                />
              </div>

              <button
                onClick={handleOnboarding}
                disabled={!niche.trim() || !audience.trim() || loadingPyramid}
                className="w-full py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-30 transition-all font-semibold text-[15px] flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20 active:scale-[0.99]"
              >
                {loadingPyramid ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                {loadingPyramid ? 'Gerando Pirâmide...' : 'Gerar Temas de Conteúdo'}
              </button>
            </div>

            {/* Pirâmide de Conteúdo */}
            <AnimatePresence>
              {pillars.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-white/40 uppercase tracking-widest">
                      Escolha um tema
                    </p>
                    <button
                      onClick={handleOnboarding}
                      className="text-xs text-violet-400/60 hover:text-violet-400 flex items-center gap-1 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" /> Regenerar
                    </button>
                  </div>
                  {pillars.map((pillar, pi) => (
                    <div key={pi} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
                      <p className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-3">
                        {pillar.name}
                      </p>
                      <div className="space-y-2">
                        {pillar.topics.map((topic, ti) => (
                          <button
                            key={ti}
                            onClick={() => handleIdeate(topic)}
                            className="w-full text-left px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[14px] text-white/60 hover:bg-violet-500/10 hover:border-violet-500/30 hover:text-white transition-all flex items-center justify-between group"
                          >
                            <span>{topic}</span>
                            <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 text-violet-400 transition-all group-hover:translate-x-0.5" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── FASE 2: IDEATOR ────────────────────────────────────────────── */}
        {phase === 'ideator' && (
          <motion.div
            key="ideator"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 overflow-y-auto px-6 py-8 flex flex-col gap-6 max-w-2xl mx-auto w-full"
          >
            {/* Breadcrumb */}
            <button
              onClick={() => setPhase('onboarding')}
              className="flex items-center gap-2 text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Mudar tema
            </button>

            <div>
              <p className="text-xs font-bold text-violet-400/60 uppercase tracking-widest mb-1">
                Ângulos para
              </p>
              <h2 className="text-xl font-bold tracking-tight">{selectedTopic}</h2>
            </div>

            {/* Cards de ângulo */}
            {loadingCards ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
                <p className="text-sm text-white/30">O Ideator está procurando ângulos matadores...</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-white/30">
                  Escolha um ângulo para criar a copy
                </p>
                {cards.map(card => (
                  <button
                    key={card.id}
                    onClick={() => setSelectedCard(prev => prev?.id === card.id ? null : card)}
                    className={`w-full text-left rounded-2xl border transition-all p-5 group ${
                      selectedCard?.id === card.id
                        ? 'bg-violet-500/10 border-violet-500/40 shadow-md shadow-violet-500/10'
                        : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/10'
                    }`}
                  >
                    <p className={`text-[15px] font-semibold mb-2 transition-colors ${
                      selectedCard?.id === card.id ? 'text-violet-200' : 'text-white/90'
                    }`}>
                      {card.angle}
                    </p>
                    <p className="text-[13px] text-white/40 leading-relaxed italic">
                      &ldquo;{card.hook}&rdquo;
                    </p>
                  </button>
                ))}
              </div>
            )}

            {/* Formato + Geração */}
            <AnimatePresence>
              {selectedCard && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <p className="text-xs font-bold text-white/40 uppercase tracking-widest">
                    Formato de saída
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {FORMATS.map(fmt => (
                      <button
                        key={fmt.id}
                        onClick={() => setSelectedFormat(fmt.id)}
                        className={`p-4 rounded-2xl border text-left transition-all ${
                          selectedFormat === fmt.id
                            ? 'bg-violet-500/10 border-violet-500/40'
                            : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                        }`}
                      >
                        <fmt.icon className={`w-5 h-5 mb-2 ${selectedFormat === fmt.id ? 'text-violet-400' : 'text-white/30'}`} />
                        <p className={`text-[13px] font-semibold ${selectedFormat === fmt.id ? 'text-white' : 'text-white/50'}`}>
                          {fmt.label}
                        </p>
                        <p className="text-[11px] text-white/25 mt-0.5 leading-tight">{fmt.description}</p>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleGenerate}
                    className="w-full py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 transition-all font-semibold text-[15px] flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20 active:scale-[0.99]"
                  >
                    <Zap className="w-5 h-5" />
                    Gerar Roteiro
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── FASE 3: GERANDO (Animação de Carregamento) ────────────────── */}
        {phase === 'generating' && (
          <motion.div
            key="generating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-center justify-center gap-6 px-6"
          >
            <div className="relative">
              <div className="w-20 h-20 rounded-3xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Zap className="w-10 h-10 text-violet-400" />
              </div>
              <div className="absolute inset-0 rounded-3xl animate-ping bg-violet-500/10" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold tracking-tight">Forjando sua copy...</p>
              <p className="text-sm text-white/30">O Maverick está lendo os Swipe Files e construindo o roteiro.</p>
            </div>
            <div className="flex gap-1.5">
              {[0, 0.15, 0.3].map((delay, i) => (
                <span
                  key={i}
                  className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${delay}s` }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── FASE 4: RESULTADO ─────────────────────────────────────────── */}
        {phase === 'result' && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col min-h-0"
          >
            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-white/5">
              <div>
                <p className="text-xs font-bold text-violet-400/60 uppercase tracking-widest">
                  {FORMATS.find(f => f.id === selectedFormat)?.label}
                </p>
                <p className="text-sm font-semibold text-white/80 truncate max-w-xs">
                  {selectedCard?.angle}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setPhase('ideator'); setScript(''); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white/50 hover:text-white hover:bg-white/[0.08] transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refazer
                </button>
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    copied
                      ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                      : 'bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-500/20'
                  }`}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>

            {/* Script com streaming */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="max-w-2xl mx-auto">
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 text-[15px] leading-[1.8] text-white/85 whitespace-pre-wrap font-mono">
                  {script}
                  {generationRef.current && (
                    <span className="inline-block w-0.5 h-5 bg-violet-400 animate-pulse ml-0.5 align-middle" />
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
