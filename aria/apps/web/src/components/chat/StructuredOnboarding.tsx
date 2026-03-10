'use client';

import { useState } from 'react';
import {
    Car, Home, Zap, Droplets, Wifi, CreditCard, Heart, Film,
    Dumbbell, GraduationCap, ShieldCheck, Package, Building2,
    Banknote, TrendingUp, AlertCircle, ChevronRight, ChevronLeft,
    Check, Target, Wallet, Clock, Plus, Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ItemOption {
    id: string;
    label: string;
    icon: React.ElementType;
}

interface SelectedItem {
    id: string;
    label: string;
    amount: string;
    extra?: string; // para dívidas: parcela; para atrasadas: dias de atraso
}

interface StepData {
    fixedIncome: string;
    variableIncome: string;
    fixedExpenses: SelectedItem[];
    debts: SelectedItem[];
    overdueAccounts: SelectedItem[];
    goal: string;
    savingsCapacity: string;
}

interface StructuredOnboardingProps {
    onComplete: (data: StepData) => void;
    loading?: boolean;
}

// ── Categorias pré-definidas ───────────────────────────────────────────────────

const FIXED_EXPENSE_OPTIONS: ItemOption[] = [
    { id: 'aluguel', label: 'Aluguel', icon: Home },
    { id: 'financCarro', label: 'Financiamento Carro', icon: Car },
    { id: 'financAp', label: 'Financiamento AP', icon: Building2 },
    { id: 'condômínio', label: 'Condomínio', icon: Building2 },
    { id: 'luz', label: 'Conta de Luz', icon: Zap },
    { id: 'agua', label: 'Conta de Água', icon: Droplets },
    { id: 'internet', label: 'Internet / TV', icon: Wifi },
    { id: 'planoSaude', label: 'Plano de Saúde', icon: Heart },
    { id: 'cartao', label: 'Cartão de Crédito', icon: CreditCard },
    { id: 'assinaturas', label: 'Assinaturas (Netflix etc)', icon: Film },
    { id: 'academia', label: 'Academia', icon: Dumbbell },
    { id: 'escola', label: 'Escola / Faculdade', icon: GraduationCap },
    { id: 'seguro', label: 'Seguro', icon: ShieldCheck },
    { id: 'outros_despesas', label: 'Outros', icon: Package },
];

const DEBT_OPTIONS: ItemOption[] = [
    { id: 'cartaoCredito', label: 'Cartão de Crédito', icon: CreditCard },
    { id: 'crediario', label: 'Crediário / Parcelamento', icon: Banknote },
    { id: 'emprestimo', label: 'Empréstimo Pessoal', icon: Banknote },
    { id: 'financCarro_divida', label: 'Financiamento Carro', icon: Car },
    { id: 'financAp_divida', label: 'Financiamento Apartamento', icon: Home },
    { id: 'consignado', label: 'Consignado', icon: Building2 },
    { id: 'chequeEspecial', label: 'Cheque Especial', icon: AlertCircle },
    { id: 'outros_divida', label: 'Outros', icon: Package },
];

const OVERDUE_OPTIONS: ItemOption[] = [
    { id: 'ov_luz', label: 'Conta de Luz', icon: Zap },
    { id: 'ov_agua', label: 'Conta de Água', icon: Droplets },
    { id: 'ov_internet', label: 'Internet / TV', icon: Wifi },
    { id: 'ov_aluguel', label: 'Aluguel', icon: Home },
    { id: 'ov_condômínio', label: 'Condomínio', icon: Building2 },
    { id: 'ov_iptu', label: 'IPTU / IPVA', icon: Building2 },
    { id: 'ov_boleto', label: 'Boleto Bancário', icon: Banknote },
    { id: 'ov_cartao', label: 'Cartão de Crédito', icon: CreditCard },
    { id: 'ov_saude', label: 'Plano de Saúde', icon: Heart },
    { id: 'ov_outros', label: 'Outros', icon: Package },
];

// ── Sub-componentes ────────────────────────────────────────────────────────────

function formatCurrency(value: string): string {
    const numeric = value.replace(/\D/g, '');
    if (!numeric) return '';
    const num = parseInt(numeric, 10) / 100;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function CurrencyInput({
    value,
    onChange,
    placeholder = 'R$ 0,00',
    className = '',
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    className?: string;
}) {
    return (
        <div className={`relative ${className}`}>
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm font-medium">R$</span>
            <input
                type="text"
                inputMode="numeric"
                value={value}
                onChange={e => onChange(formatCurrency(e.target.value))}
                placeholder={placeholder.replace('R$ ', '')}
                className="w-full bg-background border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-emerald-500/50 transition-all shadow-inner"
            />
        </div>
    );
}

function ItemSelector({
    options,
    selected,
    onToggle,
    onUpdateAmount,
    onUpdateExtra,
    extraLabel,
}: {
    options: ItemOption[];
    selected: SelectedItem[];
    onToggle: (item: ItemOption) => void;
    onUpdateAmount: (id: string, value: string) => void;
    onUpdateExtra?: (id: string, value: string) => void;
    extraLabel?: string;
}) {
    return (
        <div className="space-y-3">
            {/* Grid de opções */}
            <div className="grid grid-cols-2 gap-2">
                {options.map(opt => {
                    const isSelected = selected.some(s => s.id === opt.id);
                    return (
                        <button
                            key={opt.id}
                            onClick={() => onToggle(opt)}
                            className={`flex items-center gap-2.5 px-3.5 py-3 rounded-2xl text-left text-sm font-medium transition-all duration-200 border ${isSelected
                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                                : 'bg-[#161618] border-white/5 text-white/50 hover:bg-[#1C1C1E] hover:text-white/80 shadow-sm'
                                }`}
                        >
                            <div className={`w-7 h-7 rounded-[0.6rem] flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-emerald-500/20' : 'bg-background'}`
                            }>
                                {isSelected
                                    ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    : <opt.icon className="w-3.5 h-3.5 text-white/30" />
                                }
                            </div>
                            <span className="truncate leading-tight">{opt.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Inputs para os selecionados */}
            <AnimatePresence>
                {selected.map(item => (
                    <motion.div
                        key={item.id}
                        initial={{ opacity: 0, height: 0, y: -8 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -8 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="bg-[#161618] shadow-inner border border-emerald-500/20 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-white/80">{item.label}</span>
                                <button
                                    onClick={() => onToggle({ id: item.id, label: item.label, icon: Package })}
                                    className="p-1 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-all"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <div className={`grid ${onUpdateExtra ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                                <div>
                                    <p className="text-[10px] text-white/40 mb-1 font-bold uppercase tracking-widest">Valor mensal</p>
                                    <CurrencyInput
                                        value={item.amount}
                                        onChange={v => onUpdateAmount(item.id, v)}
                                    />
                                </div>
                                {onUpdateExtra && (
                                    <div>
                                        <p className="text-[10px] text-white/40 mb-1 font-bold uppercase tracking-widest">{extraLabel}</p>
                                        <CurrencyInput
                                            value={item.extra ?? ''}
                                            onChange={v => onUpdateExtra(item.id, v)}
                                            placeholder="R$ 0,00"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}

// ── Componente principal ───────────────────────────────────────────────────────

export function StructuredOnboarding({ onComplete, loading = false }: StructuredOnboardingProps) {
    const [step, setStep] = useState(0);
    const [data, setData] = useState<StepData>({
        fixedIncome: '',
        variableIncome: '',
        fixedExpenses: [],
        debts: [],
        overdueAccounts: [],
        goal: '',
        savingsCapacity: '',
    });

    const STEPS = [
        { title: 'Qual é sua renda mensal?', subtitle: 'Informe seus rendimentos para iniciarmos o diagnóstico.' },
        { title: 'Despesas Fixas', subtitle: 'Selecione suas despesas mensais e inclua os valores.' },
        { title: 'Dívidas', subtitle: 'Você tem dívidas ativas? Selecione e informe os detalhes.' },
        { title: 'Contas em Atraso', subtitle: 'Contas que ainda não viraram dívida, mas estão atrasadas.' },
        { title: 'Meta & Resumo', subtitle: 'Qual é seu objetivo financeiro? Revise e confirme.' },
    ];

    // ── Handlers ─────────────────────────────────────────────────────────
    function toggleItem(
        list: 'fixedExpenses' | 'debts' | 'overdueAccounts',
        option: ItemOption,
    ) {
        setData(prev => {
            const exists = prev[list].some(s => s.id === option.id);
            return {
                ...prev,
                [list]: exists
                    ? prev[list].filter(s => s.id !== option.id)
                    : [...prev[list], { id: option.id, label: option.label, amount: '', extra: '' }],
            };
        });
    }

    function updateAmount(
        list: 'fixedExpenses' | 'debts' | 'overdueAccounts',
        id: string,
        value: string,
    ) {
        setData(prev => ({
            ...prev,
            [list]: prev[list].map(s => s.id === id ? { ...s, amount: value } : s),
        }));
    }

    function updateExtra(
        list: 'fixedExpenses' | 'debts' | 'overdueAccounts',
        id: string,
        value: string,
    ) {
        setData(prev => ({
            ...prev,
            [list]: prev[list].map(s => s.id === id ? { ...s, extra: value } : s),
        }));
    }

    const canProceed = () => {
        if (step === 0) return data.fixedIncome.length > 0;
        return true; // Outros steps são opcionais
    };

    const progress = ((step + 1) / STEPS.length) * 100;

    // ── Step 4: Resumo ─────────────────────────────────────────────────
    function SummarySection({ title, items }: { title: string; items: SelectedItem[] }) {
        if (items.length === 0) return null;
        return (
            <div className="space-y-2">
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{title}</p>
                {items.map(item => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className="text-white/70">{item.label}</span>
                        <span className="text-emerald-400 font-bold">R$ {item.amount || '0,00'}</span>
                    </div>
                ))}
            </div>
        );
    }

    const totalFixedExpenses = data.fixedExpenses.reduce((acc, i) =>
        acc + (parseFloat(i.amount.replace(/\./g, '').replace(',', '.')) || 0), 0);
    const totalDebts = data.debts.reduce((acc, i) =>
        acc + (parseFloat(i.amount.replace(/\./g, '').replace(',', '.')) || 0), 0);
    const totalOverdue = data.overdueAccounts.reduce((acc, i) =>
        acc + (parseFloat(i.amount.replace(/\./g, '').replace(',', '.')) || 0), 0);
    const fixedIncomeNum = parseFloat(data.fixedIncome.replace(/\./g, '').replace(',', '.')) || 0;

    // ── Render ──────────────────────────────────────────────────────────
    return (
        <div className="flex-1 flex flex-col items-center justify-start p-6 lg:p-10 overflow-y-auto pb-8">
            <div className="w-full max-w-2xl space-y-6">

                {/* Progress Bar */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex gap-1.5">
                            {STEPS.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => i < step && setStep(i)}
                                    className={`h-1.5 rounded-full transition-all duration-500 ${i === step ? 'w-8 bg-emerald-400' : i < step ? 'w-4 bg-emerald-500/60 cursor-pointer' : 'w-4 bg-white/10'
                                        }`}
                                />
                            ))}
                        </div>
                        <span className="text-[10px] font-bold text-white/40 tracking-widest uppercase">
                            {step + 1} / {STEPS.length}
                        </span>
                    </div>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <h2 className="text-2xl lg:text-3xl font-bold text-white tracking-tight leading-tight">
                                {STEPS[step].title}
                            </h2>
                            <p className="text-[15px] text-white/40 font-medium mt-1.5">{STEPS[step].subtitle}</p>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Step Content */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={`content-${step}`}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        transition={{ duration: 0.3, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
                        className="space-y-4"
                    >
                        {/* ── STEP 0: Renda ─────────────────────────────────────── */}
                        {step === 0 && (
                            <div className="space-y-4">
                                <div className="bg-[#161618]/80 backdrop-blur-3xl border border-white/5 shadow-2xl rounded-[24px] p-6 space-y-4">
                                    <div>
                                        <label className="text-sm font-semibold text-white/70 mb-2 flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                                            Renda Fixa Mensal
                                        </label>
                                        <p className="text-xs text-white/30 mb-3">Salário, pró-labore ou renda principal após impostos</p>
                                        <CurrencyInput
                                            value={data.fixedIncome}
                                            onChange={v => setData(d => ({ ...d, fixedIncome: v }))}
                                            placeholder="R$ 0,00"
                                        />
                                    </div>
                                    <div className="border-t border-white/[0.05] pt-4">
                                        <label className="text-sm font-semibold text-white/70 mb-2 flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4 text-emerald-400/60" />
                                            Renda Variável Mensal
                                            <span className="text-[10px] text-white/20 font-normal">(opcional)</span>
                                        </label>
                                        <p className="text-xs text-white/30 mb-3">Freelance, comissões, aluguéis, etc.</p>
                                        <CurrencyInput
                                            value={data.variableIncome}
                                            onChange={v => setData(d => ({ ...d, variableIncome: v }))}
                                        />
                                    </div>
                                </div>
                                {data.fixedIncome && (
                                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                                        <p className="text-sm text-emerald-300">
                                            Renda total: <strong>R$ {(
                                                (parseFloat(data.fixedIncome.replace(/\./g, '').replace(',', '.')) || 0) +
                                                (parseFloat(data.variableIncome.replace(/\./g, '').replace(',', '.')) || 0)
                                            ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── STEP 1: Despesas Fixas ────────────────────────────── */}
                        {step === 1 && (
                            <ItemSelector
                                options={FIXED_EXPENSE_OPTIONS}
                                selected={data.fixedExpenses}
                                onToggle={opt => toggleItem('fixedExpenses', opt)}
                                onUpdateAmount={(id, v) => updateAmount('fixedExpenses', id, v)}
                            />
                        )}

                        {/* ── STEP 2: Dívidas ───────────────────────────────────── */}
                        {step === 2 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#161618] border border-white/5 shadow-sm">
                                    <AlertCircle className="w-4 h-4 text-yellow-400/70 shrink-0" />
                                    <p className="text-xs text-white/40">Se não tiver dívidas, pode avançar sem selecionar nada.</p>
                                </div>
                                <ItemSelector
                                    options={DEBT_OPTIONS}
                                    selected={data.debts}
                                    onToggle={opt => toggleItem('debts', opt)}
                                    onUpdateAmount={(id, v) => updateAmount('debts', id, v)}
                                    onUpdateExtra={(id, v) => updateExtra('debts', id, v)}
                                    extraLabel="Parcela"
                                />
                            </div>
                        )}

                        {/* ── STEP 3: Contas em Atraso ──────────────────────────── */}
                        {step === 3 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#161618] border border-white/5 shadow-sm">
                                    <Clock className="w-4 h-4 text-orange-400/70 shrink-0" />
                                    <p className="text-xs text-white/40">Contas que ainda não viraram dívida formal, mas estão atrasadas.</p>
                                </div>
                                <ItemSelector
                                    options={OVERDUE_OPTIONS}
                                    selected={data.overdueAccounts}
                                    onToggle={opt => toggleItem('overdueAccounts', opt)}
                                    onUpdateAmount={(id, v) => updateAmount('overdueAccounts', id, v)}
                                    onUpdateExtra={(id, v) => updateExtra('overdueAccounts', id, v)}
                                    extraLabel="Dias atraso"
                                />
                            </div>
                        )}

                        {/* ── STEP 4: Meta + Resumo ─────────────────────────────── */}
                        {step === 4 && (
                            <div className="space-y-5">
                                {/* Goal input */}
                                <div className="bg-[#161618]/80 backdrop-blur-3xl border border-white/5 shadow-2xl rounded-[24px] p-6 space-y-4">
                                    <div>
                                        <label className="text-sm font-semibold text-white/70 mb-2 flex items-center gap-2">
                                            <Target className="w-4 h-4 text-emerald-400" />
                                            Seu principal objetivo financeiro
                                        </label>
                                        <textarea
                                            value={data.goal}
                                            onChange={e => setData(d => ({ ...d, goal: e.target.value }))}
                                            placeholder="Ex: Quitar o cartão em 6 meses, criar reserva de emergência..."
                                            className="w-full bg-[#0B0B0C] shadow-inner border border-white/10 rounded-xl p-4 text-sm text-white placeholder-white/20 outline-none focus:border-emerald-500/50 resize-none transition-all min-h-[80px]"
                                        />
                                    </div>
                                    <div className="border-t border-white/[0.05] pt-4">
                                        <label className="text-sm font-semibold text-white/70 mb-2 flex items-center gap-2">
                                            <Wallet className="w-4 h-4 text-emerald-400" />
                                            Capacidade de poupança mensal
                                        </label>
                                        <CurrencyInput
                                            value={data.savingsCapacity}
                                            onChange={v => setData(d => ({ ...d, savingsCapacity: v }))}
                                        />
                                    </div>
                                </div>

                                {/* Resumo visual */}
                                <div className="bg-[#161618]/80 backdrop-blur-3xl border border-white/5 shadow-2xl rounded-[24px] p-6 space-y-4">
                                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">📋 Resumo do Diagnóstico</p>

                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Renda</p>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-white/70">Renda Fixa</span>
                                            <span className="text-emerald-400 font-bold">R$ {data.fixedIncome || '0,00'}</span>
                                        </div>
                                        {data.variableIncome && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-white/70">Renda Variável</span>
                                                <span className="text-emerald-400 font-bold">R$ {data.variableIncome}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="border-t border-white/[0.05] pt-3 space-y-3">
                                        <SummarySection title="Despesas Fixas" items={data.fixedExpenses} />
                                        <SummarySection title="Dívidas" items={data.debts} />
                                        <SummarySection title="Contas em Atraso" items={data.overdueAccounts} />
                                    </div>

                                    <div className="border-t border-white/[0.05] pt-3 space-y-2">
                                        {totalFixedExpenses > 0 && (
                                            <div className="flex justify-between text-sm font-bold">
                                                <span className="text-white/50">Total Despesas</span>
                                                <span className={fixedIncomeNum > 0 && totalFixedExpenses > fixedIncomeNum * 0.8 ? 'text-red-400' : 'text-white/80'}>
                                                    R$ {totalFixedExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        )}
                                        {totalDebts > 0 && (
                                            <div className="flex justify-between text-sm font-bold">
                                                <span className="text-white/50">Total Dívidas (parcelas)</span>
                                                <span className="text-orange-400">R$ {totalDebts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        )}
                                        {totalOverdue > 0 && (
                                            <div className="flex justify-between text-sm font-bold">
                                                <span className="text-white/50">Contas em Atraso</span>
                                                <span className="text-yellow-400">R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* Navigation */}
                <div className="flex items-center gap-3 pt-2">
                    {step > 0 && (
                        <button
                            onClick={() => setStep(s => s - 1)}
                            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#161618] border border-white/5 text-white/60 hover:text-white hover:bg-[#1C1C1E] transition-all text-sm font-semibold shadow-sm"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Voltar
                        </button>
                    )}
                    <button
                        onClick={() => {
                            if (step < STEPS.length - 1) {
                                setStep(s => s + 1);
                            } else {
                                onComplete(data);
                            }
                        }}
                        disabled={!canProceed() || loading}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/[0.05] disabled:text-white/20 disabled:cursor-not-allowed transition-all text-[15px] font-bold text-white shadow-xl hover:shadow-emerald-500/20 active:scale-[0.98]"
                    >
                        {loading ? (
                            <span className="animate-pulse">Gerando diagnóstico...</span>
                        ) : step === STEPS.length - 1 ? (
                            <>
                                <Check className="w-5 h-5" />
                                Gerar Diagnóstico Financeiro
                            </>
                        ) : (
                            <>
                                {step === 1 && data.fixedExpenses.length === 0 ? 'Pular (sem despesas)' : 'Continuar'}
                                <ChevronRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
