'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Send, Loader2, ExternalLink, Download,
  AlertTriangle, TrendingDown, TrendingUp, DollarSign,
  PieChart, FileText, Bell, CheckCircle, X,
} from 'lucide-react';
import { useAriaSpeech } from '@/hooks/useAriaSpeech';

import { motion, AnimatePresence } from 'framer-motion';
import { StructuredOnboarding } from '@/components/chat/StructuredOnboarding';
import { format, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ── Tipos ────────────────────────────────────────────────────────────────────

interface BudgetAlert {
  category: string;
  percentage: number;
  level: 'warning' | 'critical';
  message: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  alerts?: BudgetAlert[];
  timestamp: Date;
}

type Phase = 'home' | 'onboarding' | 'chat';

interface FinanceSessionProps {
  onClose: () => void;
}

// ── Componente de alerta ──────────────────────────────────────────────────────

function AlertBadge({ alerts }: { alerts: BudgetAlert[] }) {
  const [open, setOpen] = useState(false);
  if (alerts.length === 0) return null;
  const hasCritical = alerts.some(a => a.level === 'critical');

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${hasCritical
          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
          : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
          }`}
      >
        <Bell className="w-3 h-3" />
        {alerts.length}
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 w-72 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-white/70">Alertas de Orçamento</span>
            <button onClick={() => setOpen(false)}><X className="w-3 h-3 text-white/40" /></button>
          </div>
          {alerts.map((a, i) => (
            <div
              key={i}
              className={`text-xs p-2 rounded-lg ${a.level === 'critical' ? 'bg-red-500/10 border border-red-500/20' : 'bg-yellow-500/10 border border-yellow-500/20'
                }`}
            >
              <div className="flex items-center gap-1 mb-0.5">
                <AlertTriangle className={`w-3 h-3 ${a.level === 'critical' ? 'text-red-400' : 'text-yellow-400'}`} />
                <span className="font-medium text-white/90">{a.category}</span>
                <span className={`ml-auto font-bold ${a.level === 'critical' ? 'text-red-400' : 'text-yellow-400'}`}>{a.percentage}%</span>
              </div>
              <p className="text-white/60">{a.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Bolha de mensagem ─────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isAssistant = msg.role === 'assistant';
  return (
    <div className={`flex ${isAssistant ? 'justify-start' : 'justify-end'} mb-3`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${isAssistant
          ? 'bg-white/5 border border-white/10 text-white/90'
          : 'bg-emerald-600/80 text-white'
          }`}
      >
        {msg.content}
        {isAssistant && msg.alerts && msg.alerts.length > 0 && (
          <div className="mt-2 space-y-1">
            {msg.alerts.map((a, i) => (
              <div
                key={i}
                className={`text-xs p-1.5 rounded-lg ${a.level === 'critical' ? 'bg-red-500/15 text-red-300' : 'bg-yellow-500/15 text-yellow-300'
                  }`}
              >
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                {a.message}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Chips de atalho ───────────────────────────────────────────────────────────

const QUICK_CHIPS = [
  { label: 'Registrar gasto', icon: TrendingDown, prompt: 'Quero registrar um gasto' },
  { label: 'Ver saldo do mês', icon: DollarSign, prompt: 'Qual é meu saldo deste mês?' },
  { label: 'Ver orçamento', icon: PieChart, prompt: 'Como está meu orçamento?' },
  { label: 'Gerar relatório', icon: FileText, prompt: 'Gerar relatório do mês' },
];

// ── Filtro de Mês (Navegação Horizontal) ──────────────────────────────────────

function MonthSelector({
  currentDate,
  onMonthChange
}: {
  currentDate: Date;
  onMonthChange: (d: Date) => void;
}) {
  const months = Array.from({ length: 5 }, (_, i) => {
    // Current month is in the middle (index 2)
    const diff = i - 2;
    return diff < 0 ? subMonths(currentDate, Math.abs(diff)) : diff > 0 ? addMonths(currentDate, diff) : currentDate;
  });

  return (
    <div className="w-full bg-background/95 border-b border-white/[0.03] px-6 py-2 overflow-x-auto scrollbar-hide flex items-center gap-2.5 z-10 relative shadow-sm">
      <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest mr-2 shrink-0">
        Competência
      </span>
      {months.map((date, idx) => {
        const isCurrent = idx === 2; // Middle is always the selected month
        const label = format(date, 'MMM/yy', { locale: ptBR }).replace('.', '');

        return (
          <button
            key={date.toISOString()}
            onClick={() => onMonthChange(date)}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all shrink-0 capitalize focus:outline-none ${isCurrent
              ? 'bg-white text-black shadow-md scale-105'
              : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function FinanceSession({ onClose }: FinanceSessionProps) {
  const [phase, setPhase] = useState<Phase>('home');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState<BudgetAlert[]>([]);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(null);
  const [statusChecked, setStatusChecked] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { speak } = useAriaSpeech();

  // Rolar para o final ao receber novas mensagens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Checar status ao montar
  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/finance/status`);
      const data = await res.json();
      setStatusChecked(true);

      if (data.spreadsheetUrl) setSpreadsheetUrl(data.spreadsheetUrl);
      if (data.alerts) setActiveAlerts(data.alerts);

      if (!data.onboardingCompleted) {
        setPhase('onboarding');
      } else {
        setPhase('chat');
      }
    } catch {
      setStatusChecked(true);
      setPhase('onboarding');
    }
  }, []);

  // Submeter onboarding estruturado
  const submitStructuredOnboarding = useCallback(async (formData: Record<string, unknown>) => {
    setOnboardingLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/finance/onboarding/structured`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.spreadsheetUrl) setSpreadsheetUrl(data.spreadsheetUrl);
      if (data.alerts) setActiveAlerts(data.alerts);

      // Adicionar mensagem de diagnóstico ao chat
      setMessages([{
        role: 'assistant',
        content: data.reply ?? 'Diagnóstico concluído! Agora você pode me perguntar sobre seus gastos.',
        timestamp: new Date(),
      }]);
      setPhase('chat');
    } catch {
      setMessages([{
        role: 'assistant',
        content: 'Erro ao processar o diagnóstico. Tente novamente.',
        timestamp: new Date(),
      }]);
      setPhase('chat');
    } finally {
      setOnboardingLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (text?: string) => {
    const messageText = (text ?? input).trim();
    if (!messageText || loading) return;

    setInput('');
    setLoading(true);

    const userMsg: ChatMessage = {
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await fetch(`${API_URL}/api/finance/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText }),
      });

      const data = await res.json();

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.reply ?? 'Desculpe, não consegui processar sua mensagem.',
        alerts: data.alerts ?? [],
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Atualizar alertas ativos
      if (data.alerts?.length > 0) {
        setActiveAlerts(prev => {
          const updated = [...prev];
          for (const alert of data.alerts) {
            if (!updated.find(a => a.category === alert.category)) {
              updated.push(alert);
            }
          }
          return updated;
        });
      }

      // Atualizar URL da planilha
      if (data.spreadsheetUrl) setSpreadsheetUrl(data.spreadsheetUrl);

      // Verificar se onboarding foi concluído
      if (data.action === 'onboarding_complete') {
        setPhase('chat');
      }

      // Falar resposta via TTS
      if (data.reply) {
        speak(data.reply.slice(0, 300));
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Erro ao conectar com o servidor. Tente novamente.',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, speak]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const downloadPdf = async () => {
    try {
      const res = await fetch(`${API_URL}/api/finance/report/pdf`);
      if (!res.ok) throw new Error('Falha ao gerar PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const month = new Date().toISOString().slice(0, 7);
      a.href = url;
      a.download = `relatorio-financeiro-${month}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Erro ao gerar o PDF. Verifique se há dados suficientes no mês.');
    }
  };

  // ── Tela Home ───────────────────────────────────────────────────────────────
  if (!statusChecked) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full bg-background text-white overflow-hidden font-sans antialiased">

      <div className="relative z-20 flex items-center gap-3 px-6 py-4 border-b border-white/5 bg-background/80 backdrop-blur-3xl shrink-0">
        <button
          onClick={onClose}
          className="p-2.5 rounded-2xl hover:bg-white/10 transition-all text-white/50 hover:text-white group"
        >
          <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" />
        </button>

        <div className="flex items-center gap-3.5 flex-1 min-w-0">
          <div className="w-11 h-11 rounded-[1.2rem] bg-[#161618] border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-sm">
            <DollarSign className="w-5.5 h-5.5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[17px] font-semibold tracking-tight text-white/95">Graham</p>
            <p className="text-[10px] text-emerald-400/60 font-bold tracking-widest uppercase">
              Gestão Financeira
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <AlertBadge alerts={activeAlerts} />

          {phase === 'chat' && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={downloadPdf}
                title="Relatório PDF"
                className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white/60 hover:text-white"
              >
                <Download className="w-4 h-4" />
              </button>

              {spreadsheetUrl && (
                <a
                  href={spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all text-emerald-400"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Filtro de Mês ── */}
      {(phase === 'chat' || phase === 'home') && (
        <MonthSelector
          currentDate={selectedMonth}
          onMonthChange={setSelectedMonth}
        />
      )}

      <div className="relative flex-1 flex flex-col min-h-0 z-10">
        <AnimatePresence mode="wait">
          {/* ONBOARDING: Wizard Estruturado */}
          {phase === 'onboarding' ? (
            <motion.div
              key="onboarding"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex flex-col min-h-0 overflow-y-auto"
            >
              <StructuredOnboarding
                onComplete={(data) => submitStructuredOnboarding(data as unknown as Record<string, unknown>)}
                loading={onboardingLoading}
              />
            </motion.div>
          ) : (
            /* CHAT: Layout de Conversa Apple Refined */
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 flex flex-col min-h-0"
            >
              {/* Área de Mensagens */}
              <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 scroll-smooth scrollbar-thin scrollbar-thumb-white/5 pb-32">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-8 text-center py-16">
                    <div className="relative w-24 h-24 rounded-[2.5rem] bg-[#161618] border border-emerald-500/30 flex items-center justify-center shadow-sm group">
                      <DollarSign className="w-12 h-12 text-emerald-400 group-hover:scale-110 transition-transform duration-500" />
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-2xl font-bold text-white tracking-tight">Como posso guiar seu capital?</h3>
                      <p className="text-white/30 text-[16px] max-w-sm mx-auto font-medium">O Graham está pronto para registrar seus gastos, analisar saldos ou gerar relatórios inteligentes.</p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-3.5 mt-4">
                      {QUICK_CHIPS.map(chip => (
                        <button
                          key={chip.label}
                          onClick={() => sendMessage(chip.prompt)}
                          className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-[14px] font-semibold text-white/70 hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:text-white transition-all duration-500 backdrop-blur-3xl shadow-lg ring-1 ring-white/5"
                        >
                          <chip.icon className="w-4 h-4 text-emerald-400" />
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                    <div
                      className={`max-w-[82%] rounded-[1.8rem] px-6 py-5 text-[16px] leading-[1.5] relative tracking-[-0.01em] ${msg.role === 'assistant'
                        ? 'bg-white/[0.03] border border-white/[0.06] text-white/90 backdrop-blur-3xl shadow-xl'
                        : 'bg-emerald-600/90 text-white font-medium shadow-[0_12px_32px_rgba(5,150,105,0.3)]'
                        }`}
                    >
                      {msg.content}
                      {msg.role === 'assistant' && msg.alerts && msg.alerts.length > 0 && (
                        <div className="mt-4 space-y-2.5">
                          {msg.alerts.map((a, j) => (
                            <div
                              key={j}
                              className={`text-[13px] p-3.5 rounded-2xl flex items-start gap-3 ${a.level === 'critical' ? 'bg-red-500/10 text-red-200 border border-red-500/20' : 'bg-yellow-500/10 text-yellow-100 border border-yellow-500/20'
                                }`}
                            >
                              <AlertTriangle className={`w-4.5 h-4.5 shrink-0 mt-0.5 ${a.level === 'critical' ? 'text-red-400' : 'text-yellow-400'}`} />
                              <span className="font-medium">{a.message}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Timestamp sutil minimalista */}
                      <span className="block mt-2 text-[10px] font-bold opacity-20 text-right uppercase tracking-[0.1em]">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl px-6 py-4 flex items-center gap-4 backdrop-blur-3xl">
                      <div className="flex gap-1.5">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                      </div>
                      <span className="text-[11px] font-bold text-white/30 tracking-[0.15em] uppercase">Graham analisando</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Chat Fixo Estilo Floating Apple */}
              <div className="absolute bottom-0 left-0 right-0 px-6 pb-8 bg-background pt-4">
                {/* Chips de atalho rápidos sutis */}
                {messages.length > 0 && (
                  <div className="flex gap-2.5 overflow-x-auto pb-4 scrollbar-hide max-w-4xl mx-auto">
                    {QUICK_CHIPS.map(chip => (
                      <button
                        key={chip.label}
                        onClick={() => sendMessage(chip.prompt)}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-[1rem] bg-white/[0.03] border border-white/[0.06] text-[12px] font-bold text-white/40 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-300 transition-all whitespace-nowrap disabled:opacity-30 backdrop-blur-3xl"
                      >
                        <chip.icon className="w-3.5 h-3.5" />
                        {chip.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="max-w-4xl mx-auto flex gap-3 items-end bg-white/[0.04] border border-white/[0.08] rounded-[2.2rem] p-3 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)] backdrop-blur-[40px] focus-within:border-emerald-500/40 focus-within:ring-4 focus-within:ring-emerald-500/5 transition-all group">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Consulte o Graham..."
                    rows={1}
                    className="flex-1 bg-transparent px-4 py-3 text-[16px] text-white placeholder-white/20 resize-none outline-none leading-[1.5] max-h-40 overflow-y-auto"
                    style={{ minHeight: '48px' }}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || loading}
                    className="p-3.5 rounded-[1.4rem] bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/[0.05] disabled:text-white/10 transition-all shadow-lg active:scale-95 group-focus-within:shadow-emerald-500/20"
                  >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
