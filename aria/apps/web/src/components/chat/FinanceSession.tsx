'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  AlertTriangle,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  DollarSign,
  Download,
  ExternalLink,
  Check,
  Home,
  LayoutList,
  Target,
  Link2,
  MoreHorizontal,
  Search,
  Save,
  Loader2,
  Pencil,
  Plus,
  TrendingDown,
  Trash2,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { addMonths, format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PortfolioBreakdown } from './graham/PortfolioBreakdown';
import { BalanceDistribution } from './graham/BalanceDistribution';
import { HealthScoreGauge } from './graham/HealthScoreGauge';
import { PortfolioPerformance } from './graham/PortfolioPerformance';
import { GoalsSession } from './graham/GoalsSession';

type TxType = 'receita' | 'despesa';
type SourceType = 'local' | 'sheets' | 'supabase';
type AddMode = 'receita' | 'despesa' | 'divida' | 'atrasada' | 'cartao';
type ActiveTab = 'transacoes' | 'fixas' | 'receitas' | 'dividas' | 'atrasadas' | 'cartoes' | 'planejamento';
type SidebarView = 'home' | 'receitas' | 'cartoes' | 'dividas' | 'planejamento';

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
    projected?: boolean;
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

function safeKeyPart(value: unknown): string {
  if (value === null || value === undefined) return 'na';
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : 'empty';
}

function parseYmdLocal(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const dt = new Date(y, mo, d);
    return Number.isFinite(dt.getTime()) ? dt : null;
  }
  const dt = new Date(value);
  return Number.isFinite(dt.getTime()) ? dt : null;
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
  'Dívida',
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
const TRANSACTIONS_PER_PAGE = 10;

function CalendarPicker({ currentDate, onChange }: { currentDate: Date; onChange: (d: Date) => void }) {
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(currentDate.getFullYear());

  useEffect(() => {
    setPickerYear(currentDate.getFullYear());
  }, [currentDate]);

  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-border">
      <button
        onClick={() => onChange(subMonths(currentDate, 1))}
        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        title="Mês anterior"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsMonthPickerOpen((prev) => !prev)}
          className="px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/25 text-accent text-sm font-medium hover:bg-accent/15 transition-colors inline-flex items-center gap-2 select-none"
        >
          <CalendarDays className="w-3.5 h-3.5" />
          <span className="capitalize">{format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}</span>
        </button>
        {isMonthPickerOpen && (
          <div className="absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 z-20 w-72 rounded-xl border border-border bg-card shadow-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => setPickerYear((y) => y - 1)}
                className="h-7 w-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Ano anterior"
              >
                <ChevronLeft className="w-4 h-4 mx-auto" />
              </button>
              <span className="text-sm font-semibold text-card-foreground tabular-nums">{pickerYear}</span>
              <button
                type="button"
                onClick={() => setPickerYear((y) => y + 1)}
                className="h-7 w-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Próximo ano"
              >
                <ChevronRight className="w-4 h-4 mx-auto" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 12 }, (_, monthIdx) => {
                const monthDate = new Date(pickerYear, monthIdx, 1);
                const isActive = currentDate.getFullYear() === pickerYear && currentDate.getMonth() === monthIdx;
                return (
                  <button
                    key={`${pickerYear}-${monthIdx}`}
                    type="button"
                    onClick={() => {
                      onChange(monthDate);
                      setIsMonthPickerOpen(false);
                    }}
                    className={`h-8 rounded-md text-xs font-medium transition-colors capitalize ${
                      isActive
                        ? 'bg-accent/15 border border-accent/35 text-accent'
                        : 'bg-muted/30 border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {format(monthDate, 'MMM', { locale: ptBR })}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
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
  const DASHBOARD_AUTO_REFRESH_MS = 10_000;
  const sessionScrollRef = useRef<HTMLDivElement | null>(null);
  const dashboardRefreshInFlightRef = useRef(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [aprilDashboard, setAprilDashboard] = useState<DashboardData | null>(null);
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [overdue, setOverdue] = useState<OverdueRecord[]>([]);
  const [recurring, setRecurring] = useState<RecurringExpenseRecord[]>([]);
  const [cards, setCards] = useState<CreditCardRecord[]>([]);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('transacoes');
  const [activeView, setActiveView] = useState<SidebarView>('home');
  const [transactionsPage, setTransactionsPage] = useState(1);
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
  const [editingRecurring, setEditingRecurring] = useState<RecurringExpenseRecord | null>(null);
  const [recurringEditDescription, setRecurringEditDescription] = useState('');
  const [recurringEditCategory, setRecurringEditCategory] = useState('Outros');
  const [recurringEditAmount, setRecurringEditAmount] = useState('');
  const [recurringEditDay, setRecurringEditDay] = useState('');
  const [recurringEditSaving, setRecurringEditSaving] = useState(false);
  const [txFilterCategory, setTxFilterCategory] = useState('all');
  const [txFilterDateFrom, setTxFilterDateFrom] = useState('');
  const [txFilterDateTo, setTxFilterDateTo] = useState('');
  const [txFilterDescription, setTxFilterDescription] = useState('');
  const [txFilterMinValue, setTxFilterMinValue] = useState('');
  const [txFilterMaxValue, setTxFilterMaxValue] = useState('');
  const [isTxFiltersOpen, setIsTxFiltersOpen] = useState(false);

  const parseAmount = (value: unknown): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value !== 'string') return 0;
    const normalized = value.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const normalizeText = (value: unknown): string => String(value ?? '').trim().toLowerCase();
  const monthKeyFromDate = (value: string | null | undefined): string | null => {
    const d = parseYmdLocal(value);
    if (!d) return null;
    return monthParam(d);
  };

  const loadAll = useCallback(async (opts?: { showLoading?: boolean }) => {
    const showLoading = opts?.showLoading ?? true;
    if (showLoading) setLoading(true);
    try {
      const month = monthParam(selectedMonth);
      const aprilMonth = monthParam(new Date(selectedMonth.getFullYear(), 3, 1));
      const [dRes, aprilRes, debtRes, overdueRes, recurringRes, sheetRes, cardsRes] = await Promise.all([
        fetch(`/api/finance/dashboard?month=${month}`),
        fetch(`/api/finance/dashboard?month=${aprilMonth}`),
        fetch(`/api/finance/debts`),
        fetch(`/api/finance/overdue`),
        fetch(`/api/finance/recurring-expenses`),
        fetch(`/api/finance/spreadsheet`),
        fetch(`/api/finance/credit-cards`),
      ]);

      let dData = await dRes.json();
      const aprilData = await aprilRes.json();

      const isAfterApril = selectedMonth.getMonth() > 3;
      const monthYear = selectedMonth.getFullYear();
      const monthIndex = selectedMonth.getMonth();
      const monthMaxDay = new Date(monthYear, monthIndex + 1, 0).getDate();

      if (isAfterApril) {
        const existingIncome = (dData?.transactions ?? []).filter((tx: DashboardData['transactions'][number]) => tx.type === 'receita');
        const aprilIncome = (aprilData?.transactions ?? []).filter((tx: DashboardData['transactions'][number]) => tx.type === 'receita');

        const normalizeText = (value: string) => String(value ?? '').trim().toLowerCase();
        const buildKey = (tx: DashboardData['transactions'][number], normalizedDate: string) =>
          `${normalizeText(tx.category)}|${normalizeText(tx.description)}|${parseAmount(tx.amount).toFixed(2)}|${normalizedDate}`;

        const normalizeToCurrentMonthDate = (rawDate: string) => {
          const parsedDate = parseYmdLocal(rawDate) ?? new Date(monthYear, monthIndex, 1);
          const sourceDay = parsedDate.getDate();
          const clampedDay = Math.max(1, Math.min(sourceDay, monthMaxDay));
          return format(new Date(monthYear, monthIndex, clampedDay), 'yyyy-MM-dd');
        };

        const existingKeys = new Set(
          existingIncome.map((tx: DashboardData['transactions'][number]) => buildKey(tx, normalizeToCurrentMonthDate(tx.date)))
        );

        const missingIncome = aprilIncome.filter((tx: DashboardData['transactions'][number]) => {
          const normalizedDate = normalizeToCurrentMonthDate(tx.date);
          const key = buildKey(tx, normalizedDate);
          return !existingKeys.has(key);
        });

        if (missingIncome.length > 0) {
          await Promise.all(
            missingIncome.map((tx: DashboardData['transactions'][number]) => {
              const targetDate = normalizeToCurrentMonthDate(tx.date);
              return fetch(`/api/finance/transaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'receita',
                  description: tx.description,
                  category: tx.category,
                  amount: parseAmount(tx.amount),
                  isEffective: tx.isEffective,
                  date: targetDate,
                }),
              });
            })
          );

          const refreshedDashboardRes = await fetch(`/api/finance/dashboard?month=${month}`);
          dData = await refreshedDashboardRes.json();
        }
      }

      setDashboard(dData);
      setAprilDashboard(aprilData);
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
      if (showLoading) setLoading(false);
    }
  }, [selectedMonth]);

  const refreshInline = useCallback(async () => {
    const el = sessionScrollRef.current;
    const prevTop = el?.scrollTop ?? 0;
    await loadAll({ showLoading: false });
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = prevTop;
      });
    }
  }, [loadAll]);

  const refreshDashboardInline = useCallback(async () => {
    const el = sessionScrollRef.current;
    const prevTop = el?.scrollTop ?? 0;
    const month = monthParam(selectedMonth);
    const res = await fetch(`/api/finance/dashboard?month=${month}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error ?? 'Falha ao atualizar dashboard.');
    }
    const dData = await res.json();
    setDashboard(dData);
    setPlannedExpensesInput(formatCurrencyInputFromNumber(Number(dData?.comparison?.plannedExpenses ?? 0)));
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = prevTop;
      });
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const refreshSafely = async () => {
      if (document.hidden || dashboardRefreshInFlightRef.current) return;
      dashboardRefreshInFlightRef.current = true;
      try {
        await refreshDashboardInline();
      } catch {
        // Ignore transient network errors; next tick retries.
      } finally {
        dashboardRefreshInFlightRef.current = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void refreshSafely();
    }, DASHBOARD_AUTO_REFRESH_MS);

    const onVisibilityChange = () => {
      if (!document.hidden) {
        void refreshSafely();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refreshDashboardInline]);

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

  const isFutureOfApril = useMemo(() => selectedMonth.getMonth() > 3, [selectedMonth]);

  const projectedMonthlyBase = useMemo(() => {
    const aprilIncome = parseAmount(aprilDashboard?.comparison?.actualIncome);
    const aprilExpenses = parseAmount(aprilDashboard?.comparison?.actualExpenses);
    const aprilFixedExpensesFromTx = (aprilDashboard?.transactions ?? [])
      .filter((item) => item.type === 'despesa' && item.isRecurring)
      .reduce((acc, item) => acc + parseAmount(item.amount), 0);
    const recurringFixedExpenses = recurring
      .filter((item) => item.active)
      .reduce((acc, item) => acc + parseAmount(item.amount), 0);

    const projectedIncome = aprilIncome > 0 ? aprilIncome : parseAmount(totalsByType.receber);
    const projectedExpense = recurringFixedExpenses > 0
      ? recurringFixedExpenses
      : (aprilFixedExpensesFromTx > 0 ? aprilFixedExpensesFromTx : (aprilExpenses > 0 ? aprilExpenses : parseAmount(totalsByType.pagar)));

    return { projectedIncome, projectedExpense };
  }, [aprilDashboard, recurring, totalsByType.receber, totalsByType.pagar]);

  const performancePoints = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const aprilIndex = 3;
    const aprilIncome = projectedMonthlyBase.projectedIncome;
    const aprilExpenses = parseAmount(aprilDashboard?.comparison?.actualExpenses) || parseAmount(totalsByType.pagar);
    const carriedExpenses = projectedMonthlyBase.projectedExpense;

    return months.map((month, index) => {
      if (index < aprilIndex) {
        return { month, income: null, expense: null };
      }

      if (index === aprilIndex) {
        return { month, income: aprilIncome, expense: aprilExpenses };
      }

      return {
        month,
        income: aprilIncome,
        expense: carriedExpenses,
      };
    });
  }, [aprilDashboard?.comparison?.actualExpenses, projectedMonthlyBase.projectedIncome, projectedMonthlyBase.projectedExpense, totalsByType.pagar]);

  const performanceChange = useMemo(() => {
    const currentIndex = selectedMonth.getMonth();
    if (currentIndex <= 0 || currentIndex >= performancePoints.length) {
      return { label: '-', tone: 'neutral' as const };
    }

    const current = performancePoints[currentIndex];
    const previous = performancePoints[currentIndex - 1];
    if (!current || !previous) return { label: '-', tone: 'neutral' as const };
    if (current.income === null || current.expense === null || previous.income === null || previous.expense === null) {
      return { label: '-', tone: 'neutral' as const };
    }

    const currentBalance = current.income - current.expense;
    const previousBalance = previous.income - previous.expense;
    if (Math.abs(previousBalance) < 0.000001) {
      if (Math.abs(currentBalance) < 0.000001) return { label: '0.0%', tone: 'neutral' as const };
      return { label: '-', tone: 'neutral' as const };
    }

    const pct = ((currentBalance - previousBalance) / Math.abs(previousBalance)) * 100;
    const tone: 'positive' | 'negative' | 'neutral' = pct > 0 ? 'positive' : pct < 0 ? 'negative' : 'neutral';
    return { label: `${pct >= 0 ? '+ ' : ''}${pct.toFixed(1)}%`, tone };
  }, [performancePoints, selectedMonth]);

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
        await fetch(`/api/finance/transaction/${editingTx.index}?source=${editingTx.source}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else if (mode === 'despesa' && txIsFixed) {
        const dayOfMonth = Math.max(1, Math.min(31, Number(txFixedDueDay || '1')));
        await fetch(`/api/finance/recurring-expenses`, {
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
            await fetch(`/api/finance/overdue`, {
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
        await fetch(`/api/finance/transaction`, {
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
      await fetch(`/api/finance/debts`, {
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
      await fetch(`/api/finance/overdue`, {
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
      await fetch(`/api/finance/credit-cards`, {
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
    await fetch(`/api/finance/credit-cards/${id}`, { method: 'DELETE' });
    await loadAll();
  };

  const deleteTx = async (tx: DashboardData['transactions'][number]) => {
    await fetch(`/api/finance/transaction/${tx.index}?source=${tx.source}`, { method: 'DELETE' });
    await loadAll();
  };

  const deleteDebt = async (debt: DebtRecord) => {
    await fetch(`/api/finance/debts/${debt.index}?source=${debt.source}`, { method: 'DELETE' });
    await loadAll();
  };

  const deleteOverdue = async (item: OverdueRecord) => {
    await fetch(`/api/finance/overdue/${item.index}?source=${item.source}`, { method: 'DELETE' });
    await loadAll();
  };

  const payDebtInstallment = async (debt: DebtRecord) => {
    const maybe = window.prompt('Valor da parcela (deixe vazio para usar parcela mensal):', debt.monthlyInstallment ? String(debt.monthlyInstallment) : '');
    const parsed = Number(maybe);
    const body = maybe && Number.isFinite(parsed) && parsed > 0 ? { amount: parsed } : {};
    await fetch(`/api/finance/debts/${debt.index}/pay-installment?source=${debt.source}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    await loadAll();
  };

  const payDebtFull = async (debt: DebtRecord) => {
    await fetch(`/api/finance/debts/${debt.index}/pay-full?source=${debt.source}`, { method: 'POST' });
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
      await fetch(`/api/finance/overdue/${overduePayModal.index}/pay?source=${overduePayModal.source}`, {
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
    await fetch(`/api/finance/overdue/${item.index}/undo-pay?source=${item.source}`, { method: 'POST' });
    await loadAll();
  };

  const toggleRecurring = async (item: RecurringExpenseRecord) => {
    await fetch(`/api/finance/recurring-expenses/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !item.active }),
    });
    await loadAll();
  };

  const deleteRecurring = async (id: number) => {
    await fetch(`/api/finance/recurring-expenses/${id}`, { method: 'DELETE' });
    await loadAll();
  };

  const openEditRecurring = (item: RecurringExpenseRecord) => {
    setEditingRecurring(item);
    setRecurringEditDescription(item.description);
    setRecurringEditCategory(item.category || 'Outros');
    setRecurringEditAmount(formatCurrencyInputFromNumber(item.amount));
    setRecurringEditDay(String(item.dayOfMonth ?? ''));
  };

  const closeRecurringEdit = () => {
    if (recurringEditSaving) return;
    setEditingRecurring(null);
    setRecurringEditDescription('');
    setRecurringEditCategory('Outros');
    setRecurringEditAmount('');
    setRecurringEditDay('');
  };

  const saveRecurringEdit = async () => {
    if (!editingRecurring) return;
    const previousMatches = getRecurringMonthMatches(editingRecurring);
    const description = recurringEditDescription.trim();
    const category = recurringEditCategory.trim();
    const amount = parseCurrencyInput(recurringEditAmount);
    const dayOfMonth = Number(recurringEditDay);

    if (!description || !category) {
      window.alert('Descrição e categoria são obrigatórias.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert('Valor inválido.');
      return;
    }
    if (!Number.isFinite(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
      window.alert('Dia de vencimento inválido.');
      return;
    }

    setRecurringEditSaving(true);
    try {
      const res = await fetch(`/api/finance/recurring-expenses/${editingRecurring.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, category, amount, dayOfMonth }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? 'Falha ao atualizar despesa fixa.');
      }

      // Keep monthly payment row in sync when the fixed expense was already marked as paid.
      if (previousMatches.length > 0) {
        const year = selectedMonth.getFullYear();
        const month = selectedMonth.getMonth();
        const maxDay = new Date(year, month + 1, 0).getDate();
        const normalizedDay = Math.max(1, Math.min(dayOfMonth, maxDay));
        const normalizedDate = format(new Date(year, month, normalizedDay), 'yyyy-MM-dd');

        for (const tx of previousMatches) {
          const txRes = await fetch(`/api/finance/transaction/${tx.index}?source=${tx.source}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'despesa',
              description,
              category,
              amount,
              isEffective: tx.isEffective,
              date: normalizedDate,
            }),
          });
          if (!txRes.ok) {
            const err = await txRes.json().catch(() => ({}));
            throw new Error(err?.error ?? 'Falha ao sincronizar lançamento efetivado da despesa fixa.');
          }
        }
      }

      closeRecurringEdit();
      await refreshInline();
    } catch (err: any) {
      window.alert(err?.message ?? 'Falha ao atualizar despesa fixa.');
    } finally {
      setRecurringEditSaving(false);
    }
  };

  const selectedMonthKey = useMemo(() => monthParam(selectedMonth), [selectedMonth]);

  const getRecurringMonthMatches = useCallback((item: RecurringExpenseRecord) => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const maxDay = new Date(year, month + 1, 0).getDate();
    const dueDay = Math.max(1, Math.min(item.dayOfMonth || 1, maxDay));

    return (dashboard?.transactions ?? []).filter((tx) => {
      if (tx.type !== 'despesa' || !tx.isEffective) return false;
      if (monthKeyFromDate(tx.date) !== selectedMonthKey) return false;
      const txDate = parseYmdLocal(tx.date);
      if (!txDate) return false;
      if (txDate.getDate() !== dueDay) return false;
      const sameDescription = normalizeText(tx.description) === normalizeText(item.description);
      const sameCategory = normalizeText(tx.category) === normalizeText(item.category);
      const sameAmount = Math.abs(parseAmount(tx.amount) - parseAmount(item.amount)) < 0.01;
      return sameDescription && sameCategory && sameAmount;
    });
  }, [dashboard?.transactions, selectedMonth, selectedMonthKey]);

  const recurringPaidMap = useMemo(() => {
    const map = new Map<number, boolean>();
    recurring.forEach((item) => {
      map.set(item.id, getRecurringMonthMatches(item).length > 0);
    });
    return map;
  }, [recurring, getRecurringMonthMatches]);

  const toggleRecurringPayment = async (item: RecurringExpenseRecord) => {
    const matches = getRecurringMonthMatches(item);
    try {
      if (matches.length > 0) {
        for (const target of matches) {
          const res = await fetch(`/api/finance/transaction/${target.index}?source=${target.source}`, { method: 'DELETE' });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err?.error ?? 'Falha ao remover pagamento da despesa fixa.');
          }
        }
        await refreshDashboardInline();
        return;
      }

      const year = selectedMonth.getFullYear();
      const month = selectedMonth.getMonth();
      const maxDay = new Date(year, month + 1, 0).getDate();
      const day = Math.max(1, Math.min(item.dayOfMonth || 1, maxDay));
      const date = format(new Date(year, month, day), 'yyyy-MM-dd');

      const res = await fetch(`/api/finance/transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'despesa',
          description: item.description,
          category: item.category,
          amount: parseAmount(item.amount),
          isEffective: true,
          date,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? 'Falha ao registrar pagamento da despesa fixa.');
      }

      await refreshDashboardInline();
    } catch (err: any) {
      window.alert(err?.message ?? 'Falha ao atualizar pagamento da despesa fixa.');
    }
  };

  const downloadPdf = async () => {
    const month = monthParam(selectedMonth);
    const res = await fetch(`/api/finance/report/pdf?month=${month}`);
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
      const res = await fetch(`/api/finance/monthly-plan`, {
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

  useEffect(() => {
    setTransactionsPage(1);
  }, [selectedMonth, activeView, activeTab, txFilterCategory, txFilterDateFrom, txFilterDateTo, txFilterDescription, txFilterMinValue, txFilterMaxValue]);

  const setIncomeEffective = async (tx: DashboardData['transactions'][number], isEffective: boolean) => {
    if (tx.type !== 'receita') return;
    if (tx.isEffective === isEffective) return;

    if (!isEffective) {
      setDashboard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          transactions: prev.transactions.map((item) =>
            item.index === tx.index && item.source === tx.source
              ? { ...item, isEffective: false, effectiveAmount: null }
              : item
          ),
        };
      });
      void (async () => {
        try {
          const res = await fetch(`/api/finance/transaction/${tx.index}/effective?source=${tx.source}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isEffective: false }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err?.error ?? 'Falha ao atualizar efetivacao da receita.');
          }
          void refreshDashboardInline();
        } catch (err: any) {
          setDashboard((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              transactions: prev.transactions.map((item) =>
                item.index === tx.index && item.source === tx.source
                  ? { ...item, isEffective: tx.isEffective, effectiveAmount: tx.effectiveAmount ?? null }
                  : item
              ),
            };
          });
          window.alert(err?.message ?? 'Falha ao atualizar efetivacao da receita.');
        }
      })();
      return;
    }

    setEffectiveTx(tx);
    setEffectiveUseCustomValue(false);
    setEffectiveCustomValue(formatCurrencyInputFromNumber(tx.amount));
  };
const setExpenseEffective = async (tx: DashboardData['transactions'][number], isEffective: boolean) => {
    if (tx.type !== 'despesa') return;
    if (tx.isEffective === isEffective) return;

    setDashboard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        transactions: prev.transactions.map((item) =>
          item.index === tx.index && item.source === tx.source
            ? { ...item, isEffective, effectiveAmount: isEffective ? item.effectiveAmount ?? null : null }
            : item
        ),
      };
    });

    void (async () => {
      try {
        const res = await fetch(`/api/finance/transaction/${tx.index}/effective?source=${tx.source}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isEffective }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error ?? 'Falha ao atualizar efetivacao da despesa.');
        }
        void refreshDashboardInline();
      } catch (err: any) {
        setDashboard((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            transactions: prev.transactions.map((item) =>
              item.index === tx.index && item.source === tx.source
                ? { ...item, isEffective: tx.isEffective, effectiveAmount: tx.effectiveAmount ?? null }
                : item
            ),
          };
        });
        window.alert(err?.message ?? 'Falha ao atualizar efetivacao da despesa.');
      }
    })();
  };
void setExpenseEffective;

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
          window.alert('Valor efetivado invalido.');
          return;
        }
        actualAmount = parsed;
      }

      closeEffectiveModal();
      setDashboard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          transactions: prev.transactions.map((item) =>
            item.index === effectiveTx.index && item.source === effectiveTx.source
              ? { ...item, isEffective: true, effectiveAmount: actualAmount ?? null }
              : item
          ),
        };
      });

      void (async () => {
        try {
          const res = await fetch(`/api/finance/transaction/${effectiveTx.index}/effective?source=${effectiveTx.source}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isEffective: true, actualAmount }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err?.error ?? 'Falha ao atualizar efetivacao da receita.');
          }
          void refreshDashboardInline();
        } catch (err: any) {
          setDashboard((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              transactions: prev.transactions.map((item) =>
                item.index === effectiveTx.index && item.source === effectiveTx.source
                  ? { ...item, isEffective: effectiveTx.isEffective, effectiveAmount: effectiveTx.effectiveAmount ?? null }
                  : item
              ),
            };
          });
          window.alert(err?.message ?? 'Falha ao atualizar efetivacao da receita.');
        }
      })();
    } catch (err: any) {
      window.alert(err?.message ?? 'Falha ao atualizar efetivacao da receita.');
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

  const transactionRows = useMemo(
    () =>
      [...expenseTransactions]
        .filter((tx) => tx.isEffective)
        .sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [expenseTransactions],
  );
  const txFilterCategoryOptions = useMemo(
    () => Array.from(new Set(transactionRows.map((tx) => tx.category))).sort((a, b) => a.localeCompare(b)),
    [transactionRows],
  );
  const filteredTransactionRows = useMemo(() => {
    const descriptionNeedle = txFilterDescription.trim().toLowerCase();
    const minValue = Number(txFilterMinValue);
    const maxValue = Number(txFilterMaxValue);
    const hasMinValue = txFilterMinValue.trim() !== '' && Number.isFinite(minValue);
    const hasMaxValue = txFilterMaxValue.trim() !== '' && Number.isFinite(maxValue);

    return transactionRows.filter((tx) => {
      if (txFilterCategory !== 'all' && tx.category !== txFilterCategory) return false;
      if (txFilterDateFrom && tx.date < txFilterDateFrom) return false;
      if (txFilterDateTo && tx.date > txFilterDateTo) return false;
      if (descriptionNeedle && !String(tx.description ?? '').toLowerCase().includes(descriptionNeedle)) return false;
      if (hasMinValue && tx.amount < minValue) return false;
      if (hasMaxValue && tx.amount > maxValue) return false;
      return true;
    });
  }, [transactionRows, txFilterCategory, txFilterDateFrom, txFilterDateTo, txFilterDescription, txFilterMinValue, txFilterMaxValue]);
  const transactionTotalPages = Math.max(1, Math.ceil(filteredTransactionRows.length / TRANSACTIONS_PER_PAGE));
  const pagedTransactionRows = useMemo(() => {
    const page = Math.min(Math.max(1, transactionsPage), transactionTotalPages);
    const start = (page - 1) * TRANSACTIONS_PER_PAGE;
    return filteredTransactionRows.slice(start, start + TRANSACTIONS_PER_PAGE);
  }, [filteredTransactionRows, transactionTotalPages, transactionsPage]);

  useEffect(() => {
    if (transactionsPage > transactionTotalPages) {
      setTransactionsPage(transactionTotalPages);
    }
  }, [transactionTotalPages, transactionsPage]);

  const displayTotals = useMemo(() => {
    if (!isFutureOfApril) {
      return { receber: totalsByType.receber, pagar: totalsByType.pagar };
    }
    return {
      receber: projectedMonthlyBase.projectedIncome,
      pagar: projectedMonthlyBase.projectedExpense,
    };
  }, [isFutureOfApril, projectedMonthlyBase.projectedExpense, projectedMonthlyBase.projectedIncome, totalsByType.pagar, totalsByType.receber]);

  const actualBalance = isFutureOfApril
    ? (displayTotals.receber - displayTotals.pagar)
    : Number(dashboard?.comparison?.actualBalance ?? totalsByType.saldo);

  const healthScore = useMemo(() => {
    if (!displayTotals.receber || displayTotals.receber <= 0) return 0;
    const margin = (displayTotals.receber - displayTotals.pagar) / displayTotals.receber;
    if (margin <= 0) {
      // Faixa negativa/neutra: vermelho -> amarelo (0..25)
      const negativeNormalized = Math.max(-1, margin); // limita perda em -100%
      return Math.max(0, Math.min(25, (negativeNormalized + 1) * 25));
    }
    // Qualquer saldo positivo já entra na faixa verde (26..100)
    const positiveNormalized = Math.min(1, margin); // 100% de margem = score 100
    return 26 + (positiveNormalized * 74);
  }, [displayTotals.pagar, displayTotals.receber]);

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

  const projectedCategoryData = useMemo(() => {
    const categories = new Map<string, number>();
    recurring
      .filter((item) => item.active)
      .forEach((item) => {
        categories.set(item.category, (categories.get(item.category) || 0) + parseAmount(item.amount));
      });

    if (categories.size === 0) {
      (aprilDashboard?.transactions ?? [])
        .filter((item) => item.type === 'despesa' && item.isRecurring)
        .forEach((item) => {
          categories.set(item.category, (categories.get(item.category) || 0) + parseAmount(item.amount));
        });
    }

    const total = Array.from(categories.values()).reduce((a, b) => a + b, 0);
    return Array.from(categories.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, amount], i) => ({
        label,
        amount,
        pct: total > 0 ? Math.round((amount / total) * 100) : 0,
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      }));
  }, [aprilDashboard?.transactions, recurring]);

  const displayCategoryData = isFutureOfApril && projectedCategoryData.length > 0
    ? projectedCategoryData
    : categoryData;

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
  const footerTabs = tabs.filter((tab) => tab.key !== 'dividas' && tab.key !== 'cartoes' && tab.key !== 'planejamento');
  const viewToTab: Record<Exclude<SidebarView, 'home'>, ActiveTab> = {
    receitas: 'receitas',
    cartoes: 'cartoes',
    dividas: 'dividas',
    planejamento: 'planejamento',
  };
  const isHomeView = activeView === 'home';
  const contentTab: ActiveTab = isHomeView ? activeTab : viewToTab[activeView];

  const sidebarNavigation = [
    { icon: Home, label: 'Home', action: 'home' as const },
    { icon: Wallet, label: 'Receitas', action: 'tab' as const, tab: 'receitas' as const },
    { icon: CreditCard, label: 'Cartoes', action: 'tab' as const, tab: 'cartoes' as const },
    { icon: Link2, label: 'Dividas', action: 'tab' as const, tab: 'dividas' as const },
    { icon: Target, label: 'Metas/Objetivos', action: 'tab' as const, tab: 'planejamento' as const },
  ];

  const sidebarItems = [
    { icon: Home, label: 'Transações', tab: 'transacoes' },
    { icon: Wallet, label: 'Fixas', tab: 'fixas' },
    { icon: Wallet, label: 'Receitas', tab: 'receitas' },
    { icon: Calendar, label: 'Planejamento', tab: 'planejamento' },
    { icon: Link2, label: 'Dívidas', tab: 'dividas' },
    { icon: Search, label: 'Atrasadas', tab: 'atrasadas' },
    { icon: LayoutList, label: 'Cartões', tab: 'cartoes' },
  ];

  return (
    <div className="flex h-full bg-background text-foreground">
      <aside data-sidebar-legacy-count={sidebarItems.length} className="w-[72px] shrink-0 border-r border-border bg-card hidden md:flex md:flex-col md:items-center md:py-6 md:gap-2">
        <div className="mb-8">
          <span className="text-2xl font-black italic text-card-foreground tracking-tighter">G</span>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          {sidebarNavigation.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                if (item.action === 'home') {
                  setActiveView('home');
                  switchTab('transacoes');
                  sessionScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                  return;
                }
                setActiveView(item.tab as Exclude<SidebarView, 'home'>);
                switchTab(item.tab);
                sessionScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              title={item.label}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
                ((item.action === 'home' && isHomeView)
                  || (item.action === 'tab' && activeView !== 'home' && contentTab === item.tab))
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
              }`}
            >
              <item.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </button>
          ))}
        </nav>
      </aside>

      <div ref={sessionScrollRef} className="flex-1 h-full overflow-y-auto bg-background text-foreground">

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
            {isHomeView && (
              <>
            {/* TOP SECTION: PORTFOLIO PERFORMANCE + CHAT PANEL */}
            <div className="flex gap-6 mb-6">
              {/* PORTFOLIO PERFORMANCE - Flex 1 */}
              <div className="flex-1 min-w-0">
                <PortfolioPerformance
                  points={performancePoints}
                  value={fmtCurrency(actualBalance)}
                  change={performanceChange.label}
                  changeTone={performanceChange.tone}
                />
              </div>

              {/* CHAT PANEL - Fixed width */}
              <div className="w-[300px] shrink-0 bg-card rounded-2xl shadow-sm border p-4 flex flex-col">
                <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase">Assistente Financeiro</h3>
                <div className="flex-1 overflow-y-auto mb-3 min-h-0">
                  <div className="text-xs text-muted-foreground italic">
                    Faça perguntas sobre suas finanças...
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Pergunte algo..."
                    className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button className="px-3 py-2 rounded-lg bg-primary/10 border border-primary/25 text-primary hover:bg-primary/15 transition-colors">
                    <span className="text-xs font-medium">→</span>
                  </button>
                </div>
              </div>
            </div>

            {/* PORTFOLIO BREAKDOWN + BALANCE DISTRIBUTION - Side by side */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* PORTFOLIO BREAKDOWN */}
              <PortfolioBreakdown
                items={[
                  {
                    label: 'Receitas',
                    descriptionLabel: 'Previsto',
                    descriptionValue: fmtCurrency(dashboard?.comparison?.plannedIncome ?? 0),
                    value: fmtCurrency(displayTotals.receber),
                    change: `${incomeDelta >= 0 ? '+ ' : ''}${fmtCurrency(incomeDelta)}`,
                    positive: incomeDelta >= 0,
                    color: 'hsl(var(--accent))',
                  },
                  {
                    label: 'Despesas',
                    description: undefined,
                    value: fmtCurrency(displayTotals.pagar),
                    change: `${expensesDelta > 0 ? '+ ' : ''}${fmtCurrency(expensesDelta)}`,
                    positive: expensesDelta <= 0,
                    color: 'hsl(var(--destructive))',
                  },
                  {
                    label: 'Saldo Líquido',
                    description: undefined,
                    value: fmtCurrency(actualBalance),
                    change: `${balanceDelta >= 0 ? '+ ' : ''}${fmtCurrency(balanceDelta)}`,
                    positive: balanceDelta >= 0,
                    color: 'hsl(270 65% 60%)',
                    valueColor: actualBalance >= 0 ? 'hsl(var(--accent))' : 'hsl(var(--destructive))',
                  },
                ]}
                healthScore={healthScore}
              />

              {/* BALANCE DISTRIBUTION */}
              <BalanceDistribution
                totalBalance={fmtCurrency(displayTotals.pagar)}
                totalBalanceLabel="Total de despesas no mês"
                barData={displayCategoryData.map(item => ({
                  label: item.label,
                  value: item.pct,
                  color: item.color,
                }))}
                legend={displayCategoryData.slice(0, 2).map(item => ({
                  name: item.label,
                  color: item.color,
                }))}
              />
            </div>
              </>
            )}

            {/* TABS SECTION */}
            <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
              {/* Tab header */}
              {isHomeView ? (
                <div className="flex gap-0 border-b overflow-x-auto">
                  {footerTabs.map((tab) => (
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
              ) : (
                <div className="px-4 py-3 border-b border-border">
                  <div className="text-xs font-semibold text-card-foreground uppercase tracking-wide">
                    {contentTab === 'receitas' ? 'Receitas' : contentTab === 'cartoes' ? 'Cartoes' : contentTab === 'dividas' ? 'Dividas' : 'Metas/Objetivos'}
                  </div>
                </div>
              )}

              {/* Action buttons row */}
              {!tabLoading && (
                <div className="px-4 py-3 border-b border-border">
                  {contentTab === 'transacoes' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => openAdd('despesa')}
                        className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-destructive/10 border border-destructive/25 text-destructive hover:bg-destructive/15 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Nova Despesa
                      </button>
                      <button
                        onClick={() => setIsTxFiltersOpen(true)}
                        className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-muted border border-border text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                      >
                        <Search className="w-3.5 h-3.5" />
                        Filtros
                      </button>
                    </div>
                  )}
                  {contentTab === 'fixas' && (
                    <button
                      onClick={() => openAdd('despesa')}
                      className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/25 text-amber-600 hover:bg-amber-500/15 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Nova Despesa Fixa
                    </button>
                  )}
                  {contentTab === 'receitas' && (
                    <button
                      onClick={() => openAdd('receita')}
                      className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-accent/10 border border-accent/25 text-accent hover:bg-accent/15 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Nova Receita
                    </button>
                  )}
                  {contentTab === 'dividas' && (
                    <button
                      onClick={() => openAdd('divida')}
                      className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/25 text-amber-600 hover:bg-amber-500/15 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Nova Dívida
                    </button>
                  )}
                  {contentTab === 'atrasadas' && (
                    <button
                      onClick={() => openAdd('atrasada')}
                      className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-destructive/10 border border-destructive/25 text-destructive hover:bg-destructive/15 transition-colors"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Nova Conta Atrasada
                    </button>
                  )}
                  {contentTab === 'cartoes' && (
                    <button
                      onClick={() => openAdd('cartao')}
                      className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-violet-500/10 border border-violet-500/25 text-violet-600 hover:bg-violet-500/15 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Novo Cartão
                    </button>
                  )}
                  {contentTab === 'planejamento' && (
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
                ) : contentTab === 'transacoes' ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Data</th>
                          <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Categoria</th>
                          <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Descrição</th>
                          <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Valor</th>
                          <th className="px-4 py-2.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {pagedTransactionRows.map((tx, rowIndex) => (
                          <tr
                            key={tx.index != null
                              ? `${tx.source}-${tx.index}`
                              : `${safeKeyPart(tx.source)}-${safeKeyPart(tx.date)}-${safeKeyPart(tx.type)}-${safeKeyPart(tx.category)}-${safeKeyPart(tx.description)}-${rowIndex}`}
                            className="border-t border-border hover:bg-muted/30 transition-colors group"
                          >
                            <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{fmtDate(tx.date)}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">{tx.category}</td>
                            <td className="px-4 py-2.5 text-card-foreground">{tx.description}</td>
                            <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-destructive">
                              - {fmtCurrency(tx.amount)}
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
                        {filteredTransactionRows.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-10 text-center">
                              <div className="text-muted-foreground text-xs">Nenhuma despesa registrada neste mês</div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    {filteredTransactionRows.length > TRANSACTIONS_PER_PAGE && (
                      <div className="px-4 py-3 border-t border-border flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          Pagina {Math.min(transactionsPage, transactionTotalPages)} de {transactionTotalPages}
                        </span>
                        <div className="flex items-center gap-2">
                          {Array.from({ length: transactionTotalPages }, (_, i) => i + 1).map((page) => (
                            <button
                              key={page}
                              onClick={() => setTransactionsPage(page)}
                              className={`h-6 min-w-6 px-1.5 text-[11px] rounded-md transition-colors ${
                                transactionsPage === page
                                  ? 'text-foreground bg-muted/60'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              {page}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : contentTab === 'fixas' ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Descrição</th>
                          <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Categoria</th>
                          <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Valor</th>
                          <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Dia</th>
                          <th className="text-center px-4 py-2.5 text-muted-foreground font-medium">Pagamento</th>
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
                                onClick={() => { void toggleRecurringPayment(r); }}
                                title={recurringPaidMap.get(r.id) ? 'Marcar como não pago' : 'Marcar como pago'}
                                className={`h-6 w-6 rounded-md border transition-colors inline-flex items-center justify-center ${
                                  recurringPaidMap.get(r.id)
                                    ? 'border-accent/60 text-accent bg-accent/10'
                                    : 'border-border text-muted-foreground hover:bg-muted'
                                }`}
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            </td>
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
                                <button onClick={() => { openEditRecurring(r); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button onClick={() => { void deleteRecurring(r.id); }} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {recurring.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-4 py-10 text-center">
                              <div className="text-muted-foreground text-xs">Nenhuma despesa fixa cadastrada</div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : contentTab === 'receitas' ? (
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
                        {incomeTransactions.map((tx, rowIndex) => (
                          <tr
                            key={tx.index != null
                              ? `${tx.source}-${tx.index}`
                              : `${safeKeyPart(tx.source)}-${safeKeyPart(tx.date)}-${safeKeyPart(tx.type)}-${safeKeyPart(tx.category)}-${safeKeyPart(tx.description)}-${rowIndex}`}
                            className="border-t border-border hover:bg-muted/30 transition-colors group"
                          >
                            <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{fmtDate(tx.date)}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">{tx.category}</td>
                            <td className="px-4 py-2.5 text-card-foreground">{tx.description}</td>
                            <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-accent">
                              + {fmtCurrency(tx.amount)}
                            </td>
                            <td className="px-4 py-2.5 text-xs">
                              {tx.projected ? (
                                <span className="text-amber-600">Projeção</span>
                              ) : tx.isEffective && tx.effectiveAmount !== null && tx.effectiveAmount !== undefined && Math.abs(tx.effectiveAmount - tx.amount) > 0.009 ? (
                                <span className="text-accent font-semibold">{fmtCurrency(tx.effectiveAmount)}</span>
                              ) : tx.isEffective ? (
                                <span className="text-muted-foreground">Mesmo valor</span>
                              ) : (
                                <span className="text-amber-600">Não efetivada</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              {tx.projected ? (
                                <div className="flex items-center justify-center text-muted-foreground">-</div>
                              ) : (
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
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              {tx.projected ? (
                                <div className="flex justify-end text-muted-foreground">-</div>
                              ) : (
                                <div className="flex justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => openEditTx(tx)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => { void deleteTx(tx); }} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
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
                ) : contentTab === 'dividas' ? (
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
                        {debts.map((d, rowIndex) => (
                          <tr
                            key={d.index != null
                              ? `${d.source}-${d.index}`
                              : `${safeKeyPart(d.source)}-${safeKeyPart(d.creditor)}-${safeKeyPart(d.dueDate)}-${rowIndex}`}
                            className="border-t border-border hover:bg-muted/30 transition-colors group"
                          >
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
                ) : contentTab === 'atrasadas' ? (
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
                        {overdue.map((o, rowIndex) => {
                          const isPaid = o.status === 'Pago';
                          return (
                            <tr
                              key={o.index != null
                                ? `${o.source}-${o.index}`
                                : `${safeKeyPart(o.source)}-${safeKeyPart(o.account)}-${safeKeyPart(o.dueDate)}-${rowIndex}`}
                              className={`border-t border-border transition-colors group ${isPaid ? 'opacity-60' : 'hover:bg-muted/30'}`}
                            >
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
                ) : contentTab === 'cartoes' ? (
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
                  /* METAS E OBJETIVOS */
                  <GoalsSession />
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal de efetivação */}
      {isTxFiltersOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#0d1117] border border-cyan-500/25 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-cyan-500/20 bg-cyan-500/8 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                  <Search className="w-3.5 h-3.5 text-cyan-300" />
                </div>
                <h3 className="text-sm font-semibold text-white/90">Filtros de transacoes</h3>
              </div>
              <button
                onClick={() => setIsTxFiltersOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white/90 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Categoria</label>
                <select value={txFilterCategory} onChange={(e) => setTxFilterCategory(e.target.value)} className={inputClass}>
                  <option value="all" style={{ background: '#0d1117' }}>Todas</option>
                  {txFilterCategoryOptions.map((category) => (
                    <option key={category} value={category} style={{ background: '#0d1117' }}>{category}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Descricao</label>
                <input
                  type="text"
                  value={txFilterDescription}
                  onChange={(e) => setTxFilterDescription(e.target.value)}
                  placeholder="Ex.: Aluguel, Mercado..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Data inicial</label>
                <input type="date" value={txFilterDateFrom} onChange={(e) => setTxFilterDateFrom(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Data final</label>
                <input type="date" value={txFilterDateTo} onChange={(e) => setTxFilterDateTo(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Valor minimo</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={txFilterMinValue}
                  onChange={(e) => setTxFilterMinValue(e.target.value)}
                  placeholder="0.00"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Valor maximo</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={txFilterMaxValue}
                  onChange={(e) => setTxFilterMaxValue(e.target.value)}
                  placeholder="0.00"
                  className={inputClass}
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-white/10 flex gap-2">
              <button
                onClick={() => {
                  setTxFilterCategory('all');
                  setTxFilterDateFrom('');
                  setTxFilterDateTo('');
                  setTxFilterDescription('');
                  setTxFilterMinValue('');
                  setTxFilterMaxValue('');
                }}
                className="h-10 px-4 rounded-xl text-sm font-semibold bg-white/5 border border-white/15 text-white/70 hover:bg-white/10 transition-colors"
              >
                Limpar
              </button>
              <button
                onClick={() => setIsTxFiltersOpen(false)}
                className="flex-1 h-10 rounded-xl text-sm font-semibold bg-cyan-500 hover:bg-cyan-400 text-white transition-colors"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {editingRecurring && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0d1117] border border-amber-500/25 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-amber-500/20 bg-amber-500/8 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-sm">✎</div>
                <h3 className="text-sm font-semibold text-white/90">Editar despesa fixa</h3>
              </div>
              <button
                onClick={closeRecurringEdit}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white/90 transition-colors"
                disabled={recurringEditSaving}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Descrição</label>
                <input
                  value={recurringEditDescription}
                  onChange={(e) => setRecurringEditDescription(e.target.value)}
                  placeholder="Ex.: Aluguel"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Categoria</label>
                <select value={recurringEditCategory} onChange={(e) => setRecurringEditCategory(e.target.value)} className={inputClass}>
                  {!!recurringEditCategory && !EXPENSE_CATEGORIES.includes(recurringEditCategory) && (
                    <option value={recurringEditCategory} style={{ background: '#0d1117' }}>{recurringEditCategory}</option>
                  )}
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat} style={{ background: '#0d1117' }}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Valor (R$)</label>
                  <input
                    value={recurringEditAmount}
                    onChange={(e) => setRecurringEditAmount(formatCurrencyInput(e.target.value))}
                    type="text"
                    inputMode="numeric"
                    placeholder="R$ 0,00"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium block mb-1.5">Dia do vencimento</label>
                  <input
                    value={recurringEditDay}
                    onChange={(e) => setRecurringEditDay(e.target.value)}
                    type="number"
                    min={1}
                    max={31}
                    placeholder="Ex: 10"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={closeRecurringEdit}
                  disabled={recurringEditSaving}
                  className="flex-1 h-10 rounded-xl text-sm font-semibold bg-white/5 border border-white/15 text-white/70 hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => { void saveRecurringEdit(); }}
                  disabled={recurringEditSaving}
                  className="flex-1 h-10 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-white transition-colors disabled:opacity-50"
                >
                  {recurringEditSaving ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}

