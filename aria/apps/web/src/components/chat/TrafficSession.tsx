'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, RefreshCw, Loader2, TrendingUp, Eye, MousePointer,
  DollarSign, Activity, Pause, Play, BarChart2, Target, Zap, AlertCircle,
  MessageSquare, Send, BrainCircuit, X, ChevronRight, ChevronDown,
  Image as ImageIcon, Layers, FileText, Columns, GripVertical, Check, RotateCcw,
  Calendar, ArrowUp, ArrowDown, SlidersHorizontal, Building2,
} from 'lucide-react';
import { AtlasCompareTab } from './AtlasCompareTab';


const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface AdAccount {
  id: string;
  name: string;
  account_status: number;
  currency: string;
  timezone_name: string;
}

interface Campaign {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  effective_status: string;
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
}

interface CampaignInsights {
  campaign_id: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  spend: number;
  cpc: number;
  cpm: number;
  ctr: number;
  reach: number;
  roas?: number;
  frequency?: number;
  unique_clicks?: number;
  conversions?: number;
  conversion_value?: number;
  cost_per_conversion?: number;
  leads?: number;
  cost_per_lead?: number;
  engagement?: number;
  video_views_25?: number;
  video_views_50?: number;
  video_views_75?: number;
  video_views_100?: number;
  date_start: string;
  date_stop: string;
}


interface AccountInsights {
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  avg_ctr: number;
  avg_cpm: number;
  avg_cpc: number;
  avg_roas: number;
  avg_cost_per_conversion: number;
  total_leads: number;
  avg_cost_per_lead: number;
  campaigns: CampaignInsights[];
}

interface Workspace {
  id: string;
  name: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  actionExecuted?: string;
}

interface AdSet {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  effective_status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  optimization_goal?: string;
}

interface AdCreative {
  id: string;
  title?: string;
  body?: string;
  image_url?: string;
  thumbnail_url?: string;
  call_to_action_type?: string;
}

interface Ad {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  effective_status: string;
  creative?: AdCreative;
}

interface TrafficSessionProps {
  onClose: () => void;
}

// ── Column Catalog ────────────────────────────────────────────────────────────

type ColAggregate = 'sum' | 'avg' | 'none';
type ColType = 'currency' | 'number' | 'percent' | 'text' | 'multiplier';

interface ColDef {
  id: keyof CampaignInsights;
  label: string;
  description: string;
  type: ColType;
  aggregate: ColAggregate;
}

const COLUMN_CATALOG: ColDef[] = [
  { id: 'spend', label: 'Gasto', description: 'Total gasto no período', type: 'currency', aggregate: 'sum' },
  { id: 'impressions', label: 'Impressões', description: 'Total de vezes que o anúncio foi exibido', type: 'number', aggregate: 'sum' },
  { id: 'clicks', label: 'Cliques no Link', description: 'Cliques diretos no link do anúncio', type: 'number', aggregate: 'sum' },
  { id: 'ctr', label: 'CTR Link', description: 'Taxa de cliques no link (%)', type: 'percent', aggregate: 'avg' },
  { id: 'cpc', label: 'CPC', description: 'Custo por clique no link', type: 'currency', aggregate: 'avg' },
  { id: 'cpm', label: 'CPM', description: 'Custo por mil impressões', type: 'currency', aggregate: 'avg' },
  { id: 'reach', label: 'Alcance', description: 'Pessoas únicas alcançadas', type: 'number', aggregate: 'sum' },
  { id: 'frequency', label: 'Frequência', description: 'Média de exibições por pessoa', type: 'text', aggregate: 'avg' },
  { id: 'unique_clicks', label: 'Cliques Únicos', description: 'Usuários únicos que clicaram', type: 'number', aggregate: 'sum' },
  { id: 'roas', label: 'ROAS', description: 'Retorno sobre gasto em anúncio', type: 'multiplier', aggregate: 'avg' },
  { id: 'conversions', label: 'Resultados (Conv.)', description: 'Número de resultados/compras registradas', type: 'number', aggregate: 'sum' },
  { id: 'conversion_value', label: 'Valor Conv.', description: 'Receita total das compras (R$)', type: 'currency', aggregate: 'sum' },
  { id: 'cost_per_conversion', label: 'Custo/Resultado', description: 'Custo médio por resultado', type: 'currency', aggregate: 'avg' },
  { id: 'leads', label: 'Leads', description: 'Leads do evento personalizado "diagnostico-result"', type: 'number', aggregate: 'sum' },
  { id: 'cost_per_lead', label: 'Custo/Lead', description: 'Custo por lead (evento "diagnostico-result"). Menor é melhor', type: 'currency', aggregate: 'avg' },
  { id: 'engagement', label: 'Engajamento', description: 'Total de engajamentos no post', type: 'number', aggregate: 'sum' },
  { id: 'video_views_25', label: 'Vídeo 25%', description: 'Reproduzões até 25% do vídeo', type: 'number', aggregate: 'sum' },
  { id: 'video_views_50', label: 'Vídeo 50%', description: 'Reproduzões até 50% do vídeo', type: 'number', aggregate: 'sum' },
  { id: 'video_views_75', label: 'Vídeo 75%', description: 'Reproduzões até 75% do vídeo', type: 'number', aggregate: 'sum' },
  { id: 'video_views_100', label: 'Vídeo 100%', description: 'Reproduzões completas do vídeo', type: 'number', aggregate: 'sum' },
];

const DEFAULT_COLUMNS: Array<keyof CampaignInsights> = ['spend', 'conversions', 'cost_per_conversion', 'clicks', 'cpc', 'ctr', 'roas'];
const COL_STORAGE_KEY = 'atlas_columns_v2';

function loadSavedColumns(): Array<keyof CampaignInsights> {
  try {
    const raw = localStorage.getItem(COL_STORAGE_KEY);
    if (!raw) return DEFAULT_COLUMNS;
    const parsed = JSON.parse(raw) as string[];
    const valid = parsed.filter((id) => COLUMN_CATALOG.some((c) => c.id === id)) as Array<keyof CampaignInsights>;
    return valid.length > 0 ? valid : DEFAULT_COLUMNS;
  } catch {
    return DEFAULT_COLUMNS;
  }
}

// ── Ticker field picker ──────────────────────────────────────────────────────

type TickerFieldId =
  | 'spend' | 'impressions' | 'clicks' | 'ctr' | 'cpc' | 'cpm' | 'roas' | 'campaigns';

const TICKER_FIELDS: Array<{ id: TickerFieldId; label: string }> = [
  { id: 'spend', label: 'Gasto' },
  { id: 'impressions', label: 'Impressões' },
  { id: 'clicks', label: 'Cliques' },
  { id: 'ctr', label: 'CTR médio' },
  { id: 'cpc', label: 'CPC médio' },
  { id: 'cpm', label: 'CPM médio' },
  { id: 'roas', label: 'ROAS' },
  { id: 'campaigns', label: 'Campanhas' },
];

const DEFAULT_TICKER_FIELDS: TickerFieldId[] = TICKER_FIELDS.map((f) => f.id);
const TICKER_STORAGE_KEY = 'atlas_ticker_fields_v1';

function loadSavedTickerFields(): TickerFieldId[] {
  try {
    const raw = localStorage.getItem(TICKER_STORAGE_KEY);
    if (!raw) return DEFAULT_TICKER_FIELDS;
    const parsed = JSON.parse(raw) as string[];
    const valid = parsed.filter((id) => TICKER_FIELDS.some((f) => f.id === id)) as TickerFieldId[];
    return valid.length > 0 ? valid : DEFAULT_TICKER_FIELDS;
  } catch {
    return DEFAULT_TICKER_FIELDS;
  }
}

function formatColValue(col: ColDef, ci: CampaignInsights, currency: string): string {
  const raw = ci[col.id];
  if (raw === undefined || raw === null || raw === 0 && ['roas', 'frequency', 'conversions', 'conversion_value', 'cost_per_conversion', 'leads', 'cost_per_lead', 'engagement', 'video_views_25', 'video_views_50', 'video_views_75', 'video_views_100', 'unique_clicks'].includes(col.id)) return '—';
  const n = Number(raw);
  if (isNaN(n)) return '—';
  switch (col.type) {
    case 'currency': return formatCurrency(n, currency);
    case 'percent': return `${n.toFixed(2)}%`;
    case 'multiplier': return `${n.toFixed(2)}x`;
    case 'text': return n.toFixed(2);
    default: return formatNumber(n);
  }
}

// ── Column Picker Panel ──────────────────────────────────────────────────────

function ColumnPickerPanel({
  visible,
  onClose,
  columns,
  onChange,
}: {
  visible: Array<keyof CampaignInsights>;
  onClose: () => void;
  columns: Array<keyof CampaignInsights>;
  onChange: (cols: Array<keyof CampaignInsights>) => void;
}) {
  const [local, setLocal] = useState<Array<keyof CampaignInsights>>(columns);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const isActive = (id: keyof CampaignInsights) => local.includes(id);

  const toggle = (id: keyof CampaignInsights) => {
    setLocal((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const onDragStart = (idx: number) => setDragIdx(idx);

  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const next = [...local];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    setDragIdx(idx);
    setLocal(next);
  };

  const onDragEnd = () => setDragIdx(null);

  const apply = () => {
    onChange(local);
    onClose();
  };

  const reset = () => setLocal([...DEFAULT_COLUMNS]);

  const activeItems = local
    .map((id) => COLUMN_CATALOG.find((c) => c.id === id)!)
    .filter(Boolean);

  const availableItems = COLUMN_CATALOG.filter((c) => !local.includes(c.id));

  return (
    <div className="flex flex-col h-full bg-[#0d0a0f] w-[300px] shrink-0 border-l border-white/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10 shrink-0">
        <Columns className="w-3.5 h-3.5 text-orange-400" />
        <p className="text-xs font-semibold text-white/90 flex-1">Colunas</p>
        <button onClick={reset} title="Restaurar padrão" className="p-1 rounded-md hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Active columns - draggable */}
        {activeItems.length > 0 && (
          <div className="p-3 border-b border-white/5">
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Ativas (arraste para reordenar)</p>
            <div className="space-y-1">
              {activeItems.map((col, idx) => (
                <div
                  key={col.id}
                  draggable
                  onDragStart={() => onDragStart(idx)}
                  onDragOver={(e) => onDragOver(e, idx)}
                  onDragEnd={onDragEnd}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border cursor-grab active:cursor-grabbing transition-all ${dragIdx === idx
                    ? 'border-orange-500/40 bg-orange-500/10'
                    : 'border-white/5 bg-white/[0.03] hover:bg-white/[0.06]'
                    }`}
                >
                  <GripVertical className="w-3 h-3 text-white/20 shrink-0" />
                  <span className="text-[11px] text-white/70 flex-1 truncate">{col.label}</span>
                  <button
                    onClick={() => toggle(col.id)}
                    className="p-0.5 rounded text-white/25 hover:text-red-400 transition-colors shrink-0"
                    title="Remover"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available columns to add */}
        {availableItems.length > 0 && (
          <div className="p-3">
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Disponíveis</p>
            <div className="space-y-1">
              {availableItems.map((col) => (
                <button
                  key={col.id}
                  onClick={() => toggle(col.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border border-white/5 bg-white/[0.015] hover:bg-white/[0.05] hover:border-orange-500/20 text-left transition-all group"
                >
                  <div className="w-3.5 h-3.5 rounded border border-white/15 group-hover:border-orange-500/40 flex items-center justify-center shrink-0 transition-colors" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-white/60 group-hover:text-white/80 font-medium truncate transition-colors">{col.label}</p>
                    <p className="text-[9px] text-white/25 truncate">{col.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Apply button */}
      <div className="p-3 border-t border-white/10 shrink-0">
        <button
          onClick={apply}
          className="w-full py-2 bg-orange-500/20 text-orange-300 rounded-xl text-xs font-semibold hover:bg-orange-500/30 transition-colors flex items-center justify-center gap-2"
        >
          <Check className="w-3.5 h-3.5" />
          Aplicar Colunas
        </button>
      </div>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────


const colorMap = {
  orange: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  green: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
  yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  pink: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20' },
} as const;

type ColorKey = keyof typeof colorMap;

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  loading,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: ColorKey;
  loading?: boolean;
}) {
  const c = colorMap[color];
  return (
    <div className={`bg-white/[0.03] border ${c.border} rounded-2xl p-3 flex flex-col gap-2`}>
      <div className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-4 h-4 ${c.text}`} />
      </div>
      <div>
        <p className="text-[11px] text-white/40 leading-tight">{label}</p>
        {loading ? (
          <div className="h-5 w-14 bg-white/10 rounded animate-pulse mt-0.5" />
        ) : (
          <p className="text-sm font-semibold text-white/90 leading-tight mt-0.5">{value}</p>
        )}
      </div>
    </div>
  );
}

// ── Utilitários ───────────────────────────────────────────────────────────────

const DATE_PRESETS = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'last_7d', label: '7 dias' },
  { value: 'last_14d', label: '14 dias' },
  { value: 'last_30d', label: '30 dias' },
  { value: 'this_month', label: 'Este mês' },
  { value: 'last_month', label: 'Mês passado' },
  { value: 'maximum', label: 'Máximo' },
];

function formatCurrency(value: number, currency = 'BRL'): string {
  if (isNaN(value)) return '—';
  if (currency === 'BRL') {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$ ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(value: number): string {
  if (isNaN(value)) return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString('pt-BR');
}

// ── Ticker estilo mercado financeiro ──────────────────────────────────────────
// Sempre compara HOJE vs ONTEM, independente do filtro de período da página.

type MetricDirection = 'higher-better' | 'lower-better' | 'neutral';

function computeDelta(
  curr: number,
  prev: number,
  direction: MetricDirection
): { pct: number | null; tone: 'up' | 'down' | 'flat' | 'none' } {
  if (!isFinite(curr) || !isFinite(prev)) return { pct: null, tone: 'none' };
  if (prev === 0) return { pct: null, tone: 'none' };
  const pct = ((curr - prev) / prev) * 100;
  if (Math.abs(pct) < 0.01) return { pct: 0, tone: 'flat' };
  const increased = pct > 0;
  if (direction === 'neutral') return { pct, tone: 'flat' };
  const good =
    (direction === 'higher-better' && increased) ||
    (direction === 'lower-better' && !increased);
  return { pct, tone: good ? 'up' : 'down' };
}

function CampaignTicker({
  today,
  yesterday,
  currency,
  enabledFields,
  onFieldsChange,
}: {
  today: AccountInsights | null;
  yesterday: AccountInsights | null;
  currency: string;
  enabledFields: TickerFieldId[];
  onFieldsChange: (fields: TickerFieldId[]) => void;
}) {
  const enabledSet = new Set(enabledFields);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Fecha o popover ao clicar fora
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerOpen]);

  const toggleField = (id: TickerFieldId) => {
    const next = enabledSet.has(id)
      ? enabledFields.filter((f) => f !== id)
      : [...enabledFields, id];
    onFieldsChange(next);
  };

  // Constrói itens do ticker: métricas agregadas da conta (hoje) + campanhas (hoje)
  const items: Array<{
    label: string;
    value: string;
    delta?: { pct: number | null; tone: 'up' | 'down' | 'flat' | 'none' };
    tone?: 'orange' | 'neutral';
  }> = [];

  if (today) {
    if (enabledSet.has('spend')) items.push({
      label: 'GASTO',
      value: formatCurrency(today.total_spend, currency),
      tone: 'orange',
      delta: yesterday ? computeDelta(today.total_spend, yesterday.total_spend, 'neutral') : undefined,
    });
    if (enabledSet.has('impressions')) items.push({
      label: 'IMPRESSÕES',
      value: formatNumber(today.total_impressions),
      delta: yesterday ? computeDelta(today.total_impressions, yesterday.total_impressions, 'higher-better') : undefined,
    });
    if (enabledSet.has('clicks')) items.push({
      label: 'CLIQUES',
      value: formatNumber(today.total_clicks),
      delta: yesterday ? computeDelta(today.total_clicks, yesterday.total_clicks, 'higher-better') : undefined,
    });
    if (enabledSet.has('ctr')) items.push({
      label: 'CTR MÉDIO',
      value: `${today.avg_ctr.toFixed(2)}%`,
      delta: yesterday ? computeDelta(today.avg_ctr, yesterday.avg_ctr, 'higher-better') : undefined,
    });
    if (enabledSet.has('cpc')) items.push({
      label: 'CPC MÉDIO',
      value: formatCurrency(today.avg_cpc, currency),
      delta: yesterday ? computeDelta(today.avg_cpc, yesterday.avg_cpc, 'lower-better') : undefined,
    });
    if (enabledSet.has('cpm')) items.push({
      label: 'CPM MÉDIO',
      value: formatCurrency(today.avg_cpm, currency),
      delta: yesterday ? computeDelta(today.avg_cpm, yesterday.avg_cpm, 'lower-better') : undefined,
    });
    if (enabledSet.has('roas') && today.avg_roas) {
      items.push({
        label: 'ROAS',
        value: `${today.avg_roas.toFixed(2)}x`,
        tone: 'orange',
        delta: yesterday ? computeDelta(today.avg_roas, yesterday.avg_roas ?? 0, 'higher-better') : undefined,
      });
    }
  }

  // Campanhas: top 12 de hoje por spend, com delta de CTR vs ontem
  if (enabledSet.has('campaigns')) {
    const yesterdayMap = new Map<string, CampaignInsights>();
    (yesterday?.campaigns ?? []).forEach((c) => yesterdayMap.set(c.campaign_id, c));

    (today?.campaigns ?? [])
      .slice()
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 12)
      .forEach((c) => {
        const short = c.campaign_name.length > 28 ? c.campaign_name.slice(0, 28) + '…' : c.campaign_name;
        const prev = yesterdayMap.get(c.campaign_id);
        const delta = prev ? computeDelta(c.ctr, prev.ctr, 'higher-better') : undefined;
        items.push({
          label: short,
          value: `${formatCurrency(c.spend, currency)} · CTR ${c.ctr.toFixed(2)}%`,
          delta,
        });
      });
  }

  const fieldPicker = (
    <div ref={pickerRef} className="absolute left-2 top-1/2 -translate-y-1/2 z-20">
      <button
        onClick={() => setPickerOpen((v) => !v)}
        title="Escolher campos"
        className={`p-1.5 rounded-md transition-colors ${
          pickerOpen ? 'bg-white/10 text-white/80' : 'text-white/25 hover:text-white/70 hover:bg-white/5'
        }`}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
      </button>
      {pickerOpen && (
        <div className="absolute left-0 top-full mt-1 w-44 bg-[#0d0a0f] border border-white/10 rounded-lg shadow-xl overflow-hidden">
          <ul className="py-1">
            {TICKER_FIELDS.map((f) => {
              const active = enabledSet.has(f.id);
              return (
                <li key={f.id}>
                  <button
                    onClick={() => toggleField(f.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    <span className={`w-3 h-3 flex items-center justify-center ${active ? 'text-orange-400' : 'text-transparent'}`}>
                      <Check className="w-3 h-3" />
                    </span>
                    <span className="flex-1 text-left">{f.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );

  if (items.length === 0) {
    return (
      <div className="relative px-4 py-2 border-b border-white/5 shrink-0">
        {fieldPicker}
        <div className="h-6 flex items-center justify-end">
          <span className="text-[10px] uppercase tracking-wider text-white/20">
            {today ? 'Nenhum campo selecionado' : 'Aguardando dados…'}
          </span>
        </div>
      </div>
    );
  }

  const renderDelta = (d?: { pct: number | null; tone: 'up' | 'down' | 'flat' | 'none' }) => {
    if (!d || d.tone === 'none' || d.pct === null) {
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-white/25">
          —
        </span>
      );
    }
    const colorClass =
      d.tone === 'up' ? 'text-emerald-400' : d.tone === 'down' ? 'text-rose-400' : 'text-white/40';
    const sign = d.pct > 0 ? '+' : '';
    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] font-mono tabular-nums ${colorClass}`}>
        {d.pct > 0 ? (
          <ArrowUp className="w-2.5 h-2.5" />
        ) : d.pct < 0 ? (
          <ArrowDown className="w-2.5 h-2.5" />
        ) : null}
        {sign}
        {d.pct.toFixed(2)}%
      </span>
    );
  };

  // Duplica para loop contínuo
  const renderRow = (keyPrefix: string) =>
    items.map((it, i) => (
      <span
        key={`${keyPrefix}-${i}`}
        className="inline-flex items-center gap-2 px-4 border-r border-white/5 whitespace-nowrap"
      >
        <span
          className={`text-[10px] uppercase tracking-wider ${
            it.tone === 'orange' ? 'text-orange-400/80' : 'text-white/35'
          }`}
        >
          {it.label}
        </span>
        <span className="text-xs font-mono text-white/85 tabular-nums">{it.value}</span>
        {renderDelta(it.delta)}
      </span>
    ));

  // Duração proporcional à quantidade de itens (velocidade "natural")
  const durationSec = Math.max(30, items.length * 4);

  // Duplica N vezes para preencher telas largas mesmo com poucos itens.
  // translateX avança exatamente 1/N para emendar seamless ao reiniciar.
  const COPIES = 8;
  const copies = Array.from({ length: COPIES }, (_, i) => i);

  return (
    <div className="relative w-full border-y border-white/5 bg-gradient-to-r from-black/60 via-white/[0.02] to-black/60 shrink-0 overflow-visible">
      <div className="relative overflow-hidden">
        {/* fades laterais */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#0d0a0f] to-transparent z-10" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#0d0a0f] to-transparent z-10" />

        <div
          className="flex items-center py-2.5 animate-[ticker-scroll_var(--ticker-duration)_linear_infinite] hover:[animation-play-state:paused]"
          style={{ ['--ticker-duration' as any]: `${durationSec}s`, width: 'max-content' }}
        >
          {copies.map((i) => renderRow(String(i)))}
        </div>
      </div>
      {fieldPicker}

      <style jsx>{`
        @keyframes ticker-scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(calc(-100% / ${COPIES}));
          }
        }
      `}</style>
    </div>
  );
}

export function TrafficSession({ onClose }: TrafficSessionProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState('');
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [insights, setInsights] = useState<AccountInsights | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [datePreset, setDatePreset] = useState('last_30d');

  // Ticker "bolsa de valores": sempre hoje vs ontem, independente do datePreset
  const [tickerToday, setTickerToday] = useState<AccountInsights | null>(null);
  const [tickerYesterday, setTickerYesterday] = useState<AccountInsights | null>(null);
  const [tickerFields, setTickerFields] = useState<TickerFieldId[]>(DEFAULT_TICKER_FIELDS);
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Filtro de status
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');

  // Ad sets e ads (expandable)
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [adSets, setAdSets] = useState<Map<string, AdSet[]>>(new Map());
  const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(new Set());
  const [ads, setAds] = useState<Map<string, Ad[]>>(new Map());
  const [loadingAdSets, setLoadingAdSets] = useState<Set<string>>(new Set());
  const [loadingAds, setLoadingAds] = useState<Set<string>>(new Set());

  // Atlas AI Chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Column picker
  const [visibleColumns, setVisibleColumns] = useState<Array<keyof CampaignInsights>>(DEFAULT_COLUMNS);
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const accountPickerRef = useRef<HTMLDivElement>(null);

  // Fecha o picker ao clicar fora
  useEffect(() => {
    if (!datePickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setDatePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [datePickerOpen]);

  useEffect(() => {
    if (!accountPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (accountPickerRef.current && !accountPickerRef.current.contains(e.target as Node)) {
        setAccountPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [accountPickerOpen]);

  // Load saved columns on mount
  useEffect(() => {
    setVisibleColumns(loadSavedColumns());
    setTickerFields(loadSavedTickerFields());
  }, []);

  const handleTickerFieldsChange = (fields: TickerFieldId[]) => {
    setTickerFields(fields);
    try { localStorage.setItem(TICKER_STORAGE_KEY, JSON.stringify(fields)); } catch { /* noop */ }
  };

  // Persist columns when they change
  const handleColumnsChange = (cols: Array<keyof CampaignInsights>) => {
    setVisibleColumns(cols);
    try { localStorage.setItem(COL_STORAGE_KEY, JSON.stringify(cols)); } catch { /* noop */ }
  };

  const activeColDefs = visibleColumns
    .map((id) => COLUMN_CATALOG.find((c) => c.id === id)!)
    .filter(Boolean);

  // Carregar workspaces ao montar
  useEffect(() => {
    fetch(`${API_URL}/api/traffic/workspaces`)
      .then((r) => r.json())
      .then((data: Workspace[]) => {
        setWorkspaces(data);
        if (data.length > 0) setSelectedWorkspace(data[0].id);
      })
      .catch(() => setError('Tokens Meta ADS não configurados. Verifique o arquivo .env.'));
  }, []);

  // Carregar contas ao trocar de workspace
  useEffect(() => {
    if (!selectedWorkspace) return;
    setAccounts([]);
    setSelectedAccount('');
    setInsights(null);
    setCampaigns([]);
    setInitialized(false);

    fetch(`${API_URL}/api/traffic/accounts?workspace=${selectedWorkspace}`)
      .then((r) => r.json())
      .then((data: AdAccount[]) => {
        if ((data as any).error) throw new Error((data as any).error);
        setAccounts(data);
        if (data.length > 0) setSelectedAccount(data[0].id);
      })
      .catch((e) => setError(e.message || 'Erro ao carregar contas do Meta'));
  }, [selectedWorkspace]);

  // Carregar dashboard ao trocar conta ou período
  const loadDashboard = useCallback(async () => {
    if (!selectedAccount || !selectedWorkspace) return;
    setLoading(true);
    setError(null);

    try {
      const [insightsRes, campaignsRes] = await Promise.all([
        fetch(
          `${API_URL}/api/traffic/insights?accountId=${selectedAccount}&workspace=${selectedWorkspace}&datePreset=${datePreset}`
        ),
        fetch(
          `${API_URL}/api/traffic/campaigns?accountId=${selectedAccount}&workspace=${selectedWorkspace}`
        ),
      ]);

      const [insightsData, campaignsData] = await Promise.all([
        insightsRes.json(),
        campaignsRes.json(),
      ]);

      if (insightsData.error) throw new Error(insightsData.error);
      if (campaignsData.error) throw new Error(campaignsData.error);

      setInsights(insightsData);
      setCampaigns(campaignsData);
      setInitialized(true);
    } catch (e: any) {
      const msg: string = e.message || '';
      const isRateLimit = msg.includes('80004') || msg.toLowerCase().includes('too many calls');
      setError(isRateLimit
        ? 'rate_limit'
        : msg || 'Erro ao carregar dados do Meta ADS'
      );
    } finally {
      setLoading(false);
    }
  }, [selectedAccount, selectedWorkspace, datePreset]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Ticker: busca hoje e ontem uma vez por conta/workspace (sem dependência de insights)
  useEffect(() => {
    if (!selectedAccount || !selectedWorkspace) {
      setTickerToday(null);
      setTickerYesterday(null);
      return;
    }
    let cancelled = false;
    const fetchTicker = async () => {
      try {
        const [tRes, yRes] = await Promise.all([
          fetch(`${API_URL}/api/traffic/insights?accountId=${selectedAccount}&workspace=${selectedWorkspace}&datePreset=today`),
          fetch(`${API_URL}/api/traffic/insights?accountId=${selectedAccount}&workspace=${selectedWorkspace}&datePreset=yesterday`),
        ]);
        const [t, y] = await Promise.all([tRes.json(), yRes.json()]);
        if (cancelled) return;
        setTickerToday(t?.error ? null : t);
        setTickerYesterday(y?.error ? null : y);
      } catch {
        if (!cancelled) { setTickerToday(null); setTickerYesterday(null); }
      }
    };
    fetchTicker();
    return () => { cancelled = true; };
  }, [selectedAccount, selectedWorkspace]);

  // Sync: quando o dashboard já carregou today/yesterday, propaga pro ticker sem fetch extra
  useEffect(() => {
    if (!insights) return;
    if (datePreset === 'today') setTickerToday(insights);
    else if (datePreset === 'yesterday') setTickerYesterday(insights);
  }, [insights, datePreset]);

  const handlePause = async (campaignId: string) => {
    setLoadingAction(campaignId);
    try {
      const res = await fetch(`${API_URL}/api/traffic/campaigns/${campaignId}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace: selectedWorkspace }),
      });
      if (!res.ok) throw new Error('Falha ao pausar campanha');
      await loadDashboard();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleEnable = async (campaignId: string) => {
    setLoadingAction(campaignId);
    try {
      const res = await fetch(`${API_URL}/api/traffic/campaigns/${campaignId}/enable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace: selectedWorkspace }),
      });
      if (!res.ok) throw new Error('Falha ao ativar campanha');
      await loadDashboard();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingAction(null);
    }
  };

  const currency = accounts.find((a) => a.id === selectedAccount)?.currency ?? 'BRL';
  const accountName = accounts.find((a) => a.id === selectedAccount)?.name;

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const sendChatMessage = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading || !selectedAccount) return;

    const userMsg: ChatMessage = { role: 'user', content: msg };
    const history = chatMessages.map((m) => ({ role: m.role, content: m.content }));

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/traffic/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history,
          workspace: selectedWorkspace,
          accountId: selectedAccount,
          accountName,
          currency,
          datePreset,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.reply,
        actionExecuted: data.actionExecuted,
      };
      setChatMessages((prev) => [...prev, assistantMsg]);

      // Refresh data if an action was executed
      if (data.actionExecuted) {
        await loadDashboard();
      }
    } catch (e: any) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Erro: ${e.message}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (analyzing || !selectedAccount) return;
    setAnalyzing(true);
    setChatOpen(true);

    const triggerMsg: ChatMessage = {
      role: 'user',
      content: '📊 Analisar conta completa agora',
    };
    setChatMessages((prev) => [...prev, triggerMsg]);

    try {
      const res = await fetch(`${API_URL}/api/traffic/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace: selectedWorkspace,
          accountId: selectedAccount,
          accountName,
          currency,
          datePreset,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.analysis },
      ]);
    } catch (e: any) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Erro na análise: ${e.message}` },
      ]);
    } finally {
      setAnalyzing(false);
    }
  };

  // Campanhas filtradas por status
  const filteredCampaigns = campaigns.filter((c) => {
    if (statusFilter === 'active') return c.status === 'ACTIVE';
    if (statusFilter === 'paused') return c.status === 'PAUSED';
    return true;
  });

  // Calcular totais das campanhas filtradas
  const filteredTotals = filteredCampaigns.reduce(
    (acc, campaign) => {
      const ci = insights?.campaigns.find((c) => c.campaign_id === campaign.id);
      if (ci) {
        acc.spend += ci.spend;
        acc.impressions += ci.impressions;
        acc.clicks += ci.clicks;
      }
      return acc;
    },
    { spend: 0, impressions: 0, clicks: 0 }
  );

  const avgFilteredCtr = filteredTotals.impressions > 0
    ? (filteredTotals.clicks / filteredTotals.impressions) * 100
    : 0;

  const avgFilteredCpc = filteredTotals.clicks > 0
    ? filteredTotals.spend / filteredTotals.clicks
    : 0;

  // Expandir/colapsar campanha → carregar ad sets lazy
  const toggleCampaign = async (campaignId: string) => {
    const next = new Set(expandedCampaigns);
    if (next.has(campaignId)) {
      next.delete(campaignId);
    } else {
      next.add(campaignId);
      if (!adSets.has(campaignId) && !loadingAdSets.has(campaignId)) {
        setLoadingAdSets((prev) => new Set(prev).add(campaignId));
        try {
          const res = await fetch(
            `${API_URL}/api/traffic/adsets?campaignId=${campaignId}&workspace=${selectedWorkspace}`
          );
          const data = await res.json();
          setAdSets((prev) => new Map(prev).set(campaignId, Array.isArray(data) ? data : []));
        } catch {
          setAdSets((prev) => new Map(prev).set(campaignId, []));
        } finally {
          setLoadingAdSets((prev) => { const s = new Set(prev); s.delete(campaignId); return s; });
        }
      }
    }
    setExpandedCampaigns(next);
  };

  // Expandir/colapsar ad set → carregar ads lazy
  const toggleAdSet = async (adSetId: string) => {
    const next = new Set(expandedAdSets);
    if (next.has(adSetId)) {
      next.delete(adSetId);
    } else {
      next.add(adSetId);
      if (!ads.has(adSetId) && !loadingAds.has(adSetId)) {
        setLoadingAds((prev) => new Set(prev).add(adSetId));
        try {
          const res = await fetch(
            `${API_URL}/api/traffic/ads?adsetId=${adSetId}&workspace=${selectedWorkspace}`
          );
          const data = await res.json();
          setAds((prev) => new Map(prev).set(adSetId, Array.isArray(data) ? data : []));
        } catch {
          setAds((prev) => new Map(prev).set(adSetId, []));
        } finally {
          setLoadingAds((prev) => { const s = new Set(prev); s.delete(adSetId); return s; });
        }
      }
    }
    setExpandedAdSets(next);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-[#0d0a0f] text-white overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          title="Voltar"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-orange-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">Atlas — Traffic Squad</p>
            <p className="text-xs text-white/40 leading-tight truncate">Meta ADS Manager</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {/* Seletor de conta — popup */}
          <div ref={accountPickerRef} className="relative">
            <button
              onClick={() => setAccountPickerOpen((v) => !v)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors max-w-[200px] ${
                accountPickerOpen
                  ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                  : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:border-orange-500/20 hover:text-white/90'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span className="truncate max-w-[160px]">
                {accountName ?? (accounts.length === 0 ? 'Carregando...' : 'Selecionar conta')}
              </span>
              <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${accountPickerOpen ? 'rotate-180' : ''}`} />
            </button>

            {accountPickerOpen && accounts.length > 0 && (
              <div className="absolute right-0 top-full mt-1.5 w-72 rounded-xl border border-white/10 bg-[#141014]/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-white/5">
                  <p className="text-[10px] uppercase tracking-wider text-white/40">Contas de anúncio</p>
                </div>
                <div className="py-1 max-h-64 overflow-y-auto">
                  {accounts.map((a) => {
                    const isActive = a.account_status === 1;
                    const isSelected = a.id === selectedAccount;
                    return (
                      <button
                        key={a.id}
                        onClick={() => { setSelectedAccount(a.id); setAccountPickerOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                          isSelected
                            ? 'bg-orange-500/15 text-orange-300'
                            : 'text-white/70 hover:bg-white/5 hover:text-white/90'
                        }`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-green-400' : 'bg-white/20'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs truncate font-medium">{a.name}</p>
                          <p className="text-[10px] text-white/35">{a.currency}</p>
                        </div>
                        {isSelected && <Check className="w-3 h-3 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Botão Atlas AI */}
          {initialized && (
            <button
              onClick={() => setChatOpen((v) => !v)}
              title="Abrir Atlas AI"
              className={`p-1.5 rounded-lg transition-colors ${chatOpen
                ? 'bg-orange-500/30 text-orange-300'
                : 'hover:bg-white/10 text-white/60 hover:text-orange-300'
                }`}
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          )}

          {/* Date filter dropdown (tabela de campanhas) */}
          <div ref={datePickerRef} className="relative">
            <button
              onClick={() => setDatePickerOpen((v) => !v)}
              title="Período da tabela"
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                datePickerOpen
                  ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                  : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white/80'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {DATE_PRESETS.find((p) => p.value === datePreset)?.label ?? 'Período'}
              </span>
              <ChevronDown className={`w-3 h-3 transition-transform ${datePickerOpen ? 'rotate-180' : ''}`} />
            </button>
            {datePickerOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border border-white/10 bg-[#141014]/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-white/5">
                  <p className="text-[10px] uppercase tracking-wider text-white/40">Período da tabela</p>
                </div>
                <div className="py-1">
                  {DATE_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => {
                        setDatePreset(p.value);
                        setDatePickerOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors ${
                        datePreset === p.value
                          ? 'bg-orange-500/15 text-orange-300'
                          : 'text-white/70 hover:bg-white/5 hover:text-white/90'
                      }`}
                    >
                      <span>{p.label}</span>
                      {datePreset === p.value && <Check className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Botão de refresh */}
          <button
            onClick={loadDashboard}
            disabled={loading || !selectedAccount}
            title="Atualizar dados"
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-orange-300 disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Ticker (estilo mercado financeiro) ── */}
      <CampaignTicker
        today={tickerToday}
        yesterday={tickerYesterday}
        currency={currency}
        enabledFields={tickerFields}
        onFieldsChange={handleTickerFieldsChange}
      />

      {/* ── Conteúdo principal + chat ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Conteúdo unificado: Comparação (cards) + Tabela de Campanhas */}
        <div className="flex-1 overflow-y-auto">
          {/* Banner discreto de rate limit quando há dados existentes */}
          {error === 'rate_limit' && initialized && (
            <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-400/80 text-[11px]">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Limite da Meta atingido — exibindo dados anteriores. Atualização automática em breve.</span>
              <button onClick={loadDashboard} className="ml-auto shrink-0 underline hover:text-yellow-300 transition-colors">
                Tentar agora
              </button>
            </div>
          )}
          {/* Loading inicial */}
          {loading && !initialized ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
                <p className="text-white/40 text-sm">Carregando dados do Meta ADS…</p>
              </div>
            </div>
          ) : error && (!initialized || error !== 'rate_limit') ? (
            /* Error state — rate_limit com dados existentes não bloqueia */
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3 text-center px-8 max-w-sm">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
                <p className="text-white/60 text-sm leading-relaxed">
                  {error === 'rate_limit'
                    ? 'Limite de requisições da Meta atingido. Aguarde alguns minutos e tente novamente.'
                    : error}
                </p>
                <button
                  onClick={loadDashboard}
                  className="text-xs px-4 py-2 bg-orange-500/20 text-orange-300 rounded-lg hover:bg-orange-500/30 transition-colors"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          ) : !selectedAccount ? (
            /* Sem conta selecionada */
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3 text-center px-8">
                <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <Activity className="w-6 h-6 text-orange-400" />
                </div>
                <p className="text-white/50 text-sm">Selecione uma conta para ver o dashboard</p>
              </div>
            </div>
          ) : (
            /* Dashboard unificado */
            <div className="space-y-4">

              {/* Seção de Comparação (liquid glass) */}
              <AtlasCompareTab
                selectedAccount={selectedAccount}
                selectedWorkspace={selectedWorkspace}
                currency={currency}
                fallbackPreset={{
                  value: datePreset,
                  label: DATE_PRESETS.find((p) => p.value === datePreset)?.label ?? datePreset,
                }}
              />

              <div className="px-4 space-y-4">
              {/* Tabela de Campanhas */}
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
                {/* Header + Filtros */}
                <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3 flex-wrap">
                  <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-orange-400" />
                    Campanhas
                  </h3>
                  <div className="flex items-center gap-2">
                    {/* Filtro de status */}
                    {(['all', 'active', 'paused'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setStatusFilter(f)}
                        className={`text-[10px] px-2.5 py-1 rounded-full transition-all ${statusFilter === f
                          ? f === 'active'
                            ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                            : f === 'paused'
                              ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                              : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                          : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
                          }`}
                      >
                        {f === 'all' ? 'Todas' : f === 'active' ? 'Ativas' : 'Pausadas'}
                      </button>
                    ))}
                    <span className="text-xs text-white/30 px-2 py-0.5 bg-white/5 rounded-full ml-1">
                      {filteredCampaigns.length}/{campaigns.length}
                    </span>
                    {/* Colunas button */}
                    <button
                      onClick={() => setColumnPickerOpen((v) => !v)}
                      title="Gerenciar colunas"
                      className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full transition-all border ${columnPickerOpen
                        ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                        : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white/70'
                        }`}
                    >
                      <Columns className="w-3 h-3" />
                      Colunas
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/5 text-white/30">
                        <th className="w-6 px-2 py-2.5" />
                        <th className="text-left px-3 py-2.5 font-medium">Campanha</th>
                        <th className="text-center px-3 py-2.5 font-medium">Status</th>
                        {activeColDefs.map((col) => (
                          <th key={col.id} className="text-right px-3 py-2.5 font-medium whitespace-nowrap">{col.label}</th>
                        ))}
                        <th className="text-center px-3 py-2.5 font-medium">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCampaigns.length === 0 ? (
                        <tr>
                          <td colSpan={3 + activeColDefs.length + 1} className="px-4 py-10 text-center text-white/25 text-sm">
                            Nenhuma campanha encontrada
                          </td>
                        </tr>
                      ) : (
                        filteredCampaigns.map((campaign) => {
                          const ci = insights?.campaigns.find((c) => c.campaign_id === campaign.id);
                          const isActive = campaign.status === 'ACTIVE';
                          const isActionable = campaign.status !== 'DELETED' && campaign.status !== 'ARCHIVED';
                          const isLoadingThis = loadingAction === campaign.id;
                          const isExpanded = expandedCampaigns.has(campaign.id);
                          const isLoadingAdSets = loadingAdSets.has(campaign.id);
                          const campaignAdSets = adSets.get(campaign.id) ?? [];

                          return (
                            <React.Fragment key={campaign.id}>
                              {/* Linha da campanha */}
                              <tr
                                className="border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors"
                              >
                                {/* Expand toggle */}
                                <td className="px-2 py-3 text-center">
                                  <button
                                    onClick={() => toggleCampaign(campaign.id)}
                                    className="p-0.5 rounded text-white/30 hover:text-white/70 transition-colors"
                                    title="Ver conjuntos de anúncios"
                                  >
                                    {isLoadingAdSets ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : isExpanded ? (
                                      <ChevronDown className="w-3 h-3" />
                                    ) : (
                                      <ChevronRight className="w-3 h-3" />
                                    )}
                                  </button>
                                </td>

                                {/* Nome */}
                                <td className="px-3 py-3">
                                  <div className="min-w-[250px] max-w-[400px]">
                                    <p className="line-clamp-2 text-white/80 font-medium leading-snug">{campaign.name}</p>
                                    <p className="text-white/25 text-[10px] mt-0.5 uppercase tracking-wide">
                                      {campaign.objective?.replace(/_/g, ' ')}
                                    </p>
                                  </div>
                                </td>

                                {/* Status */}
                                <td className="px-3 py-3 text-center">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${isActive
                                    ? 'bg-green-500/15 text-green-400'
                                    : campaign.status === 'PAUSED'
                                      ? 'bg-yellow-500/15 text-yellow-400'
                                      : 'bg-white/5 text-white/30'
                                    }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
                                    {isActive ? 'Ativo' : campaign.status === 'PAUSED' ? 'Pausado' : campaign.status}
                                  </span>
                                </td>

                                {/* Métricas dinâmicas */}
                                {activeColDefs.map((col) => (
                                  <td key={col.id} className="px-3 py-3 text-right text-white/60 whitespace-nowrap">
                                    {ci ? formatColValue(col, ci, currency) : '—'}
                                  </td>
                                ))}

                                {/* Ação */}
                                <td className="px-3 py-3 text-center">
                                  {isActionable && (
                                    <button
                                      onClick={() => isActive ? handlePause(campaign.id) : handleEnable(campaign.id)}
                                      disabled={isLoadingThis}
                                      title={isActive ? 'Pausar campanha' : 'Ativar campanha'}
                                      className={`p-1.5 rounded-lg transition-all disabled:opacity-40 ${isActive
                                        ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/25'
                                        : 'bg-green-500/10 text-green-400 hover:bg-green-500/25'
                                        }`}
                                    >
                                      {isLoadingThis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                    </button>
                                  )}
                                </td>
                              </tr>

                              {/* Ad Sets expandidos */}
                              {isExpanded && (
                                <>
                                  {campaignAdSets.length === 0 && !isLoadingAdSets ? (
                                    <tr className="bg-white/[0.015]">
                                      <td colSpan={9} className="pl-10 pr-4 py-2 text-[11px] text-white/25 italic">
                                        Nenhum conjunto encontrado
                                      </td>
                                    </tr>
                                  ) : (
                                    campaignAdSets.map((adSet) => {
                                      const isAdSetExpanded = expandedAdSets.has(adSet.id);
                                      const isLoadingAdsNow = loadingAds.has(adSet.id);
                                      const adSetAds = ads.get(adSet.id) ?? [];
                                      const adSetActive = adSet.status === 'ACTIVE';

                                      return (
                                        <React.Fragment key={adSet.id}>
                                          {/* Linha do ad set */}
                                          <tr className="bg-white/[0.02] border-b border-white/[0.03] hover:bg-white/[0.035] transition-colors">
                                            <td className="px-2 py-2 text-center" />
                                            <td className="py-2 pl-8 pr-3" colSpan={1}>
                                              <div className="flex items-center gap-2">
                                                <button
                                                  onClick={() => toggleAdSet(adSet.id)}
                                                  className="p-0.5 rounded text-white/25 hover:text-white/60 transition-colors shrink-0"
                                                >
                                                  {isLoadingAdsNow ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                  ) : isAdSetExpanded ? (
                                                    <ChevronDown className="w-3 h-3" />
                                                  ) : (
                                                    <ChevronRight className="w-3 h-3" />
                                                  )}
                                                </button>
                                                <Layers className="w-3 h-3 text-blue-400/60 shrink-0" />
                                                <span className="text-white/60 text-[11px] line-clamp-2 max-w-[300px] leading-tight">{adSet.name}</span>
                                              </div>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${adSetActive ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
                                                }`}>
                                                {adSetActive ? 'Ativo' : 'Pausado'}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2 text-right text-white/30 text-[10px]">
                                              {adSet.daily_budget
                                                ? formatCurrency(parseInt(adSet.daily_budget) / 100, currency) + '/dia'
                                                : adSet.lifetime_budget
                                                  ? formatCurrency(parseInt(adSet.lifetime_budget) / 100, currency) + ' total'
                                                  : '—'}
                                            </td>
                                            <td colSpan={5} className="px-3 py-2 text-white/25 text-[10px]">
                                              {adSet.optimization_goal?.replace(/_/g, ' ')}
                                            </td>
                                          </tr>

                                          {/* Ads expandidos */}
                                          {isAdSetExpanded && (
                                            <>
                                              {adSetAds.length === 0 && !isLoadingAdsNow ? (
                                                <tr className="bg-white/[0.01]">
                                                  <td colSpan={9} className="pl-16 pr-4 py-2 text-[11px] text-white/20 italic">
                                                    Nenhum anúncio encontrado
                                                  </td>
                                                </tr>
                                              ) : (
                                                adSetAds.map((ad) => {
                                                  const creative = ad.creative;
                                                  const adActive = ad.status === 'ACTIVE';
                                                  return (
                                                    <tr key={ad.id} className="bg-white/[0.01] border-b border-white/[0.02]">
                                                      <td colSpan={2} className="pl-14 pr-3 py-2.5">
                                                        <div className="flex items-start gap-2.5">
                                                          {/* Thumbnail do criativo */}
                                                          <div className="w-10 h-10 rounded-md bg-white/5 border border-white/10 shrink-0 overflow-hidden flex items-center justify-center">
                                                            {creative?.thumbnail_url || creative?.image_url ? (
                                                              // eslint-disable-next-line @next/next/no-img-element
                                                              <img
                                                                src={creative.thumbnail_url ?? creative.image_url}
                                                                alt="criativo"
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => {
                                                                  (e.target as HTMLImageElement).style.display = 'none';
                                                                }}
                                                              />
                                                            ) : (
                                                              <ImageIcon className="w-4 h-4 text-white/20" />
                                                            )}
                                                          </div>
                                                          {/* Texto do criativo */}
                                                          <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                              <FileText className="w-2.5 h-2.5 text-purple-400/60 shrink-0" />
                                                              <p className="text-white/55 text-[11px] font-medium line-clamp-2 leading-tight max-w-[300px]">{ad.name}</p>
                                                            </div>
                                                            {creative?.title && (
                                                              <p className="text-white/70 text-[11px] font-semibold line-clamp-2 leading-tight max-w-[300px]">{creative.title}</p>
                                                            )}
                                                            {creative?.body && (
                                                              <p className="text-white/35 text-[10px] line-clamp-2 leading-relaxed mt-0.5">{creative.body}</p>
                                                            )}
                                                            {creative?.call_to_action_type && (
                                                              <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20">
                                                                {creative.call_to_action_type.replace(/_/g, ' ')}
                                                              </span>
                                                            )}
                                                          </div>
                                                        </div>
                                                      </td>
                                                      <td className="px-3 py-2 text-center">
                                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${adActive ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
                                                          }`}>
                                                          {adActive ? 'Ativo' : 'Pausado'}
                                                        </span>
                                                      </td>
                                                      <td colSpan={6} className="px-3 py-2 text-white/20 text-[10px]">
                                                        ID: {ad.id}
                                                      </td>
                                                    </tr>
                                                  );
                                                })
                                              )}
                                            </>
                                          )}
                                          </React.Fragment>
                                      );
                                    })
                                  )}
                                </>
                              )}
                              </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                    {filteredCampaigns.length > 0 && insights && (
                      <tfoot className="border-t border-white/10 bg-white/[0.015]">
                        <tr className="text-white/80 font-medium">
                          <td colSpan={3} className="px-3 py-3 pl-8 text-right text-[11px] uppercase tracking-wider text-white/50">
                            Total / Média
                          </td>
                          {activeColDefs.map((col) => {
                            const ciList = filteredCampaigns
                              .map((camp) => insights.campaigns.find((c) => c.campaign_id === camp.id))
                              .filter(Boolean) as CampaignInsights[];

                            let footerVal = '—';
                            if (col.aggregate === 'sum') {
                              const total = ciList.reduce((acc, c) => acc + (Number(c[col.id]) || 0), 0);
                              footerVal = total > 0 ? formatColValue(col, { ...ciList[0], [col.id]: total } as CampaignInsights, currency) : '—';
                            } else if (col.aggregate === 'avg') {
                              // Weighted avg for rates, simple avg for others
                              if (col.id === 'ctr') {
                                const totalClicks = ciList.reduce((a, c) => a + (c.clicks || 0), 0);
                                const totalImpr = ciList.reduce((a, c) => a + (c.impressions || 0), 0);
                                const avg = totalImpr > 0 ? (totalClicks / totalImpr) * 100 : 0;
                                footerVal = avg > 0 ? `${avg.toFixed(2)}%` : '—';
                              } else if (col.id === 'cpc') {
                                const totalSpend = ciList.reduce((a, c) => a + (c.spend || 0), 0);
                                const totalClicks = ciList.reduce((a, c) => a + (c.clicks || 0), 0);
                                const avg = totalClicks > 0 ? totalSpend / totalClicks : 0;
                                footerVal = avg > 0 ? formatCurrency(avg, currency) : '—';
                              } else if (col.id === 'cpm') {
                                const totalSpend = ciList.reduce((a, c) => a + (c.spend || 0), 0);
                                const totalImpr = ciList.reduce((a, c) => a + (c.impressions || 0), 0);
                                const avg = totalImpr > 0 ? (totalSpend / totalImpr) * 1000 : 0;
                                footerVal = avg > 0 ? formatCurrency(avg, currency) : '—';
                              } else {
                                const vals = ciList.map((c) => Number(c[col.id]) || 0).filter((v) => v > 0);
                                const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
                                footerVal = avg > 0 ? formatColValue(col, { ...ciList[0], [col.id]: avg } as CampaignInsights, currency) : '—';
                              }
                            }

                            return (
                              <td key={col.id} className="px-3 py-3 text-right text-orange-400 whitespace-nowrap">
                                {footerVal}
                              </td>
                            );
                          })}
                          <td className="px-3 py-3 text-center" />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Rodapé com timestamp */}
              {initialized && (
                <p className="text-center text-[10px] text-white/20 pb-2">
                  Dados do Meta ADS • Atualizado em {new Date().toLocaleTimeString('pt-BR')}
                </p>
              )}
              </div>{/* fim px-4 wrapper */}
            </div>
          )}
        </div>{/* fim dashboard scroll */}

        {/* ── Column Picker Panel ── */}
        {columnPickerOpen && (
          <ColumnPickerPanel
            visible={visibleColumns}
            columns={visibleColumns}
            onClose={() => setColumnPickerOpen(false)}
            onChange={handleColumnsChange}
          />
        )}

        {/* ── Atlas AI Chat Panel ── */}
        {chatOpen && (
          <div className="w-[340px] shrink-0 flex flex-col border-l border-white/10 bg-[#0d0a0f]">
            {/* Chat header */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10 shrink-0">
              <div className="w-6 h-6 rounded-md bg-orange-500/20 flex items-center justify-center">
                <BrainCircuit className="w-3.5 h-3.5 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white/90 leading-tight">Atlas AI</p>
                <p className="text-[10px] text-white/35 leading-tight">Gerente de tráfego autônomo</p>
              </div>
              <button
                onClick={runAnalysis}
                disabled={analyzing || !initialized}
                title="Analisar conta completa"
                className="text-[10px] px-2 py-1 bg-orange-500/15 text-orange-300 rounded-md hover:bg-orange-500/25 transition-colors disabled:opacity-40 flex items-center gap-1"
              >
                {analyzing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Zap className="w-3 h-3" />
                )}
                Analisar
              </button>
              <button
                onClick={() => setChatOpen(false)}
                className="p-1 rounded-md hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
                  <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                    <BrainCircuit className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white/60">Olá! Sou o Atlas.</p>
                    <p className="text-[11px] text-white/30 mt-1 leading-relaxed">
                      Posso analisar suas campanhas, identificar problemas e executar otimizações automaticamente.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 w-full mt-1">
                    {[
                      'Quais campanhas estão com CTR baixo?',
                      'Pause campanhas com CPC acima de R$5',
                      'Faça uma análise completa da conta',
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => { setChatInput(suggestion); }}
                        className="text-left text-[10px] px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white/50 hover:bg-white/10 hover:text-white/70 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                chatMessages.map((msg, i) => (
                  <div key={i} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`max-w-[90%] text-[11px] leading-relaxed rounded-xl px-3 py-2 whitespace-pre-wrap ${msg.role === 'user'
                        ? 'bg-orange-500/20 text-orange-100 rounded-br-sm'
                        : 'bg-white/[0.06] text-white/80 rounded-bl-sm'
                        }`}
                    >
                      {msg.content}
                    </div>
                    {msg.actionExecuted && (
                      <div className="flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-2 py-1 max-w-[90%]">
                        <Activity className="w-3 h-3 shrink-0" />
                        {msg.actionExecuted}
                      </div>
                    )}
                  </div>
                ))
              )}
              {chatLoading && (
                <div className="flex items-start gap-2">
                  <div className="bg-white/[0.06] rounded-xl rounded-bl-sm px-3 py-2.5 flex gap-1.5 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400/60 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400/60 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400/60 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-2.5 border-t border-white/10 shrink-0">
              <div className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus-within:border-orange-500/40 transition-colors">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendChatMessage();
                    }
                  }}
                  placeholder="Pergunte ao Atlas…"
                  rows={1}
                  className="flex-1 bg-transparent text-[11px] text-white/80 placeholder:text-white/25 outline-none resize-none leading-relaxed max-h-24 overflow-y-auto"
                />
                <button
                  onClick={sendChatMessage}
                  disabled={!chatInput.trim() || chatLoading}
                  className="p-1.5 rounded-lg bg-orange-500/20 text-orange-300 hover:bg-orange-500/35 transition-colors disabled:opacity-40 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[9px] text-white/20 mt-1.5 text-center">
                Enter para enviar • Shift+Enter para nova linha
              </p>
            </div>
          </div>
        )}

      </div>{/* fim flex conteúdo */}
    </div>
  );
}
