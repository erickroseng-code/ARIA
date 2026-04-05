'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  DollarSign,
  Download,
  ExternalLink,
  Check,
  MoreHorizontal,
  Save,
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
import { PortfolioBreakdown } from './graham/PortfolioBreakdown';
import { BalanceDistribution } from './graham/BalanceDistribution';
import { HealthScoreGauge } from './graham/HealthScoreGauge';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type TxType = 'receita' | 'despesa';
type SourceType = 'local' | 'sheets';
type AddMode = 'receita' | 'despesa' | 'divida' | 'atrasada' | 'cartao';
type ActiveTab = 'transacoes' | 'fixas' | 'receitas' | 'dividas' | 'atrasadas' | 'cartoes' | 'planejamento';

interface FinanceSessionProps {
  onClose: () => void;
}

interface DashboardData {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  comparison: {
    month: string;
    plannedIncome: number;
    plannedExpenses: number;
    plannedBalance: number;
    actualIncome: number;
    actualExpenses: number;
    actualBalance: number;
    incomeDelta: number;
    expensesDelta: number;
    balanceDelta: number;
  };
  transactions: Array<{
    index: number;
    source: SourceType;
    date: string;
    type: TxType;
    category: string;
    description: string;
    amount: number;
    isEffective: boolean;
    effectiveAmount?: number | null;
    isRecurring?: boolean;
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
  status: string;
  paidAmount: number | null;
  paidAt: string | null;
  paidTransactionId: number | null;
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

const CATEGORY_COLORS = [
  'hsl(25, 85%, 55%)',
  'hsl(260, 55%, 60%)',
  'hsl(155, 55%, 54%)',
  'hsl(212, 80%, 65%)',
  'hsl(0, 72%, 51%)',
  'hsl(45, 90%, 50%)',
  'hsl(300, 50%, 55%)',
  'hsl(180, 55%, 50%)',
  'hsl(340, 70%, 55%)',
];

function CalendarPicker({ currentDate, onChange }: { currentDate: Date; onChange: (d: Date) => void }) {
  const setMonthFromInput = (value: string) => {
    if (!value) return;
    const [year, month] = value.split('-').map(Number);
    if (!year || !month) return;
    onChange(new Date(year, month - 1, 1));
  };

  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-border">
      <button
        onClick={() => onChange(subMonths(currentDate, 1))}
        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        title="Mês anterior"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <label className="relative cursor-pointer">
        <span className="px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/25 text-accent text-sm font-medium hover:bg-accent/15 transition-colors inline-flex items-center gap-2 select-none">
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
        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        title="Próximo mês"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function OverdueBadge({ days }: { days: number }) {
  if (days <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-destructive/15 text-destructive">
      <AlertTriangle className="w-2.5 h-2.5" />
      {days}d
    </span>
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
  const [activeTab, setActiveTab] = useState<ActiveTab>('transacoes');
  const tabLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mode, setMode] = useState<AddMode | null>(null);
  const [editingTx, setEditingTx] = useState<DashboardData['transactions'][number] | null>(null);
  const [effectiveTx, setEffectiveTx] = useState<DashboardData['transactions'][number] | null>(null);
  const [effectiveCustomValue, setEffectiveCustomValue] = useState('');
  const [effectiveUseCustomValue, setEffectiveUseCustomValue] = useState(false);
  const [effectiveSaving, setEffectiveSaving] = useState(false);

  const [txDate, setTxDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [txDescription, setTxDescription] = useState('');
  const [txCategory, setTxCategory] = useState('Outros');
  const [txAmount, setTxAmount] = useState('');
  const [txIsFixed, setTxIsFixed] = useState(false);
  const [txFixedDueDay, setTxFixedDueDay] = useState('');
  const [txHasOverdueFixed, setTxHasOverdueFixed] = useState(false);
  const [txFixedOverdueEntries, setTxFixedOverdueEntries] = useState<Array<{ dueDate: string; amount: string }>>([]);
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
  const [plannedExpensesInput, setPlannedExpensesInput] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [overduePayModal, setOverduePayModal] = useState<OverdueRecord | null>(null);
  const [overduePayInput, setOverduePayInput] = useState('');
  const [overduePaySaving, setOverduePaySaving] = useState(false);

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
      setPlannedExpensesInput(formatCurrencyInputFromNumber(Number(dData?.comparison?.plannedExpenses ?? 0)));

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
      setLoadError(null);
    } catch (err: any) {
      setLoadError(err?.message ?? 'Falha ao carregar dados. Verifique se a API está online.');
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
    const receberFromTx = tx
      .filter(t => t.type === 'receita' && t.isEffective)
      .reduce((acc, t) => acc + (t.effectiveAmount && t.effectiveAmount > 0 ? t.effectiveAmount : t.amount), 0);
    const pagarFromTx = tx.filter(t => t.type === 'despesa' && t.isEffective).reduce((acc, t) => acc + t.amount, 0);
    const receber = Number(dashboard?.comparison?.actualIncome ?? receberFromTx);
    const pagar = Number(dashboard?.comparison?.actualExpenses ?? pagarFromTx);
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
    setTxFixedDueDay('');
    setTxHasOverdueFixed(false);
    setTxFixedOverdueEntries([]);
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
    setTxFixedDueDay('');
    setTxHasOverdueFixed(false);
    setTxFixedOverdueEntries([]);
  };

  const closeModal = () => {
    setMode(null);
    setEditingTx(null);
  };

  const saveTx = async () => {
    const amount = parseCurrencyInput(txAmount);
    if (!txDescription.trim() || !txCategory.trim() || !Number.isFinite(amount) || amount <= 0) return;
    if (mode === 'despesa' && txIsFixed) {
      const dueDay = Number(txFixedDueDay);
      if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 31) {
        window.alert('Informe um dia de vencimento válido (1 a 31) para a despesa fixa.');
        return;
      }
      if (txHasOverdueFixed) {
        const hasInvalidOverdue = txFixedOverdueEntries.some((entry) => {
          const parsedAmount = parseCurrencyInput(entry.amount || '');
          return !entry.dueDate || !Number.isFinite(parsedAmount) || parsedAmount <= 0;
        });
        if (hasInvalidOverdue) {
          window.alert('Preencha data e valor válidos para todas as contas atrasadas.');
          return;
        }
      }
    }

    setSaving(true);
    try {
      const effectiveForPayload = mode === 'receita'
        ? (editingTx?.isEffective ?? false)
        : (editingTx?.isEffective ?? true);

      const body = {
        type: (mode === 'receita' ? 'receita' : 'despesa') as TxType,
        description: txDescription.trim(),
        category: txCategory.trim(),
        amount,
        isEffective: effectiveForPayload,
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
      } else if (mode === 'despesa' && txIsFixed) {
        const dayOfMonth = Math.max(1, Math.min(31, Number(txFixedDueDay || '1')));
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

        if (txHasOverdueFixed) {
          for (const entry of txFixedOverdueEntries) {
            const overdueAmt = parseCurrencyInput(entry.amount || '');
            const dueDate = entry.dueDate;
            if (!Number.isFinite(overdueAmt) || overdueAmt <= 0 || !dueDate) continue;
            await fetch(`${API_URL}/api/finance/overdue`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                account: `${txDescription.trim()} (${fmtDate(dueDate)})`,
                overdueAmount: overdueAmt,
                dueDate,
              }),
            });
          }
        }
      } else {
        await fetch(`${API_URL}/api/finance/transaction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
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

  const openOverduePay = (item: OverdueRecord) => {
    setOverduePayModal(item);
    setOverduePayInput(formatCurrencyInputFromNumber(item.overdueAmount));
  };

  const confirmOverduePay = async () => {
    if (!overduePayModal) return;
    const amount = parseCurrencyInput(overduePayInput);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setOverduePaySaving(true);
    try {
      await fetch(`${API_URL}/api/finance/overdue/${overduePayModal.index}/pay?source=${overduePayModal.source}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      setOverduePayModal(null);
      setOverduePayInput('');
      await loadAll();
    } finally {
      setOverduePaySaving(false);
    }
  };

  const undoOverduePay = async (item: OverdueRecord) => {
    await fetch(`${API_URL}/api/finance/overdue/${item.index}/undo-pay`, { method: 'POST' });
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

  const saveMonthlyPlan = async (silent = false) => {
    const plannedExpenses = parseCurrencyInput(plannedExpensesInput || '');
    const safeExpenses = Number.isFinite(plannedExpenses) ? Math.max(0, plannedExpenses) : 0;

    setSavingPlan(true);
    setPlanError(null);
    try {
      const res = await fetch(`${API_URL}/api/finance/monthly-plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: monthParam(selectedMonth),
          plannedIncome: dashboard?.comparison?.plannedIncome ?? 0,
          plannedExpenses: safeExpenses,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? 'Falha ao salvar previsto do mês.');
      }
      await loadAll();
      return true;
    } catch (err: any) {
      const message = err?.message ?? 'Falha ao salvar previsto do mês.';
      setPlanError(message);
      if (!silent) window.alert(message);
      return false;
    } finally {
      setSavingPlan(false);
    }
  };

  const inputClass = "w-full h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 focus:bg-white/8 transition-colors";
  const categoryOptions = mode === 'receita' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const switchTab = (tab: ActiveTab) => {
    if (tab === activeTab) return;
    setTabLoading(true);
    setActiveTab(tab);
    if (tabLoadTimeoutRef.current) clearTimeout(tabLoadTimeoutRef.current);
    tabLoadTimeoutRef.current = setTimeout(() => setTabLoading(false), 220);
  };

  const setIncomeEffective = async (tx: DashboardData['transactions'][number], isEffective: boolean) => {
    if (tx.type !== 'receita') return;
    if (tx.isEffective === isEffective) return;

    if (!isEffective) {
      try {
        const res = await fetch(`${API_URL}/api/finance/transaction/${tx.index}/effective?source=${tx.source}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isEffective: false }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error ?? 'Falha ao atualizar efetivação da receita.');
        }
        await loadAll();
      } catch (err: any) {
        window.alert(err?.message ?? 'Falha ao atualizar efetivação da receita.');
      }
      return;
    }

    setEffectiveTx(tx);
    setEffectiveUseCustomValue(false);
    setEffectiveCustomValue(formatCurrencyInputFromNumber(tx.amount));
  };

  const setExpenseEffective = async (tx: DashboardData['transactions'][number], isEffective: boolean) => {
    if (tx.type !== 'despesa') return;
    if (tx.isEffective === isEffective) return;
    try {
      const res = await fetch(`${API_URL}/api/finance/transaction/${tx.index}/effective?source=${tx.source}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEffective }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? 'Falha ao atualizar efetivação da despesa.');
      }
      await loadAll();
    } catch (err: any) {
      window.alert(err?.message ?? 'Falha ao atualizar efetivação da despesa.');
    }
  };

  const closeEffectiveModal = () => {
    if (effectiveSaving) return;
    setEffectiveTx(null);
    setEffectiveUseCustomValue(false);
    setEffectiveCustomValue('');
  };

  const confirmEffectiveModal = async () => {
    if (!effectiveTx) return;
    try {
      setEffectiveSaving(true);
      let actualAmount: number | undefined = undefined;
      if (effectiveUseCustomValue) {
        const parsed = parseCurrencyInput(effectiveCustomValue);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          window.alert('Valor efetivado inválido.');
          return;
        }
        actualAmount = parsed;
      }

      const res = await fetch(`${API_URL}/api/finance/transaction/${effectiveTx.index}/effective?source=${effectiveTx.source}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEffective: true, actualAmount }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? 'Falha ao atualizar efetivação da receita.');
      }
      closeEffectiveModal();
      await loadAll();
    } catch (err: any) {
      window.alert(err?.message ?? 'Falha ao atualizar efetivação da receita.');
    } finally {
      setEffectiveSaving(false);
    }
  };

  const incomeTransactions = useMemo(
    () => (dashboard?.transactions ?? []).filter((tx) => tx.type === 'receita'),
    [dashboard?.transactions],
  );

  const expenseTransactions = useMemo(
    () => (dashboard?.transactions ?? []).filter((tx) => tx.type === 'despesa'),
    [dashboard?.transactions],
  );

  const variableExpenses = useMemo(
    () => expenseTransactions.filter(tx => !tx.isRecurring),
    [expenseTransactions],
  );

  const actualBalance = Number(dashboard?.comparison?.actualBalance ?? totalsByType.saldo);

  const healthScore = useMemo(() => {
    if (!totalsByType.receber || totalsByType.receber <= 0) return 0;
    const score = (totalsByType.saldo / totalsByType.receber) * 100;
    return Math.max(0, Math.min(100, score));
  }, [totalsByType]);

  const categoryData = useMemo(() => {
    const categories = new Map<string, number>();
    expenseTransactions.forEach(t => {
      categories.set(t.category, (categories.get(t.category) || 0) + t.amount);
    });
    const total = Array.from(categories.values()).reduce((a, b) => a + b, 0);
    return Array.from(categories.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, amount], i) => ({
        label,
        amount,
        pct: total > 0 ? Math.round((amount / total) * 100) : 0,
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      }));
  }, [expenseTransactions]);

  const incomeDelta = dashboard?.comparison?.incomeDelta ?? 0;
  const expensesDelta = dashboard?.comparison?.expensesDelta ?? 0;
  const balanceDelta = dashboard?.comparison?.balanceDelta ?? 0;

  const tabs: { key: ActiveTab; label: string; badge?: number; badgeColor?: string }[] = [
    { key: 'transacoes', label: 'Transações' },
    { key: 'fixas', label: 'Fixas', badge: recurring.length > 0 ? recurring.length : undefined, badgeColor: 'amber' },
    { key: 'receitas', label: 'Receitas', badge: incomeTransactions.length > 0 ? incomeTransactions.length : undefined, badgeColor: 'green' },
    { key: 'dividas', label: 'Dívidas', badge: debts.length > 0 ? debts.length : undefined, badgeColor: 'amber' },
    { key: 'atrasadas', label: 'Atrasadas', badge: overdue.filter(o => o.status !== 'Pago').length > 0 ? overdue.filter(o => o.status !== 'Pago').length : undefined, badgeColor: 'red' },
    { key: 'cartoes', label: 'Cartões', badge: cards.length > 0 ? cards.length : undefined, badgeColor: 'violet' },
    { key: 'planejamento', label: 'Planejamento' },
  ];

  return (
    <div className="h-full overflow-y-auto bg-background text-foreground">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card sticky top-0 z-10">
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
            <DollarSign className="w-4 h-4 text-accent" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Graham</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Gestão Financeira</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { void saveMonthlyPlan(); }}
            disabled={savingPlan}
            className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            title={savingPlan ? 'Salvando previsto...' : 'Salvar despesa prevista'}
          >
            <Save className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={downloadPdf} className="p-2 rounded-lg hover:bg-muted transition-colors" title="Baixar PDF">
            <Download className="w-4 h-4 text-muted-foreground" />
          </button>
          {spreadsheetUrl && (
            <a href={spreadsheetUrl} target="_blank" rel="noreferrer" className="p-2 rounded-lg hover:bg-muted transition-colors" title="Abrir planilha">
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </a>
          )}
        </div>
      </div>

      {/* Calendar Month Picker */}
      <CalendarPicker currentDate={selectedMonth} onChange={setSelectedMonth} />

      {loadError && (
        <div className="px-4 py-2 border-b border-destructive/20 bg-destructive/10 text-destructive text-xs">
          {loadError}
        </div>
      )}

      {/* Main Content */}
      <div className="p-5 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Carregando dados financeiros...</span>
            </div>
          </div>
        ) : (
          <>
            {/* PORTFOLIO BREAKDOWN */}
            <PortfolioBreakdown
              items={[
                {
                  label: 'Receitas',
                  description: `Previsto: ${fmtCurrency(dashboard?.comparison?.plannedIncome ?? 0)}`,
                  value: fmtCurrency(totalsByType.receber),
                  change: `${incomeDelta >= 0 ? '+ ' : ''}${fmtCurrency(incomeDelta)}`,
                  positive: incomeDelta >= 0,
                  color: 'hsl(var(--chart-green))',
                },
                {
                  label: 'Despesas',
                  description: `Previsto: ${fmtCurrency(dashboard?.comparison?.plannedExpenses ?? 0)}`,
                  value: fmtCurrency(totalsByType.pagar),
                  change: `${expensesDelta > 0 ? '+ ' : ''}${fmtCurrency(expensesDelta)}`,
                  positive: expensesDelta <= 0,
                  color: 'hsl(var(--destructive))',
                },
                {
                  label: 'Saldo Líquido',
                  description: 'Resultado do mês',
                  value: fmtCurrency(actualBalance),
                  change: `${balanceDelta >= 0 ? '+ ' : ''}${fmtCurrency(balanceDelta)}`,
                  positive: balanceDelta >= 0,
                  color: actualBalance >= 0 ? 'hsl(var(--chart-blue))' : 'hsl(var(--destructive))',
                },
              ]}
              healthScore={healthScore}
            />

            {/* BALANCE DISTRIBUTION */}
            <BalanceDistribution
              totalBalance={fmtCurrency(totalsByType.pagar)}
              totalBalanceLabel="Total de despesas no mês"
              barData={categoryData.map(item => ({
                label: item.label,
                value: item.pct,
                color: item.color,
              }))}
              legend={categoryData.slice(0, 2).map(item => ({
                name: item.label,
                color: item.color,
              }))}
            />

            {/* TABS SECTION */}
            <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
              {/* Tab header */}
              <div className="flex gap-0 border-b overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => switchTab(tab.key)}
                    className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
                      tab.key === activeTab
                        ? 'border-foreground text-card-foreground'
                        : 'border-transparent text-muted-foreground hover:text-card-foreground'
                    }`}
                  >
                    {tab.label}
                    {tab.badge !== undefined && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        tab.badgeColor === 'red' ? 'bg-destructive/15 text-destructive' :
                        tab.badgeColor === 'amber' ? 'bg-amber-500/15 text-amber-600' :
                        tab.badgeColor === 'green' ? 'bg-accent/15 text-accent' :
                        tab.badgeColor === 'violet' ? 'bg-violet-500/15 text-violet-600' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Action buttons row */}
              {!tabLoading && (
                <div className="px-4 py-3 border-b border-border">
                  {activeTab === 'transacoes' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => openAdd('despesa')}
                        className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-destructive/10 border border-destructive/25 text-destructive hover:bg-destructive/15 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Nova Despesa
                      </button>
                    </div>
                  )}
                  {activeTab === 'fixas' && (
                    <button
                      onClick={() => openAdd('despesa')}
                      className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/25 text-amber-600 hover:bg-amber-500/15 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Nova Despesa Fixa
                    </button>
                  )}
                  {activeTab === 'receitas' && (
                    <button
                      onClick={() => openAdd('receita')}
                      className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-accent/10 border border-accent/25 text-accent hover:bg-accent/15 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Nova Receita
                    </button>
                  )}
                  {activeTab === 'dividas' && (
                    <button
                      onClick={() => openAdd('divida')}
                      className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/25 text-amber-600 hover:bg-amber-500/15 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Nova Dívida
                    </button>
                  )}
                  {activeTab === 'atrasadas' && (
                    <button
                      onClick={() => openAdd('atrasada')}
                      className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-destructive/10 border border-destructive/25 text-destructive hover:bg-destructive/15 transition-colors"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Nova Conta Atrasada
                    </button>
                  )}
                  {activeTab === 'cartoes' && (
                    <button
                      onClick={() => openAdd('cartao')}
                      className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-violet-500/10 border border-violet-500/25 text-violet-600 hover:bg-violet-500/15 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Novo Cartão
                    </button>
                  )}
                  {activeTab === 'planejamento' && (
                    <span className="text-xs text-muted-foreground">Visão geral do planejamento financeiro</span>
                  )}
                </div>
              )}

              {/* Tab content */}
              <div>
                {tabLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                ) : activeTab === 'transacoes' ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Data</th>
                          <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Categoria</th>
                          <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Descrição</th>
                          <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Valor</th>
                          <th className="text-center px-4 py-2.5 text-muted-foreground font-medium">Efetivação</th>
                          <th className="px-4 py-2.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {variableExpenses.map((tx) => (
                          <tr key={`${tx.source}-${tx.index}`} className="border-t border-border hover:bg-muted/30 transition-colors group">
                            <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{fmtDate(tx.date)}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">{tx.category}</td>
                            <td className="px-4 py-2.5 text-card-foreground">{tx.description}</td>
                            <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-destructive">
                              - {fmtCurrency(tx.amount)}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => { void setExpenseEffective(tx, false); }}
                                  title="Marcar como previsto"
                                  className={`h-6 w-6 rounded-md border transition-colors ${
                                    !tx.isEffective
                                      ? 'border-amber-400/60 text-amber-600 bg-amber-500/10'
                                      : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                                  }`}
                                >
                                  <X className="w-3 h-3 mx-auto" />
                                </button>
                                <button
                                  onClick={() => { void setExpenseEffective(tx, true); }}
                                  title="Marcar como efetivado"
                                  className={`h-6 w-6 rounded-md border transition-colors ${
                                    tx.isEffective
                                      ? 'border-accent/60 text-accent bg-accent/10'
                                      : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                                  }`}
                                >
                                  <Check className="w-3 h-3 mx-auto" />
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openEditTx(tx)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button onClick={() => { void deleteTx(tx); }} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {variableExpenses.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-10 text-center">
                              <div className="text-muted-foreground text-xs">Nenhuma despesa variável registrada neste mês</div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : activeTab === 'fixas' ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Descrição</th>
                          <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Categoria</th>
                          <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Valor</th>
                          <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Dia</th>
                          <th className="text-center px-4 py-2.5 text-muted-foreground font-medium">Status</th>
                          <th className="px-4 py-2.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {recurring.map((r) => (
                          <tr key={r.id} className={`border-t border-border hover:bg-muted/30 transition-colors group ${!r.active ? 'opacity-50' : ''}`}>
                            <td className="px-4 py-2.5 text-card-foreground">{r.description}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">{r.category}</td>
                            <td className="px-4 py-2.5 text-right text-card-foreground font-medium tabular-nums">{fmtCurrency(r.amount)}</td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">dia {r.dayOfMonth}</td>
                            <td className="px-4 py-2.5 text-center">
                              <button
                                onClick={() => { void toggleRecurring(r); }}
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors cursor-pointer ${
                                  r.active
                                    ? 'bg-accent/15 text-accent border-accent/20 hover:bg-accent/20'
                                    : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                                }`}
                              >
                                {r.active ? 'Ativa' : 'Inativa'}
                              </button>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { void deleteRecurring(r.id); }} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {recurring.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-10 text-center">
                              <div className="text-muted-foreground text-xs">Nenhuma despesa fixa cadastrada</div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : activeTab === 'receitas' ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Data</th>
                          <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Categoria</th>
                          <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Descrição</th>
                          <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Valor</th>
                          <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Efetivado</th>
                          <th className="text-center px-4 py-2.5 text-muted-foreground font-medium">Status</th>
                          <th className="px-4 py-2.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {incomeTransactions.map((tx) => (
                          <tr key={`${tx.source}-${tx.index}`} className="border-t border-border hover:bg-muted/30 transition-colors group">
                            <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{fmtDate(tx.date)}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">{tx.category}</td>
                            <td className="px-4 py-2.5 text-card-foreground">{tx.description}</td>
                            <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-accent">
                              + {fmtCurrency(tx.amount)}
                            </td>
                            <td className="px-4 py-2.5 text-xs">
                              {tx.isEffective && tx.effectiveAmount !== null && tx.effectiveAmount !== undefined && Math.abs(tx.effectiveAmount - tx.amount) > 0.009 ? (
                                <span className="text-accent font-semibold">{fmtCurrency(tx.effectiveAmount)}</span>
                              ) : tx.isEffective ? (
                                <span className="text-muted-foreground">Mesmo valor</span>
                              ) : (
                                <span className="text-amber-600">Não efetivada</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => { void setIncomeEffective(tx, false); }}
                                  title="Marcar como previsto"
                                  className={`h-6 w-6 rounded-md border transition-colors ${
                                    !tx.isEffective
                                      ? 'border-amber-400/60 text-amber-600 bg-amber-500/10'
                                      : 'border-border text-muted-foreground hover:bg-muted'
                                  }`}
                                >
                                  <X className="w-3 h-3 mx-auto" />
                                </button>
                                <button
                                  onClick={() => { void setIncomeEffective(tx, true); }}
                                  title="Marcar como efetivado"
                                  className={`h-6 w-6 rounded-md border transition-colors ${
                                    tx.isEffective
                                      ? 'border-accent/60 text-accent bg-accent/10'
                                      : 'border-border text-muted-foreground hover:bg-muted'
                                  }`}
                                >
                                  <Check className="w-3 h-3 mx-auto" />
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openEditTx(tx)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button onClick={() => { void deleteTx(tx); }} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {incomeTransactions.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-4 py-10 text-center">
                              <div className="text-muted-foreground text-xs">Nenhuma receita registrada neste mês</div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : activeTab === 'dividas' ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Credor</th>
                          <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Valor total</th>
                          <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Parcelas</th>
                          <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Parcela</th>
                          <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Vencimento</th>
                          <th className="px-4 py-2.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {debts.map((d) => (
                          <tr key={`${d.source}-${d.index}`} className="border-t border-border hover:bg-muted/30 transition-colors group">
                            <td className="px-4 py-2.5 text-card-foreground font-medium">{d.creditor}</td>
                            <td className="px-4 py-2.5 text-right text-amber-600 font-semibold tabular-nums">{fmtCurrency(d.totalAmount)}</td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">{d.remainingInstallments || '-'}</td>
                            <td className="px-4 py-2.5 text-right text-card-foreground tabular-nums">{fmtCurrency(d.monthlyInstallment)}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground tabular-nums">{fmtDate(d.dueDate)}</span>
                                <OverdueBadge days={d.daysOverdue} />
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { void payDebtInstallment(d); }} className="h-6 px-2 rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">Parcela</button>
                                <button onClick={() => { void payDebtFull(d); }} className="h-6 px-2 rounded-md border border-accent/30 text-accent/70 hover:bg-accent/10 hover:text-accent transition-colors">Quitar</button>
                                <button onClick={() => { void deleteDebt(d); }} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {debts.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-10 text-center">
                              <div className="text-muted-foreground text-xs">Nenhuma dívida cadastrada</div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : activeTab === 'atrasadas' ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[440px] text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Conta</th>
                          <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Valor</th>
                          <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Vencimento</th>
                          <th className="px-4 py-2.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {overdue.map((o) => {
                          const isPaid = o.status === 'Pago';
                          return (
                            <tr key={`${o.source}-${o.index}`} className={`border-t border-border transition-colors group ${isPaid ? 'opacity-60' : 'hover:bg-muted/30'}`}>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  {isPaid && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent/15 text-accent">
                                      ✓ Pago
                                    </span>
                                  )}
                                  <span className={`font-medium ${isPaid ? 'text-muted-foreground line-through' : 'text-card-foreground'}`}>{o.account}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums">
                                {isPaid ? (
                                  <span className="text-accent/70 font-semibold">{fmtCurrency(o.paidAmount ?? o.overdueAmount)}</span>
                                ) : (
                                  <span className="text-destructive font-semibold">{fmtCurrency(o.overdueAmount)}</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  {isPaid ? (
                                    <span className="text-muted-foreground tabular-nums text-xs">pago em {fmtDate(o.paidAt ?? '')}</span>
                                  ) : (
                                    <>
                                      <span className="text-muted-foreground tabular-nums">{fmtDate(o.dueDate)}</span>
                                      <OverdueBadge days={o.daysOverdue} />
                                    </>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                  {isPaid ? (
                                    <button onClick={() => { void undoOverduePay(o); }} className="h-6 px-2 rounded-md border border-amber-500/30 text-amber-600 hover:bg-amber-500/10 transition-colors text-xs font-medium">Desfazer</button>
                                  ) : (
                                    <button onClick={() => openOverduePay(o)} className="h-6 px-2 rounded-md border border-accent/30 text-accent hover:bg-accent/10 transition-colors text-xs font-medium">Pagar</button>
                                  )}
                                  <button onClick={() => { void deleteOverdue(o); }} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {overdue.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-4 py-10 text-center">
                              <div className="text-muted-foreground text-xs">Nenhuma conta atrasada</div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : activeTab === 'cartoes' ? (
                  <div className="p-4 space-y-3">
                    {cards.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border p-8 text-center">
                        <div className="text-2xl mb-2">💳</div>
                        <p className="text-sm text-muted-foreground">Nenhum cartão cadastrado</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Clique em &quot;Novo Cartão&quot; para adicionar</p>
                      </div>
                    ) : (
                      cards.map((card) => (
                        <div key={card.id} className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
                                <CreditCard className="w-5 h-5 text-violet-500" />
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-card-foreground">{card.name}</div>
                                <div className="text-xs text-muted-foreground">{card.bank} · {card.brand}</div>
                              </div>
                            </div>
                            <button
                              onClick={() => { void deleteCard(card.id); }}
                              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-lg bg-muted px-2 py-1.5">
                              <div className="text-[10px] text-muted-foreground mb-0.5">Fechamento</div>
                              <div className="text-xs font-semibold text-card-foreground">dia {card.closingDay}</div>
                            </div>
                            <div className="rounded-lg bg-muted px-2 py-1.5">
                              <div className="text-[10px] text-muted-foreground mb-0.5">Vencimento</div>
                              <div className="text-xs font-semibold text-card-foreground">dia {card.dueDay}</div>
                            </div>
                            <div className="rounded-lg bg-muted px-2 py-1.5">
                              <div className="text-[10px] text-muted-foreground mb-0.5">Limite</div>
                              <div className="text-xs font-semibold text-card-foreground">{card.cardLimit > 0 ? fmtCurrency(card.cardLimit) : '—'}</div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  /* PLANEJAMENTO */
                  <div className="p-4 space-y-4">
                    <div className="rounded-xl border border-border bg-muted/30 p-4">
                      <h3 className="text-sm font-semibold text-card-foreground mb-1">Previsto x Efetivado</h3>
                      <p className="text-[11px] text-muted-foreground mb-4">Receitas, despesas e saldo do mês selecionado</p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium block mb-1.5">Receita Prevista</label>
                          <div className="h-10 rounded-lg bg-card border border-border px-3 text-sm text-card-foreground flex items-center tabular-nums">
                            {fmtCurrency(dashboard?.comparison?.plannedIncome ?? 0)}
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium block mb-1.5">Despesa Prevista</label>
                          <input
                            value={plannedExpensesInput}
                            onChange={(e) => setPlannedExpensesInput(formatCurrencyInput(e.target.value))}
                            type="text"
                            inputMode="numeric"
                            placeholder="R$ 0,00"
                            className="h-10 w-full rounded-lg bg-card border border-border px-3 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors tabular-nums"
                          />
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="rounded-lg bg-accent/10 border border-accent/20 p-3">
                          <div className="text-[10px] uppercase tracking-wider text-accent/70 mb-1">Receitas</div>
                          <div className="text-xs text-muted-foreground">Previsto: <span className="font-semibold text-card-foreground">{fmtCurrency(dashboard?.comparison?.plannedIncome ?? 0)}</span></div>
                          <div className="text-xs text-muted-foreground">Efetivado: <span className="font-semibold text-card-foreground">{fmtCurrency(dashboard?.comparison?.actualIncome ?? 0)}</span></div>
                          <div className={`text-xs font-semibold mt-1 ${(dashboard?.comparison?.incomeDelta ?? 0) >= 0 ? 'text-accent' : 'text-destructive'}`}>
                            Diferença: {fmtCurrency(dashboard?.comparison?.incomeDelta ?? 0)}
                          </div>
                        </div>
                        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                          <div className="text-[10px] uppercase tracking-wider text-destructive/70 mb-1">Despesas</div>
                          <div className="text-xs text-muted-foreground">Previsto: <span className="font-semibold text-card-foreground">{fmtCurrency(dashboard?.comparison?.plannedExpenses ?? 0)}</span></div>
                          <div className="text-xs text-muted-foreground">Efetivado: <span className="font-semibold text-card-foreground">{fmtCurrency(dashboard?.comparison?.actualExpenses ?? 0)}</span></div>
                          <div className={`text-xs font-semibold mt-1 ${(dashboard?.comparison?.expensesDelta ?? 0) <= 0 ? 'text-accent' : 'text-destructive'}`}>
                            Diferença: {fmtCurrency(dashboard?.comparison?.expensesDelta ?? 0)}
                          </div>
                        </div>
                        <div className="rounded-lg bg-muted border border-border p-3">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Saldo</div>
                          <div className="text-xs text-muted-foreground">Previsto: <span className="font-semibold text-card-foreground">{fmtCurrency(dashboard?.comparison?.plannedBalance ?? 0)}</span></div>
                          <div className="text-xs text-muted-foreground">Efetivado: <span className="font-semibold text-card-foreground">{fmtCurrency(dashboard?.comparison?.actualBalance ?? 0)}</span></div>
                          <div className={`text-xs font-semibold mt-1 ${(dashboard?.comparison?.balanceDelta ?? 0) >= 0 ? 'text-accent' : 'text-destructive'}`}>
                            Diferença: {fmtCurrency(dashboard?.comparison?.balanceDelta ?? 0)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-muted/30 p-4">
                      <h3 className="text-sm font-semibold text-card-foreground mb-4">Próximos Vencimentos</h3>
                      <div className="space-y-2">
                        {[...debts, ...overdue].length === 0 ? (
                          <div className="text-muted-foreground text-xs text-center py-6">Nenhum vencimento agendado</div>
                        ) : (
                          debts.slice(0, 3).map((d) => (
                            <div key={`${d.source}-${d.index}`} className="flex items-center justify-between py-2 px-3 rounded-lg bg-card border border-border">
                              <div>
                                <div className="text-xs font-medium text-card-foreground">{d.creditor}</div>
                                <div className="text-[10px] text-muted-foreground">{fmtDate(d.dueDate)}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs font-semibold text-amber-600">{fmtCurrency(d.monthlyInstallment)}</div>
                                <div className={`text-[10px] ${d.daysOverdue > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                  {d.daysOverdue > 0 ? `${d.daysOverdue}d atraso` : 'Em dia'}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal de efetivação */}
      {effectiveTx && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0d1117] border border-emerald-500/25 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-emerald-500/20 bg-emerald-500/8 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-sm">✓</div>
                <h3 className="text-sm font-semibold text-white/90">Efetivar receita</h3>
              </div>
              <button onClick={closeEffectiveModal} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white/90 transition-colors" disabled={effectiveSaving}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div className="text-xs text-white/70">
                <div className="font-medium text-white/90">{effectiveTx.description}</div>
                <div className="text-white/55 mt-0.5">Previsto: <span className="font-semibold text-white/85">{fmtCurrency(effectiveTx.amount)}</span></div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setEffectiveUseCustomValue(false)}
                  className={`h-9 rounded-lg text-xs font-semibold border transition-colors ${!effectiveUseCustomValue ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-white/5 border-white/15 text-white/60 hover:bg-white/8'}`}
                >
                  Usar previsto
                </button>
                <button
                  onClick={() => setEffectiveUseCustomValue(true)}
                  className={`h-9 rounded-lg text-xs font-semibold border transition-colors ${effectiveUseCustomValue ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-white/5 border-white/15 text-white/60 hover:bg-white/8'}`}
                >
                  Informar outro
                </button>
              </div>

              {effectiveUseCustomValue && (
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Valor efetivado (R$)</label>
                  <input
                    value={effectiveCustomValue}
                    onChange={(e) => setEffectiveCustomValue(formatCurrencyInput(e.target.value))}
                    type="text"
                    inputMode="numeric"
                    placeholder="R$ 0,00"
                    className={inputClass}
                  />
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={closeEffectiveModal} disabled={effectiveSaving} className="flex-1 h-10 rounded-xl text-sm font-semibold bg-white/5 border border-white/15 text-white/70 hover:bg-white/10 transition-colors disabled:opacity-50">
                  Cancelar
                </button>
                <button onClick={() => { void confirmEffectiveModal(); }} disabled={effectiveSaving} className="flex-1 h-10 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors disabled:opacity-50">
                  {effectiveSaving ? 'Efetivando...' : 'Efetivar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal pagamento conta atrasada */}
      {overduePayModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0d1117] border border-red-500/25 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-red-500/20 bg-red-500/8 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center text-sm">💸</div>
                <h3 className="text-sm font-semibold text-white/90">Pagar conta atrasada</h3>
              </div>
              <button
                onClick={() => { if (!overduePaySaving) { setOverduePayModal(null); setOverduePayInput(''); } }}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white/90 transition-colors"
                disabled={overduePaySaving}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <div className="font-medium text-white/90 text-sm">{overduePayModal.account}</div>
                <div className="text-xs text-white/50 mt-0.5">
                  Valor original: <span className="font-semibold text-red-300">{fmtCurrency(overduePayModal.overdueAmount)}</span>
                  {overduePayModal.daysOverdue > 0 && (
                    <span className="ml-2 text-amber-400">{overduePayModal.daysOverdue}d em atraso</span>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Valor a pagar (informe se houver juros)</label>
                <input
                  value={overduePayInput}
                  onChange={(e) => setOverduePayInput(formatCurrencyInput(e.target.value))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void confirmOverduePay(); } }}
                  type="text"
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  className={inputClass}
                  autoFocus
                />
                {(() => {
                  const entered = parseCurrencyInput(overduePayInput);
                  const diff = Number.isFinite(entered) ? entered - overduePayModal.overdueAmount : 0;
                  if (diff > 0.009) return (
                    <div className="text-[11px] text-amber-400 mt-1.5">
                      Juros/multa: +{fmtCurrency(diff)} — será lançado no extrato com o valor total
                    </div>
                  );
                  return null;
                })()}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { if (!overduePaySaving) { setOverduePayModal(null); setOverduePayInput(''); } }}
                  disabled={overduePaySaving}
                  className="flex-1 h-10 rounded-xl text-sm font-semibold bg-white/5 border border-white/15 text-white/70 hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => { void confirmOverduePay(); }}
                  disabled={overduePaySaving || !Number.isFinite(parseCurrencyInput(overduePayInput)) || parseCurrencyInput(overduePayInput) <= 0}
                  className="flex-1 h-10 rounded-xl text-sm font-semibold bg-red-500 hover:bg-red-400 text-white transition-colors disabled:opacity-50"
                >
                  {overduePaySaving ? 'Pagando...' : 'Confirmar pagamento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal add/edit */}
      {mode && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

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

            <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
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
                    <select value={txCategory} onChange={(e) => setTxCategory(e.target.value)} className={inputClass}>
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
                        <div>
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
                        </div>
                      )}
                    </div>
                  )}
                  {mode === 'despesa' && !editingTx && (
                    <label className="flex items-center gap-2.5 text-xs text-white/70 cursor-pointer select-none">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${txIsFixed ? 'bg-emerald-500 border-emerald-500' : 'border-white/20 bg-transparent'}`}>
                        {txIsFixed && <span className="text-white text-[10px]">✓</span>}
                      </div>
                      <input
                        type="checkbox"
                        checked={txIsFixed}
                        onChange={e => {
                          const checked = e.target.checked;
                          setTxIsFixed(checked);
                          if (!checked) { setTxFixedDueDay(''); setTxHasOverdueFixed(false); setTxFixedOverdueEntries([]); }
                        }}
                        className="sr-only"
                      />
                      Despesa fixa (repete todo mês)
                    </label>
                  )}
                  {mode === 'despesa' && !editingTx && txIsFixed && (
                    <div className="space-y-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                      <div>
                        <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Dia de vencimento</label>
                        <input
                          value={txFixedDueDay}
                          onChange={e => setTxFixedDueDay(e.target.value)}
                          type="number"
                          min={1}
                          max={31}
                          placeholder="Ex: 10"
                          className={inputClass}
                        />
                      </div>

                      <label className="flex items-center gap-2.5 text-xs text-white/70 cursor-pointer select-none">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${txHasOverdueFixed ? 'bg-red-500 border-red-500' : 'border-white/20 bg-transparent'}`}>
                          {txHasOverdueFixed && <span className="text-white text-[10px]">✓</span>}
                        </div>
                        <input
                          type="checkbox"
                          checked={txHasOverdueFixed}
                          onChange={e => {
                            const checked = e.target.checked;
                            setTxHasOverdueFixed(checked);
                            if (checked && txFixedOverdueEntries.length === 0) setTxFixedOverdueEntries([{ dueDate: '', amount: txAmount }]);
                            if (!checked) setTxFixedOverdueEntries([]);
                          }}
                          className="sr-only"
                        />
                        Existe alguma conta desta despesa atrasada?
                      </label>

                      {txHasOverdueFixed && (
                        <div className="space-y-2">
                          {txFixedOverdueEntries.map((entry, idx) => (
                            <div key={`fixed-overdue-${idx}`} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                              <div>
                                <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Vencimento</label>
                                <input
                                  value={entry.dueDate}
                                  onChange={e => {
                                    const next = [...txFixedOverdueEntries];
                                    next[idx] = { ...next[idx], dueDate: e.target.value };
                                    setTxFixedOverdueEntries(next);
                                  }}
                                  type="date"
                                  className={inputClass}
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Valor atrasado</label>
                                <input
                                  value={entry.amount}
                                  onChange={e => {
                                    const next = [...txFixedOverdueEntries];
                                    next[idx] = { ...next[idx], amount: formatCurrencyInput(e.target.value) };
                                    setTxFixedOverdueEntries(next);
                                  }}
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="R$ 0,00"
                                  className={inputClass}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => setTxFixedOverdueEntries(txFixedOverdueEntries.filter((_, i) => i !== idx))}
                                className="h-10 w-10 rounded-lg border border-rose-500/35 text-rose-300 hover:bg-rose-500/15 transition-colors disabled:opacity-50"
                                disabled={txFixedOverdueEntries.length <= 1}
                              >
                                <Trash2 className="w-3.5 h-3.5 mx-auto" />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => setTxFixedOverdueEntries(prev => [...prev, { dueDate: '', amount: txAmount }])}
                            className="h-8 px-3 rounded-lg text-xs font-medium bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 transition-colors"
                          >
                            + Adicionar outra conta atrasada
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    disabled={saving}
                    onClick={saveTx}
                    className={`w-full h-10 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                      mode === 'receita' ? 'bg-emerald-500 hover:bg-emerald-400 text-white' : 'bg-rose-500 hover:bg-rose-400 text-white'
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
                      <input value={debtAmount} onChange={e => setDebtAmount(formatCurrencyInput(e.target.value))} type="text" inputMode="numeric" placeholder="R$ 0,00" className={inputClass} />
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
                      <input value={debtMonthly} onChange={e => setDebtMonthly(formatCurrencyInput(e.target.value))} type="text" inputMode="numeric" placeholder="R$ 0,00" className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Data de vencimento</label>
                    <input value={debtDueDate} onChange={e => setDebtDueDate(e.target.value)} type="date" className={inputClass} />
                  </div>
                  <button disabled={saving} onClick={() => { void saveDebt(); }} className="w-full h-10 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold transition-colors disabled:opacity-50">
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
                    <input value={overdueAmount} onChange={e => setOverdueAmount(formatCurrencyInput(e.target.value))} type="text" inputMode="numeric" placeholder="R$ 0,00" className={inputClass} />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Data de vencimento</label>
                    <input value={overdueDueDate} onChange={e => setOverdueDueDate(e.target.value)} type="date" className={inputClass} />
                  </div>
                  <button disabled={saving} onClick={() => { void saveOverdue(); }} className="w-full h-10 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                    {saving ? 'Salvando...' : 'Salvar conta atrasada'}
                  </button>
                </>
              )}

              {mode === 'cartao' && (
                <>
                  <input placeholder="Nome do cartão (ex: Nubank Principal)" value={cardName} onChange={(e) => setCardName(e.target.value)} className={inputClass} />
                  <input placeholder="Banco (ex: Nubank, Itaú, Bradesco)" value={cardBank} onChange={(e) => setCardBank(e.target.value)} className={inputClass} />
                  <select value={cardBrand} onChange={(e) => setCardBrand(e.target.value)} className={inputClass}>
                    {CARD_BRANDS.map(b => (
                      <option key={b} value={b} style={{ background: '#0d1117' }}>{b}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" placeholder="Dia fechamento (1-31)" value={cardClosingDay} onChange={(e) => setCardClosingDay(e.target.value)} min={1} max={31} className={inputClass} />
                    <input type="number" placeholder="Dia vencimento (1-31)" value={cardDueDay} onChange={(e) => setCardDueDay(e.target.value)} min={1} max={31} className={inputClass} />
                  </div>
                  <input type="text" inputMode="numeric" placeholder="Limite (opcional) - R$ 0,00" value={cardLimit} onChange={(e) => setCardLimit(formatCurrencyInput(e.target.value))} className={inputClass} />
                  <button disabled={saving} onClick={() => { void saveCard(); }} className="w-full h-10 rounded-xl bg-violet-500 hover:bg-violet-400 text-white text-sm font-semibold transition-colors disabled:opacity-50">
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
