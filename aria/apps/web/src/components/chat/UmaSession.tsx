'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Send, Loader2, CheckCircle2, RefreshCw, Layers, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface Slide {
  type: 'cover' | 'content' | 'cta';
  title: string;
  body: string;
}

interface Carousel {
  title: string;
  theme: 'dark' | 'light';
  slides: Slide[];
}

interface QueueItem {
  id: string;
  createdAt: string;
  description: string;
  carousel: Carousel;
}

type Phase = 'landing' | 'generating' | 'result';

const SLIDE_TYPE_LABEL: Record<Slide['type'], string> = {
  cover: 'Capa',
  content: 'Conteúdo',
  cta: 'CTA',
};

const SLIDE_TYPE_COLOR: Record<Slide['type'], string> = {
  cover: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  content: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  cta: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
};

function SlideCard({ slide, index }: { slide: Slide; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-bold text-white/25">#{index + 1}</span>
        <span className={cn(
          'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border',
          SLIDE_TYPE_COLOR[slide.type]
        )}>
          {SLIDE_TYPE_LABEL[slide.type]}
        </span>
      </div>
      {slide.title && (
        <p className="text-[13px] font-semibold text-white leading-snug mb-1">{slide.title}</p>
      )}
      {slide.body && (
        <p className="text-[12px] text-white/50 leading-relaxed">{slide.body}</p>
      )}
    </motion.div>
  );
}

export default function UmaSession() {
  const [phase, setPhase] = useState<Phase>('landing');
  const [description, setDescription] = useState('');
  const [audience, setAudience] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<QueueItem | null>(null);
  const [sentToFigma, setSentToFigma] = useState(false);

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setError('');
    setPhase('generating');

    try {
      const res = await fetch(`${API_BASE}/api/uma/carousel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          style: theme === 'dark'
            ? 'dark — fundo escuro #0d0d0d, texto branco, accent vermelho'
            : 'light — fundo claro #FAFAFA, texto escuro, accent vermelho',
          audience: audience.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? 'Erro desconhecido');

      setResult(data.item as QueueItem);
      setPhase('result');
      setSentToFigma(false);
    } catch (err: any) {
      setError(err.message ?? 'Falha na geração');
      setPhase('landing');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPhase('landing');
    setDescription('');
    setAudience('');
    setResult(null);
    setSentToFigma(false);
    setError('');
  };

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
          <Palette className="w-5 h-5 text-rose-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Uma</h1>
          <p className="text-[11px] text-white/35">Designer de Carrosséis</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ── Landing ─────────────────────────────────────────── */}
        {phase === 'landing' && (
          <motion.div
            key="landing"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col gap-5"
          >
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
              <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-4">
                Sobre o carrossel
              </p>

              {/* Descrição */}
              <div className="mb-4">
                <label className="text-[11px] text-white/40 mb-1.5 block">Descreva o tema ou ideia *</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate();
                  }}
                  placeholder="Ex: 5 erros que impedem nutricionistas de vender online"
                  rows={3}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-[13px] text-white placeholder-white/25 resize-none focus:outline-none focus:border-rose-500/40 transition-colors"
                />
              </div>

              {/* Público */}
              <div className="mb-4">
                <label className="text-[11px] text-white/40 mb-1.5 block">Público-alvo (opcional)</label>
                <input
                  value={audience}
                  onChange={e => setAudience(e.target.value)}
                  placeholder="Ex: empreendedoras iniciantes, homens 25-35 interessados em finanças..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-[13px] text-white placeholder-white/25 focus:outline-none focus:border-rose-500/40 transition-colors"
                />
              </div>

              {/* Tema visual */}
              <div>
                <label className="text-[11px] text-white/40 mb-2 block">Tema visual</label>
                <div className="flex gap-2">
                  {(['dark', 'light'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-[12px] font-medium border transition-all',
                        theme === t
                          ? 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                          : 'bg-white/[0.03] border-white/[0.08] text-white/40 hover:text-white/60'
                      )}
                    >
                      {t === 'dark' ? '🌑 Dark' : '☀️ Light'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <p className="text-[12px] text-red-400 px-1">{error}</p>
            )}

            <button
              onClick={handleGenerate}
              disabled={!description.trim()}
              className={cn(
                'flex items-center justify-center gap-2 w-full py-3 rounded-xl text-[13px] font-semibold transition-all',
                description.trim()
                  ? 'bg-rose-500 hover:bg-rose-600 text-white'
                  : 'bg-white/[0.04] text-white/25 cursor-not-allowed'
              )}
            >
              <Send className="w-4 h-4" />
              Criar Carrossel
            </button>
          </motion.div>
        )}

        {/* ── Generating ──────────────────────────────────────── */}
        {phase === 'generating' && (
          <motion.div
            key="generating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-4 py-20"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-rose-400 animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-[14px] font-medium text-white">Criando seu carrossel...</p>
              <p className="text-[12px] text-white/35 mt-1">Uma está organizando os slides</p>
            </div>
          </motion.div>
        )}

        {/* ── Result ──────────────────────────────────────────── */}
        {phase === 'result' && result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-4"
          >
            {/* Cabeçalho do resultado */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-[13px] font-semibold text-white">{result.carousel.title}</span>
                </div>
                <p className="text-[11px] text-white/35">
                  {result.carousel.slides.length} slides • tema {result.carousel.theme}
                </p>
              </div>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-[11px] text-white/35 hover:text-white/60 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Novo
              </button>
            </div>

            {/* Slides */}
            <div className="flex flex-col gap-2">
              {result.carousel.slides.map((slide, i) => (
                <SlideCard key={i} slide={slide} index={i} />
              ))}
            </div>

            {/* Ações */}
            <div className="flex flex-col gap-2 mt-2">
              {sentToFigma ? (
                <div className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[13px] font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Na fila do Figma! Abra o plugin para aplicar.
                </div>
              ) : (
                <button
                  onClick={() => setSentToFigma(true)}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[13px] font-semibold transition-all"
                >
                  <Layers className="w-4 h-4" />
                  Enviar para Figma
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                </button>
              )}

              <button
                onClick={handleReset}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] text-white/50 hover:text-white/70 text-[12px] transition-all"
              >
                Criar outro carrossel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
