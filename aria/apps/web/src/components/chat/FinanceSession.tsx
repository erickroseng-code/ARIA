'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  DollarSign,
  Download,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  TrendingDown,
  TrendingUp,
  Trash2,
  X,
} from 'lucide-react';
import { addMonths, format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type TxType = 'receita' | 'despesa';
type SourceType = 'local' | 'sheets';
type AddMode = 'receita' | 'despesa' | 'divida' | 'atrasada' | 'cartao';

interface FinanceSessionProps {
  onClose: () => void;
}

interface DashboardData {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  transactions: Array<{
    index: number;
    source: SourceType;
    date: string;
    type: TxType;
    category: string;
    description: string;
    amount: number;
  }>;
}

interface DebtRecord {
  index: number;
  source: SourceType;
  creditor: string;
  totalAmount: number;
  interestRate: number;
  remainingInstallments: number;
  dueDay: number;
  dueDate: string;
  daysOverdue: number;
  monthlyInstallment: number;
}

interface OverdueRecord {
  index: number;
  source: SourceType;
  account: string;
  overdueAmount: number;
  daysOverdue: number;
  dueDate: string;
}

interface RecurringExpenseRecord {
  id: number;
  description: string;
  category: string;
  amount: number;
  dayOfMonth: number;
  active: boolean;
}

interface CreditCardRecord {
  id: number;
  name: string;
  bank: string;
  brand: string;
  closingDay: number;
  dueDay: number;
  cardLimit: number;
  createdAt: string;
}

function monthParam(d: Date): string {
  return format(d, 'yyyy-MM');
}

function fmtCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function formatCurrencyInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const value = Number(digits) / 100;
  return fmtCurrency(value);
}

function formatCurrencyInputFromNumber(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  return fmtCurrency(value);
}

function parseCurrencyInput(value: string): number {
  const digits = value.replace(/\D/g, '');
  if (!digits) return NaN;
  return Number(digits) / 100;
}

function fmtDate(date: string): string {
  if (!date) return '-';
  const [y, m, d] = date.split('-');
  if (!y || !m || !d) return date;
  return `${d}/${m}/${y}`;
}

const EXPENSE_CATEGORIES = [
  'Alimentação',
  'Transporte',
  'Moradia',
  'Saúde',
  'Educação',
  'Lazer',
  'Vestuário',
  'Tecnologia',
  'Serviços',
  'Assinaturas',
  'Viagem',
  'Pets',
  'Outros',
];

const INCOME_CATEGORIES = [
  'Salário',
  'Freelance',
  'Investimentos',
  'Vendas',
  'Reembolso',
  'Prêmios',
  'Transferências',
  'Benefícios',
  'Outros Ganhos',
];

const CARD_BRANDS = ['Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard', 'Outro'];

function CalendarPicker({ currentDate, onChange }: { currentDate: Date; onChange: (d: Date) => void }) {
  const setMonthFromInput = (value: string) => {
    if (!value) return;
    const [year, month] = value.split('-').map(Number);
    if (!year || !month) return;
    onChange(new Date(year, month - 1, 1));
  };

  return (
    <div className="w-full border-b border-white/10 px-4 py-3 flex items-center justify-between">
      <button
        onClick={() => onChange(subMonths(currentDate, 1))}
        className="p-1.5 rounded-lg hover:bg-white/8 text-white/50 hover:text-white/90"
        title="Mês anterior"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <label className="relative cursor-pointer">
        <span className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors inline-flex items-center gap-2 select-none">
          <CalendarDays className="w-3.5 h-3.5" />
          <span className="capitalize">{format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}</span>
        </span>
        <input
          type="month"
          value={format(currentDate, 'yyyy-MM')}
          onChange={(e) => setMonthFromInput(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
      </label>
      <button
        onClick={() => onChange(addMonths(currentDate, 1))}
        className="p-1.5 rounded-lg hover:bg-white/8 text-white/50 hover:text-white/90"
        title="Próximo mês"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
function TypeBadge({ type }: { type: TxType }) {
  if (type === 'receita') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
        <ArrowDownCircle className="w-3 h-3" />
        Receita
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/20">
      <ArrowUpCircle className="w-3 h-3" />
      Despesa
    </span>
  );
}

function OverdueBadge({ days }: { days: number }) {
  if (days <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-400">
      <AlertTriangle className="w-2.5 h-2.5" />
      {days}d
    </span>
  );
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className={`px-4 py-3 flex items-center justify-between border-b border-white/8`}>
      <span className="text-sm font-semibold text-white/90">{title}</span>
      {count !== undefined && count > 0 && (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-white/10 text-white/60`}>
          {count}
        </span>
      )}
    </div>
  );
}

function PieChart({ data }: { data: DashboardData['transactions'] }) {
  const categories = new Map<string, number>();
  data.filter(t => t.type === 'despesa').forEach(t => {
    categories.set(t.category, (categories.get(t.category) || 0) + t.amount);
  });

  const total = Array.from(categories.values()).reduce((a, b) => a + b, 0);
  const colors = ['bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500', 'bg-emerald-500'];
  const entries = Array.from(categories.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-3">
      {total === 0 ? (
        <div className="text-white/30 text-xs text-center py-4">Nenhuma despesa registrada</div>
      ) : (
        <>
          {entries.map(([cat, amt], i) => {
            const percentage = (amt / total) * 100;
            return (
              <div key={cat} className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${colors[i % colors.length]}`} />
                    <span className="text-white/70">{cat}</span>
                  </div>
                  <span className="text-white/90 font-semibold">{percentage.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                  <div className={`h-full ${colors[i % colors.length]}`} style={{ width: `${percentage}%` }} />
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

export function FinanceSession({ onClose }: FinanceSessionProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [overdue, setOverdue] = useState<OverdueRecord[]>([]);
  const [recurring, setRecurring] = useState<RecurringExpenseRecord[]>([]);
  const [cards, setCards] = useState<CreditCardRecord[]>([]);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'resumo' | 'cartoes' | 'dividas' | 'atrasadas' | 'planning'>('resumo');
  const tabLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mode, setMode] = useState<AddMode | null>(null);
  const [editingTx, setEditingTx] = useState<DashboardData['transactions'][number] | null>(null);

  const [txDate, setTxDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [txDescription, setTxDescription] = useState('');
  const [txCategory, setTxCategory] = useState('Outros');
  const [txAmount, setTxAmount] = useState('');
  const [txIsFixed, setTxIsFixed] = useState(false);
  const [txPaymentMethod, setTxPaymentMethod] = useState<'pix' | 'credito' | 'debito' | 'outros'>('outros');
  const [txCreditCardId, setTxCreditCardId] = useState<number | null>(null);

  const [debtCreditor, setDebtCreditor] = useState('');
  const [debtAmount, setDebtAmount] = useState('');
  const [debtRate, setDebtRate] = useState('');
  const [debtInstallments, setDebtInstallments] = useState('');
  const [debtMonthly, setDebtMonthly] = useState('');
  const [debtDueDate, setDebtDueDate] = useState('');

  const [overdueAccount, setOverdueAccount] = useState('');
  const [overdueAmount, setOverdueAmount] = useState('');
  const [overdueDueDate, setOverdueDueDate] = useState('');

  const [cardName, setCardName] = useState('');
  const [cardBank, setCardBank] = useState('');
  const [cardBrand, setCardBrand] = useState('Visa');
  const [cardClosingDay, setCardClosingDay] = useState('');
  const [cardDueDay, setCardDueDay] = useState('');
  const [cardLimit, setCardLimit] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const month = monthParam(selectedMonth);
      const [dRes, debtRes, overdueRes, recurringRes, sheetRes, cardsRes] = await Promise.all([
        fetch(`${API_URL}/api/finance/dashboard?month=${month}`),
        fetch(`${API_URL}/api/finance/debts`),
        fetch(`${API_URL}/api/finance/overdue`),
        fetch(`${API_URL}/api/finance/recurring-expenses`),
        fetch(`${API_URL}/api/finance/spreadsheet`),
        fetch(`${API_URL}/api/finance/credit-cards`),
      ]);

      const dData = await dRes.json();
      setDashboard(dData);

      const debtData = await debtRes.json();
      setDebts(debtData.debts ?? []);

      const overdueData = await overdueRes.json();
      setOverdue(overdueData.accounts ?? []);

      const recurringData = await recurringRes.json();
      setRecurring(recurringData.recurring ?? []);

      const cardsData = await cardsRes.json();
      setCards(cardsData.cards ?? []);

      if (sheetRes.ok) {
        const sData = await sheetRes.json();
        setSpreadsheetUrl(sData.spreadsheetUrl ?? null);
      } else {
        setSpreadsheetUrl(null);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    return () => {
      if (tabLoadTimeoutRef.current) {
        clearTimeout(tabLoadTimeoutRef.current);
      }
    };
  }, []);

  const totalsByType = useMemo(() => {
    const tx = dashboard?.transactions ?? [];
    const receber = tx.filter(t => t.type === 'receita').reduce((acc, t) => acc + t.amount, 0);
    const pagar = tx.filter(t => t.type === 'despesa').reduce((acc, t) => acc + t.amount, 0);
    const dividas = debts.reduce((acc, d) => acc + (d.totalAmount || 0), 0);
    const atrasadas = overdue.reduce((acc, o) => acc + (o.overdueAmount || 0), 0);
    const saldo = receber - pagar;
    return { receber, pagar, dividas, atrasadas, saldo };
  }, [dashboard, debts, overdue]);

  const openAdd = (m: AddMode) => {
    setMode(m);
    setEditingTx(null);
    setTxDate(format(new Date(), 'yyyy-MM-dd'));
    setTxDescription('');
    setTxCategory(m === 'receita' ? 'Salário' : 'Outros');
    setTxAmount('');
    setTxIsFixed(false);
    setDebtCreditor('');
    setDebtAmount('');
    setDebtRate('');
    setDebtInstallments('');
    setDebtMonthly('');
    setDebtDueDate('');
    setOverdueAccount('');
    setOverdueAmount('');
    setOverdueDueDate('');
    setTxPaymentMethod('outros');
    setTxCreditCardId(null);
    setCardName('');
    setCardBank('');
    setCardBrand('Visa');
    setCardClosingDay('');
    setCardDueDay('');
    setCardLimit('');
  };

  const openEditTx = (tx: DashboardData['transactions'][number]) => {
    setMode(tx.type);
    setEditingTx(tx);
    setTxDate(tx.date || format(new Date(), 'yyyy-MM-dd'));
    setTxDescription(tx.description);
    setTxCategory(tx.category || 'Outros');
    setTxAmount(formatCurrencyInputFromNumber(tx.amount || 0));
    setTxIsFixed(false);
  };

  const closeModal = () => {
    setMode(null);
    setEditingTx(null);
  };

  const saveTx = async () => {
    const amount = parseCurrencyInput(txAmount);
    if (!txDescription.trim() || !txCategory.trim() || !Number.isFinite(amount) || amount <= 0) return;

    setSaving(true);
    try {
      const body = {
        type: (mode === 'receita' ? 'receita' : 'despesa') as TxType,
        description: txDescription.trim(),
        category: txCategory.trim(),
        amount,
        date: txDate,
        paymentMethod: mode === 'despesa' ? txPaymentMethod : undefined,
        creditCardId: mode === 'despesa' && txPaymentMethod === 'credito' ? txCreditCardId : undefined,
      };

      if (editingTx) {
        await fetch(`${API_URL}/api/finance/transaction/${editingTx.index}?source=${editingTx.source}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await fetch(`${API_URL}/api/finance/transaction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (mode === 'despesa' && txIsFixed) {
          const dayOfMonth = Math.max(1, Math.min(31, Number((txDate || '').split('-')[2] || '1')));
          await fetch(`${API_URL}/api/finance/recurring-expenses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              description: txDescription.trim(),
              category: txCategory.trim(),
              amount,
              dayOfMonth,
              startMonth: monthParam(selectedMonth),
            }),
          });
        }
      }

      closeModal();
      await loadAll();
    } finally {
      setSaving(false);
    }
  };

  const saveDebt = async () => {
    const totalAmount = parseCurrencyInput(debtAmount);
    const monthlyInstallment = debtMonthly ? parseCurrencyInput(debtMonthly) : 0;
    if (!debtCreditor.trim() || !Number.isFinite(totalAmount) || totalAmount <= 0) return;
    if (debtMonthly && (!Number.isFinite(monthlyInstallment) || monthlyInstallment < 0)) return;

    setSaving(true);
    try {
      await fetch(`${API_URL}/api/finance/debts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creditor: debtCreditor.trim(),
          totalAmount,
          interestRate: Number(debtRate || 0),
          remainingInstallments: Number(debtInstallments || 0),
          monthlyInstallment,
          dueDate: debtDueDate || undefined,
        }),
      });
      closeModal();
      await loadAll();
    } finally {
      setSaving(false);
    }
  };

  const saveOverdue = async () => {
    const amount = parseCurrencyInput(overdueAmount);
    if (!overdueAccount.trim() || !Number.isFinite(amount) || amount <= 0) return;

    setSaving(true);
    try {
      await fetch(`${API_URL}/api/finance/overdue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: overdueAccount.trim(),
          overdueAmount: amount,
          dueDate: overdueDueDate || undefined,
        }),
      });
      closeModal();
      await loadAll();
    } finally {
      setSaving(false);
    }
  };

  const saveCard = async () => {
    const closingDay = parseInt(cardClosingDay);
    const dueDay = parseInt(cardDueDay);
    const parsedCardLimit = cardLimit ? parseCurrencyInput(cardLimit) : 0;
    if (!cardName.trim() || !cardBank.trim() || isNaN(closingDay) || isNaN(dueDay)) return;
    if (cardLimit && (!Number.isFinite(parsedCardLimit) || parsedCardLimit < 0)) return;

    setSaving(true);
    try {
      await fetch(`${API_URL}/api/finance/credit-cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cardName.trim(),
          bank: cardBank.trim(),
          brand: cardBrand,
          closingDay,
          dueDay,
          cardLimit: parsedCardLimit,
        }),
      });
      closeModal();
      await loadAll();
    } finally {
      setSaving(false);
    }
  };

  const deleteCard = async (id: number) => {
    await fetch(`${API_URL}/api/finance/credit-cards/${id}`, { method: 'DELETE' });
    await loadAll();
  };

  const deleteTx = async (tx: DashboardData['transactions'][number]) => {
    await fetch(`${API_URL}/api/finance/transaction/${tx.index}?source=${tx.source}`, { method: 'DELETE' });
    await loadAll();
  };

  const deleteDebt = async (debt: DebtRecord) => {
    await fetch(`${API_URL}/api/finance/debts/${debt.index}?source=${debt.source}`, { method: 'DELETE' });
    await loadAll();
  };

  const deleteOverdue = async (item: OverdueRecord) => {
    await fetch(`${API_URL}/api/finance/overdue/${item.index}?source=${item.source}`, { method: 'DELETE' });
    await loadAll();
  };

  const payDebtInstallment = async (debt: DebtRecord) => {
    const maybe = window.prompt('Valor da parcela (deixe vazio para usar parcela mensal):', debt.monthlyInstallment ? String(debt.monthlyInstallment) : '');
    const parsed = Number(maybe);
    const body = maybe && Number.isFinite(parsed) && parsed > 0 ? { amount: parsed } : {};
    await fetch(`${API_URL}/api/finance/debts/${debt.index}/pay-installment?source=${debt.source}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    await loadAll();
  };

  const payDebtFull = async (debt: DebtRecord) => {
    await fetch(`${API_URL}/api/finance/debts/${debt.index}/pay-full?source=${debt.source}`, { method: 'POST' });
    await loadAll();
  };

  const payOverduePartial = async (item: OverdueRecord) => {
    const maybe = window.prompt('Quanto deseja pagar?', String(item.overdueAmount));
    const amount = Number(maybe);
    if (!Number.isFinite(amount) || amount <= 0) return;
    await fetch(`${API_URL}/api/finance/overdue/${item.index}/pay?source=${item.source}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    });
    await loadAll();
  };

  const payOverdueFull = async (item: OverdueRecord) => {
    await fetch(`${API_URL}/api/finance/overdue/${item.index}/pay-full?source=${item.source}`, { method: 'POST' });
    await loadAll();
  };

  const toggleRecurring = async (item: RecurringExpenseRecord) => {
    await fetch(`${API_URL}/api/finance/recurring-expenses/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !item.active }),
    });
    await loadAll();
  };

  const deleteRecurring = async (id: number) => {
    await fetch(`${API_URL}/api/finance/recurring-expenses/${id}`, { method: 'DELETE' });
    await loadAll();
  };

  const downloadPdf = async () => {
    const month = monthParam(selectedMonth);
    const res = await fetch(`${API_URL}/api/finance/report/pdf?month=${month}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-financeiro-${month}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputClass = "w-full h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 focus:bg-white/8 transition-colors";
  const categoryOptions = mode === 'receita' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const switchTab = (tab: 'resumo' | 'cartoes' | 'dividas' | 'atrasadas' | 'planning') => {
    if (tab === activeTab) return;
    setTabLoading(true);
    setActiveTab(tab);
    if (tabLoadTimeoutRef.current) clearTimeout(tabLoadTimeoutRef.current);
    tabLoadTimeoutRef.current = setTimeout(() => setTabLoading(false), 220);
  };

  return (
    <div className="h-full flex flex-col bg-background text-white">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/8 transition-colors">
          <ArrowLeft className="w-4 h-4 text-white/70" />
        </button>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
            <span className="text-base">💰</span>
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Graham</p>
            <p className="text-[10px] text-emerald-400/60 uppercase tracking-widest font-medium">Gestão Financeira</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={downloadPdf} className="p-2 rounded-lg hover:bg-white/8 transition-colors" title="Baixar PDF">
            <Download className="w-4 h-4 text-white/50" />
          </button>
          {spreadsheetUrl && (
            <a href={spreadsheetUrl} target="_blank" rel="noreferrer" className="p-2 rounded-lg hover:bg-white/8 transition-colors" title="Abrir planilha">
              <ExternalLink className="w-4 h-4 text-white/50" />
            </a>
          )}
        </div>
      </div>

      {/* Calendar Month Picker */}
      <CalendarPicker currentDate={selectedMonth} onChange={setSelectedMonth} />

      {/* KPI Cards */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {/* Receitas */}
          <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/20 px-3 py-3 min-h-[92px] flex flex-col justify-between">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] text-emerald-400/70 font-medium uppercase tracking-wider">Receitas</span>
            </div>
            <div className="text-base font-bold text-emerald-400 tabular-nums">{fmtCurrency(totalsByType.receber)}</div>
          </div>

          {/* Despesas */}
          <div className="rounded-xl bg-rose-500/8 border border-rose-500/20 px-3 py-3 min-h-[92px] flex flex-col justify-between">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-[10px] text-rose-400/70 font-medium uppercase tracking-wider">Despesas</span>
            </div>
            <div className="text-base font-bold text-rose-400 tabular-nums">{fmtCurrency(totalsByType.pagar)}</div>
          </div>

          {/* Dívidas */}
          <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 px-3 py-3 min-h-[92px] flex flex-col justify-between">
            <div className="flex items-center gap-1.5 mb-1">
              <CreditCard className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] text-amber-400/70 font-medium uppercase tracking-wider">Dívidas</span>
            </div>
            <div className="text-base font-bold text-amber-400 tabular-nums">{fmtCurrency(totalsByType.dividas)}</div>
          </div>

          {/* Saldo */}
          <div className={`rounded-xl px-3 py-3 min-h-[92px] flex flex-col justify-between border ${
            totalsByType.saldo >= 0
              ? 'bg-emerald-500/8 border-emerald-500/20'
              : 'bg-rose-500/8 border-rose-500/20'
          }`}>
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className={`w-3.5 h-3.5 ${totalsByType.saldo >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} />
              <span className={`text-[10px] font-medium uppercase tracking-wider ${totalsByType.saldo >= 0 ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>Saldo</span>
            </div>
            <div className={`text-base font-bold tabular-nums ${totalsByType.saldo >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {fmtCurrency(totalsByType.saldo)}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="px-4 py-2 border-b border-white/10 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {(['resumo', 'cartoes', 'dividas', 'atrasadas', 'planning'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => switchTab(tab)}
              className={`px-3 sm:px-4 py-2.5 text-xs font-medium rounded-lg transition-all inline-flex items-center gap-1.5 shrink-0 ${
                activeTab === tab
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'text-white/50 hover:text-white/70 border border-transparent'
              }`}
            >
              <span>
                {tab === 'resumo' && 'Resumo'}
                {tab === 'cartoes' && 'Cartões'}
                {tab === 'dividas' && 'Dívidas'}
                {tab === 'atrasadas' && 'Atrasadas'}
                {tab === 'planning' && 'Planejamento'}
              </span>
              {tab === 'dividas' && debts.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {debts.length}
                </span>
              )}
              {tab === 'atrasadas' && overdue.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-500/20 text-red-300 border border-red-500/30">
                  {overdue.length}
                </span>
              )}
              {tab === 'cartoes' && cards.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  {cards.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      {/* Action buttons */}
      {activeTab === 'resumo' && (
        <div className="px-4 py-3 border-b border-white/10 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            <button
              onClick={() => openAdd('receita')}
              className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Receita
            </button>
            <button
              onClick={() => openAdd('despesa')}
              className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-rose-500/25 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Despesa
            </button>
          </div>
        </div>
      )}
      {activeTab === 'dividas' && (
        <div className="px-4 py-3 border-b border-white/10">
          <button
            onClick={() => openAdd('divida')}
            className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova Dívida
          </button>
        </div>
      )}
      {activeTab === 'atrasadas' && (
        <div className="px-4 py-3 border-b border-white/10">
          <button
            onClick={() => openAdd('atrasada')}
            className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Nova Conta Atrasada
          </button>
        </div>
      )}
      {activeTab === 'cartoes' && (
        <div className="px-4 py-3 border-b border-white/10">
          <button
            onClick={() => openAdd('cartao')}
            className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-violet-500/15 border border-violet-500/30 text-violet-400 hover:bg-violet-500/25 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo Cartão
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading || tabLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-2 text-white/50 text-xs">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{loading ? 'Carregando dados...' : 'Atualizando aba...'}</span>
            </div>
          </div>
        ) : activeTab === 'resumo' ? (
          <div className="p-4 space-y-4">
            {/* Pie Chart Visualization */}
            <section className="rounded-xl border border-white/10 overflow-hidden bg-white/[0.02] p-4">
              <h3 className="text-sm font-semibold text-white/90 mb-3">Distribuição de Despesas</h3>
              <PieChart data={dashboard?.transactions ?? []} />
            </section>

            {/* Transações do mês */}
            <section className="rounded-xl border border-white/10 overflow-hidden bg-white/[0.02]">
              <SectionHeader title="Fluxo de caixa" count={dashboard?.transactions?.length} />
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[640px] text-xs">
                  <thead>
                    <tr className="border-b border-white/8">
                      <th className="text-left px-4 py-2.5 text-white/40 font-medium">Data</th>
                      <th className="text-left px-4 py-2.5 text-white/40 font-medium">Tipo</th>
                      <th className="text-left px-4 py-2.5 text-white/40 font-medium">Categoria</th>
                      <th className="text-left px-4 py-2.5 text-white/40 font-medium">Descrição</th>
                      <th className="text-right px-4 py-2.5 text-white/40 font-medium">Valor</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {(dashboard?.transactions ?? []).map((tx) => (
                      <tr key={`${tx.source}-${tx.index}`} className="border-t border-white/6 hover:bg-white/[0.02] transition-colors group">
                        <td className="px-4 py-2.5 text-white/60 tabular-nums">{fmtDate(tx.date)}</td>
                        <td className="px-4 py-2.5"><TypeBadge type={tx.type} /></td>
                        <td className="px-4 py-2.5 text-white/70">{tx.category}</td>
                        <td className="px-4 py-2.5 text-white/90">{tx.description}</td>
                        <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${tx.type === 'receita' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {tx.type === 'despesa' ? '- ' : '+ '}{fmtCurrency(tx.amount)}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEditTx(tx)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white/90 transition-colors">
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button onClick={() => deleteTx(tx)} className="p-1.5 rounded-lg hover:bg-rose-500/20 text-white/50 hover:text-rose-400 transition-colors">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(dashboard?.transactions?.length ?? 0) === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center">
                          <div className="text-white/25 text-xs">Nenhuma transação registrada neste mês</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Despesas fixas */}
            <section className="rounded-xl border border-white/10 overflow-hidden bg-white/[0.02]">
              <SectionHeader title="Despesas fixas" count={recurring.length} />
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[560px] text-xs">
                  <thead>
                    <tr className="border-b border-white/8">
                      <th className="text-left px-4 py-2.5 text-white/40 font-medium">Descrição</th>
                      <th className="text-left px-4 py-2.5 text-white/40 font-medium">Categoria</th>
                      <th className="text-right px-4 py-2.5 text-white/40 font-medium">Valor</th>
                      <th className="text-right px-4 py-2.5 text-white/40 font-medium">Dia</th>
                      <th className="text-center px-4 py-2.5 text-white/40 font-medium">Status</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {recurring.map((r) => (
                      <tr key={r.id} className={`border-t border-white/6 hover:bg-white/[0.02] transition-colors group ${!r.active ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-2.5 text-white/90">{r.description}</td>
                        <td className="px-4 py-2.5 text-white/60">{r.category}</td>
                        <td className="px-4 py-2.5 text-right text-white/80 font-medium tabular-nums">{fmtCurrency(r.amount)}</td>
                        <td className="px-4 py-2.5 text-right text-white/60 tabular-nums">dia {r.dayOfMonth}</td>
                        <td className="px-4 py-2.5 text-center">
                          <button
                            onClick={() => toggleRecurring(r)}
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors cursor-pointer ${
                              r.active
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/25'
                                : 'bg-white/8 text-white/40 border-white/15 hover:bg-white/12'
                            }`}
                          >
                            {r.active ? 'Ativa' : 'Inativa'}
                          </button>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button onClick={() => deleteRecurring(r.id)} className="p-1.5 rounded-lg hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-colors">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {recurring.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center">
                          <div className="text-white/25 text-xs">Nenhuma despesa fixa cadastrada</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Alertas */}
            {overdue.length > 0 && (
              <section className="rounded-xl border border-red-500/30 overflow-hidden bg-red-500/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <h3 className="text-sm font-semibold text-red-400">Atenção: {overdue.length} conta(s) atrasada(s)</h3>
                </div>
                <div className="space-y-1 text-xs text-red-300/80">
                  {overdue.map((o) => (
                    <div key={`${o.source}-${o.index}`} className="flex justify-between">
                      <span>{o.account}</span>
                      <span className="font-medium">{fmtCurrency(o.overdueAmount)} - {o.daysOverdue}d atraso</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : activeTab === 'cartoes' ? (
          <div className="p-4 space-y-3">
            {cards.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/15 p-8 text-center">
                <div className="text-2xl mb-2">💳</div>
                <p className="text-sm text-white/40">Nenhum cartão cadastrado</p>
                <p className="text-xs text-white/25 mt-1">Clique em "Novo Cartão" para adicionar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cards.map((card) => (
                  <div key={card.id} className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
                          <CreditCard className="w-5 h-5 text-violet-400" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white/90">{card.name}</div>
                          <div className="text-xs text-white/50">{card.bank} · {card.brand}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteCard(card.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-500/20 text-white/30 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-white/5 px-2 py-1.5">
                        <div className="text-[10px] text-white/40 mb-0.5">Fechamento</div>
                        <div className="text-xs font-semibold text-white/80">dia {card.closingDay}</div>
                      </div>
                      <div className="rounded-lg bg-white/5 px-2 py-1.5">
                        <div className="text-[10px] text-white/40 mb-0.5">Vencimento</div>
                        <div className="text-xs font-semibold text-white/80">dia {card.dueDay}</div>
                      </div>
                      <div className="rounded-lg bg-white/5 px-2 py-1.5">
                        <div className="text-[10px] text-white/40 mb-0.5">Limite</div>
                        <div className="text-xs font-semibold text-white/80">{card.cardLimit > 0 ? fmtCurrency(card.cardLimit) : '—'}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'dividas' ? (
          <div className="p-4">
            <section className="rounded-xl border border-white/10 overflow-hidden bg-white/[0.02]">
              <div className="px-4 py-3 flex items-center justify-between border-b border-white/8">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white/90">Dívidas Ativas</span>
                  {debts.length > 0 && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                      {debts.length}
                    </span>
                  )}
                </div>
                {debts.length > 0 && (
                  <span className="text-xs text-amber-400/70 font-medium tabular-nums">
                    Total: {fmtCurrency(totalsByType.dividas)}
                  </span>
                )}
              </div>
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[640px] text-xs">
                  <thead>
                    <tr className="border-b border-white/8">
                      <th className="text-left px-4 py-2.5 text-white/40 font-medium">Credor</th>
                      <th className="text-right px-4 py-2.5 text-white/40 font-medium">Valor total</th>
                      <th className="text-right px-4 py-2.5 text-white/40 font-medium">Parcelas</th>
                      <th className="text-right px-4 py-2.5 text-white/40 font-medium">Parcela</th>
                      <th className="text-left px-4 py-2.5 text-white/40 font-medium">Vencimento</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {debts.map((d) => (
                      <tr key={`${d.source}-${d.index}`} className="border-t border-white/6 hover:bg-white/[0.02] transition-colors group">
                        <td className="px-4 py-2.5 text-white/90 font-medium">{d.creditor}</td>
                        <td className="px-4 py-2.5 text-right text-amber-400 font-semibold tabular-nums">{fmtCurrency(d.totalAmount)}</td>
                        <td className="px-4 py-2.5 text-right text-white/60 tabular-nums">{d.remainingInstallments || '-'}</td>
                        <td className="px-4 py-2.5 text-right text-white/70 tabular-nums">{fmtCurrency(d.monthlyInstallment)}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-white/60 tabular-nums">{fmtDate(d.dueDate)}</span>
                            <OverdueBadge days={d.daysOverdue} />
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button onClick={() => payDebtInstallment(d)} className="h-6 px-2 rounded-md border border-white/15 text-white/60 hover:bg-white/10 hover:text-white/90 transition-colors">Parcela</button>
                            <button onClick={() => payDebtFull(d)} className="h-6 px-2 rounded-md border border-emerald-500/30 text-emerald-400/70 hover:bg-emerald-500/15 hover:text-emerald-400 transition-colors">Quitar</button>
                            <button onClick={() => deleteDebt(d)} className="p-1.5 rounded-lg hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-colors">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {debts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center">
                          <div className="text-white/25 text-xs">Nenhuma dívida cadastrada</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : activeTab === 'atrasadas' ? (
          <div className="p-4">
            <section className="rounded-xl border border-white/10 overflow-hidden bg-white/[0.02]">
              <div className="px-4 py-3 flex items-center justify-between border-b border-white/8">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white/90">Contas Atrasadas</span>
                  {overdue.length > 0 && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20 flex items-center gap-1">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      {overdue.length}
                    </span>
                  )}
                </div>
                {overdue.length > 0 && (
                  <span className="text-xs text-red-400/70 font-medium tabular-nums">
                    Total: {fmtCurrency(totalsByType.atrasadas)}
                  </span>
                )}
              </div>
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[500px] text-xs">
                  <thead>
                    <tr className="border-b border-white/8">
                      <th className="text-left px-4 py-2.5 text-white/40 font-medium">Conta</th>
                      <th className="text-right px-4 py-2.5 text-white/40 font-medium">Valor</th>
                      <th className="text-left px-4 py-2.5 text-white/40 font-medium">Vencimento</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {overdue.map((o) => (
                      <tr key={`${o.source}-${o.index}`} className="border-t border-white/6 hover:bg-red-500/[0.03] transition-colors group">
                        <td className="px-4 py-2.5 text-white/90 font-medium">{o.account}</td>
                        <td className="px-4 py-2.5 text-right text-red-400 font-semibold tabular-nums">{fmtCurrency(o.overdueAmount)}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-white/60 tabular-nums">{fmtDate(o.dueDate)}</span>
                            <OverdueBadge days={o.daysOverdue} />
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button onClick={() => payOverduePartial(o)} className="h-6 px-2 rounded-md border border-white/15 text-white/60 hover:bg-white/10 hover:text-white/90 transition-colors">Pagar</button>
                            <button onClick={() => payOverdueFull(o)} className="h-6 px-2 rounded-md border border-emerald-500/30 text-emerald-400/70 hover:bg-emerald-500/15 hover:text-emerald-400 transition-colors">Quitar</button>
                            <button onClick={() => deleteOverdue(o)} className="p-1.5 rounded-lg hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-colors">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {overdue.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center">
                          <div className="text-white/25 text-xs">Nenhuma conta atrasada</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Planning & Forecasts */}
            <section className="rounded-xl border border-white/10 overflow-hidden bg-white/[0.02] p-4">
              <h3 className="text-sm font-semibold text-white/90 mb-4">Próximos Vencimentos</h3>
              <div className="space-y-2">
                {[...debts, ...overdue].length === 0 ? (
                  <div className="text-white/25 text-xs text-center py-6">Nenhum vencimento agendado</div>
                ) : (
                  <>
                    {debts.slice(0, 3).map((d) => (
                      <div key={`${d.source}-${d.index}`} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5 border border-white/8">
                        <div>
                          <div className="text-xs font-medium text-white/90">{d.creditor}</div>
                          <div className="text-[10px] text-white/50">{fmtDate(d.dueDate)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-semibold text-amber-400">{fmtCurrency(d.monthlyInstallment)}</div>
                          <div className={`text-[10px] ${d.daysOverdue > 0 ? 'text-red-400' : 'text-white/50'}`}>
                            {d.daysOverdue > 0 ? `${d.daysOverdue}d atraso` : 'Em dia'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </section>

            {/* Budget Summary */}
            <section className="rounded-xl border border-white/10 overflow-hidden bg-white/[0.02] p-4">
              <h3 className="text-sm font-semibold text-white/90 mb-4">Resumo Orçamentário</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-white/60">Despesas vs Receitas</span>
                    <span className="text-xs font-semibold text-white/80">{totalsByType.pagar > 0 ? Math.round((totalsByType.pagar / totalsByType.receber) * 100) : 0}%</span>
                  </div>
                  <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-rose-500" style={{ width: `${Math.min(100, totalsByType.receber > 0 ? (totalsByType.pagar / totalsByType.receber) * 100 : 0)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-white/60">Saúde Financeira</span>
                    <span className="text-xs font-semibold text-white/80">{totalsByType.saldo >= 0 ? '✓ Positiva' : '✗ Negativa'}</span>
                  </div>
                  <div className={`px-3 py-2 rounded-lg text-xs text-center font-semibold ${totalsByType.saldo >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                    {totalsByType.saldo >= 0 ? 'Você tem saldo positivo' : 'Você está no vermelho'}
                  </div>
                </div>
              </div>
            </section>

            {/* Chat Suggestion */}
            <section className="rounded-xl border border-emerald-500/20 overflow-hidden bg-emerald-500/5 p-4">
              <div className="flex items-start gap-3">
                <span className="text-lg">💬</span>
                <div>
                  <h4 className="text-xs font-semibold text-emerald-400 mb-1">Sugestão</h4>
                  <p className="text-xs text-white/70">Volte para a aba de Transações para registrar receitas e despesas. Graham vai analisar seus gastos e oferecer dicas de otimização.</p>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Modal */}
      {mode && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

            {/* Modal header */}
            <div className={`px-5 py-4 border-b border-white/8 flex items-center justify-between ${
              mode === 'receita' ? 'bg-emerald-500/8' :
              mode === 'despesa' ? 'bg-rose-500/8' :
              mode === 'divida' ? 'bg-amber-500/8' :
              mode === 'atrasada' ? 'bg-red-500/8' :
              'bg-violet-500/8'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm ${
                  mode === 'receita' ? 'bg-emerald-500/20 border border-emerald-500/30' :
                  mode === 'despesa' ? 'bg-rose-500/20 border border-rose-500/30' :
                  mode === 'divida' ? 'bg-amber-500/20 border border-amber-500/30' :
                  mode === 'atrasada' ? 'bg-red-500/20 border border-red-500/30' :
                  'bg-violet-500/20 border border-violet-500/30'
                }`}>
                  {mode === 'receita' ? '↓' : mode === 'despesa' ? '↑' : mode === 'divida' ? '💳' : mode === 'atrasada' ? '⚠️' : '🃏'}
                </div>
                <h3 className="text-sm font-semibold text-white/90">
                  {editingTx ? 'Alterar transação' :
                   mode === 'receita' ? 'Nova receita' :
                   mode === 'despesa' ? 'Nova despesa' :
                   mode === 'divida' ? 'Nova dívida' :
                   mode === 'atrasada' ? 'Conta atrasada' :
                   'Novo cartão'}
                </h3>
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white/90 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-5 py-4 space-y-3">
              {(mode === 'receita' || mode === 'despesa') && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Data</label>
                      <input value={txDate} onChange={e => setTxDate(e.target.value)} type="date" className={inputClass} />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Valor (R$)</label>
                      <input
                        value={txAmount}
                        onChange={e => setTxAmount(formatCurrencyInput(e.target.value))}
                        type="text"
                        inputMode="numeric"
                        placeholder="R$ 0,00"
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Categoria</label>
                    <select
                      value={txCategory}
                      onChange={(e) => setTxCategory(e.target.value)}
                      className={inputClass}
                    >
                      {!!txCategory && !categoryOptions.includes(txCategory) && (
                        <option value={txCategory} style={{ background: '#0d1117' }}>{txCategory}</option>
                      )}
                      {categoryOptions.map(cat => (
                        <option key={cat} value={cat} style={{ background: '#0d1117' }}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Descrição</label>
                    <input value={txDescription} onChange={e => setTxDescription(e.target.value)} placeholder="Descreva a transação" className={inputClass} />
                  </div>
                  {mode === 'despesa' && (
                    <div className="space-y-2">
                      <label className="text-xs text-white/50">Forma de pagamento</label>
                      <select
                        value={txPaymentMethod}
                        onChange={(e) => {
                          setTxPaymentMethod(e.target.value as any);
                          if (e.target.value !== 'credito') setTxCreditCardId(null);
                        }}
                        className={inputClass}
                      >
                        <option value="outros" style={{ background: '#0d1117' }}>Outros</option>
                        <option value="pix" style={{ background: '#0d1117' }}>Pix</option>
                        <option value="debito" style={{ background: '#0d1117' }}>Cartão de Débito</option>
                        <option value="credito" style={{ background: '#0d1117' }}>Cartão de Crédito</option>
                      </select>
                      {txPaymentMethod === 'credito' && (
                        <select
                          value={txCreditCardId ?? ''}
                          onChange={(e) => setTxCreditCardId(e.target.value ? Number(e.target.value) : null)}
                          className={inputClass}
                        >
                          <option value="" style={{ background: '#0d1117' }}>Selecione o cartão</option>
                          {cards.map(c => (
                            <option key={c.id} value={c.id} style={{ background: '#0d1117' }}>{c.name} ({c.bank})</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                  {mode === 'despesa' && !editingTx && (
                    <label className="flex items-center gap-2.5 text-xs text-white/70 cursor-pointer select-none">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${txIsFixed ? 'bg-emerald-500 border-emerald-500' : 'border-white/20 bg-transparent'}`}>
                        {txIsFixed && <span className="text-white text-[10px]">✓</span>}
                      </div>
                      <input type="checkbox" checked={txIsFixed} onChange={e => setTxIsFixed(e.target.checked)} className="sr-only" />
                      Despesa fixa (repete todo mês)
                    </label>
                  )}
                  <button
                    disabled={saving}
                    onClick={saveTx}
                    className={`w-full h-10 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                      mode === 'receita'
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                        : 'bg-rose-500 hover:bg-rose-400 text-white'
                    }`}
                  >
                    {saving ? 'Salvando...' : editingTx ? 'Salvar alteração' : 'Salvar'}
                  </button>
                </>
              )}

              {mode === 'divida' && (
                <>
                  <div>
                    <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Credor</label>
                    <input value={debtCreditor} onChange={e => setDebtCreditor(e.target.value)} placeholder="Banco, pessoa, empresa..." className={inputClass} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Valor total (R$)</label>
                      <input
                        value={debtAmount}
                        onChange={e => setDebtAmount(formatCurrencyInput(e.target.value))}
                        type="text"
                        inputMode="numeric"
                        placeholder="R$ 0,00"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Juros (%)</label>
                      <input value={debtRate} onChange={e => setDebtRate(e.target.value)} type="number" step="0.01" placeholder="0" className={inputClass} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Parcelas restantes</label>
                      <input value={debtInstallments} onChange={e => setDebtInstallments(e.target.value)} type="number" placeholder="Ex: 12" className={inputClass} />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Valor da parcela</label>
                      <input
                        value={debtMonthly}
                        onChange={e => setDebtMonthly(formatCurrencyInput(e.target.value))}
                        type="text"
                        inputMode="numeric"
                        placeholder="R$ 0,00"
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Data de vencimento</label>
                    <input value={debtDueDate} onChange={e => setDebtDueDate(e.target.value)} type="date" className={inputClass} />
                  </div>
                  <button disabled={saving} onClick={saveDebt} className="w-full h-10 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                    {saving ? 'Salvando...' : 'Salvar dívida'}
                  </button>
                </>
              )}

              {mode === 'atrasada' && (
                <>
                  <div>
                    <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Conta</label>
                    <input value={overdueAccount} onChange={e => setOverdueAccount(e.target.value)} placeholder="Nome da conta" className={inputClass} />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Valor (R$)</label>
                    <input
                      value={overdueAmount}
                      onChange={e => setOverdueAmount(formatCurrencyInput(e.target.value))}
                      type="text"
                      inputMode="numeric"
                      placeholder="R$ 0,00"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Data de vencimento</label>
                    <input value={overdueDueDate} onChange={e => setOverdueDueDate(e.target.value)} type="date" className={inputClass} />
                  </div>
                  <button disabled={saving} onClick={saveOverdue} className="w-full h-10 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                    {saving ? 'Salvando...' : 'Salvar conta atrasada'}
                  </button>
                </>
              )}

              {mode === 'cartao' && (
                <>
                  <input
                    placeholder="Nome do cartão (ex: Nubank Principal)"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    placeholder="Banco (ex: Nubank, Itaú, Bradesco)"
                    value={cardBank}
                    onChange={(e) => setCardBank(e.target.value)}
                    className={inputClass}
                  />
                  <select
                    value={cardBrand}
                    onChange={(e) => setCardBrand(e.target.value)}
                    className={inputClass}
                  >
                    {CARD_BRANDS.map(b => (
                      <option key={b} value={b} style={{ background: '#0d1117' }}>{b}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="Dia fechamento (1-31)"
                      value={cardClosingDay}
                      onChange={(e) => setCardClosingDay(e.target.value)}
                      min={1}
                      max={31}
                      className={inputClass}
                    />
                    <input
                      type="number"
                      placeholder="Dia vencimento (1-31)"
                      value={cardDueDay}
                      onChange={(e) => setCardDueDay(e.target.value)}
                      min={1}
                      max={31}
                      className={inputClass}
                    />
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Limite (opcional) - R$ 0,00"
                    value={cardLimit}
                    onChange={(e) => setCardLimit(formatCurrencyInput(e.target.value))}
                    className={inputClass}
                  />
                  <button disabled={saving} onClick={saveCard} className="w-full h-10 rounded-xl bg-violet-500 hover:bg-violet-400 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                    {saving ? 'Salvando...' : 'Salvar cartão'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

