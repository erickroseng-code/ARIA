'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Send, CheckCircle, XCircle, Loader2,
  Users, UserCheck, ImageIcon, TrendingUp, AlertTriangle,
  Star, ThumbsDown, Lightbulb, Quote, ChevronRight,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ── Tipos ────────────────────────────────────────────────────────────────────

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
  };
}

type Phase = 'asking' | 'running-plan' | 'report' | 'running-scripts' | 'done' | 'error';

interface MaverickSessionProps {
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function* streamSse(
  endpoint: string,
  body: Record<string, string>,
): AsyncGenerator<{ type: string; [k: string]: unknown }> {
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

// ── Componente Principal ──────────────────────────────────────────────────────

export function MaverickSession({ onClose }: MaverickSessionProps) {
  const [phase, setPhase] = useState<Phase>('asking');
  const [username, setUsername] = useState('');
  const [steps, setSteps] = useState<string[]>([]);
  const [report, setReport] = useState<MaverickReport | null>(null);
  const [rawPlan, setRawPlan] = useState('');
  const [scripts, setScripts] = useState('');
  const [streamingScripts, setStreamingScripts] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<boolean>(false);

  useEffect(() => {
    if (phase === 'asking') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [phase]);

  const addStep = useCallback((msg: string) => {
    setSteps(prev => [...prev, msg]);
  }, []);

  const handleAnalyze = useCallback(async () => {
    const clean = username.trim().replace(/^@/, '');
    if (!clean) return;

    setPhase('running-plan');
    setSteps([]);
    setReport(null);
    setRawPlan('');
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
            } catch {
              // LLM retornou texto não-JSON: mostrar como texto
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
  }, [username, addStep]);

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
    setPhase('asking');
    setUsername('');
    setSteps([]);
    setReport(null);
    setRawPlan('');
    setScripts('');
    setStreamingScripts('');
    setErrorMsg('');
  }, []);

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
        {(phase === 'report' || phase === 'running-scripts' || phase === 'done') && (
          <span className="text-[11px] text-white/30 uppercase tracking-wider font-medium">
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
            <div className="flex flex-col gap-6 pt-8">
              {/* Headline */}
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-white">Análise de Perfil</h2>
                <p className="text-white/50 text-sm max-w-md mx-auto leading-relaxed">
                  Scout analisa o perfil, Scholar consulta a base de conhecimento, Strategist gera o diagnóstico.
                </p>
              </div>

              {/* Fluxo visual */}
              <div className="flex items-center justify-center gap-3 text-xs text-white/40">
                {['🧭 Scout', '📚 Scholar', '🧠 Strategist', '✍️ Copywriter'].map((step, i, arr) => (
                  <span key={step} className="flex items-center gap-2">
                    <span>{step}</span>
                    {i < arr.length - 1 && <ChevronRight className="w-3 h-3" />}
                  </span>
                ))}
              </div>

              {/* Input */}
              <div className="max-w-md mx-auto w-full">
                <label className="block text-sm text-white/60 mb-2 text-center">
                  Perfil público do Instagram para analisar
                </label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-sm font-medium">@</span>
                    <input
                      ref={inputRef}
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="username"
                      className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl pl-9 pr-4 py-3.5 text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-white/25 focus:bg-white/[0.07] transition-all"
                    />
                  </div>
                  <button
                    onClick={handleAnalyze}
                    disabled={!username.trim()}
                    className="px-5 py-3.5 bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl text-white text-sm font-medium flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <Send className="w-4 h-4" />
                    Analisar
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
