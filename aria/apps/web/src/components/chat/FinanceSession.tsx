'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Send, Loader2, ExternalLink, Download,
  AlertTriangle, TrendingDown, TrendingUp, DollarSign,
  PieChart, FileText, Bell, CheckCircle, X,
} from 'lucide-react';
import { useAriaSpeech } from '@/hooks/useAriaSpeech';

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

// ── Componente principal ──────────────────────────────────────────────────────

export function FinanceSession({ onClose }: FinanceSessionProps) {
  const [phase, setPhase] = useState<Phase>('home');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState<BudgetAlert[]>([]);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [statusChecked, setStatusChecked] = useState(false);

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
        // Inicia onboarding com a primeira mensagem
        if (data.firstMessage) {
          setMessages([{
            role: 'assistant',
            content: data.firstMessage,
            timestamp: new Date(),
          }]);
          setOnboardingStep(data.onboardingStep ?? 0);
          setPhase('onboarding');
        }
      } else {
        setPhase('chat');
      }
    } catch {
      setStatusChecked(true);
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

  // ── Chat / Onboarding ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#0d0d1a] text-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">Finance Squad</p>
            <p className="text-xs text-white/40 leading-tight truncate">
              {phase === 'onboarding' ? `Diagnóstico • Passo ${onboardingStep + 1}/6` : 'Buffet (Seu Assistente Pessoal)'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <AlertBadge alerts={activeAlerts} />

          {phase === 'chat' && (
            <>
              <button
                onClick={downloadPdf}
                title="Baixar relatório PDF"
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
              >
                <Download className="w-4 h-4" />
              </button>

              {spreadsheetUrl && (
                <a
                  href={spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir planilha no Google Drive"
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-emerald-400"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </>
          )}
        </div>
      </div>

      {/* Barra de progresso do onboarding */}
      {phase === 'onboarding' && (
        <div className="px-4 py-2 shrink-0">
          <div className="flex gap-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${i < onboardingStep ? 'bg-emerald-500' : i === onboardingStep ? 'bg-emerald-500/50' : 'bg-white/10'
                  }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 && phase === 'chat' && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-8">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <DollarSign className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <p className="text-white/80 font-medium mb-1">Como posso ajudar?</p>
              <p className="text-white/40 text-sm">Diga o que gastou, pergunte seu saldo ou peça um relatório.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {QUICK_CHIPS.map(chip => (
                <button
                  key={chip.label}
                  onClick={() => sendMessage(chip.prompt)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/70 hover:bg-emerald-500/15 hover:border-emerald-500/30 hover:text-emerald-300 transition-all"
                >
                  <chip.icon className="w-3.5 h-3.5" />
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}

        {loading && (
          <div className="flex justify-start mb-3">
            <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              <span className="text-sm text-white/50">Processando...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Chips de atalho (apenas no chat, quando há mensagens) */}
      {phase === 'chat' && messages.length > 0 && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto shrink-0 scrollbar-hide">
          {QUICK_CHIPS.map(chip => (
            <button
              key={chip.label}
              onClick={() => sendMessage(chip.prompt)}
              disabled={loading}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/60 hover:bg-emerald-500/10 hover:border-emerald-500/20 hover:text-emerald-300 transition-all whitespace-nowrap disabled:opacity-40"
            >
              <chip.icon className="w-3 h-3" />
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2 shrink-0 border-t border-white/5">
        <div className="flex gap-2 items-end bg-white/5 border border-white/10 rounded-2xl px-3 py-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={phase === 'onboarding' ? 'Responda a pergunta...' : 'Diga o que gastou ou pergunte algo...'}
            rows={1}
            className="flex-1 bg-transparent text-sm text-white placeholder-white/30 resize-none outline-none leading-relaxed max-h-24 overflow-y-auto"
            style={{ minHeight: '24px' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="p-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin text-white/60" />
              : <Send className="w-4 h-4" />
            }
          </button>
        </div>
      </div>
    </div>
  );
}
