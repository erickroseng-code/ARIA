'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, AreaChart, Area,
} from 'recharts';
import {
  Plus, X, Loader2, TrendingUp, TrendingDown, Minus,
  Info, GitCompare, Sparkles, ChevronDown, Check, Trophy,
  Image as ImageIcon, SlidersHorizontal,
} from 'lucide-react';

// ── Tipos ─────────────────────────────────────────────────────────────────────

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
  conversions?: number;
  conversion_value?: number;
}

interface AccountInsights {
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  avg_ctr: number;
  avg_cpm: number;
  avg_cpc: number;
  avg_roas: number;
  campaigns: CampaignInsights[];
}

interface TimeseriesPoint {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  conversions: number;
}

interface PeriodData {
  preset: string;
  label: string;
  insights: AccountInsights | null;
  series: TimeseriesPoint[];
  loading: boolean;
  error: string | null;
}

interface AtlasCompareTabProps {
  selectedAccount: string;
  selectedWorkspace: string;
  currency: string;
  fallbackPreset?: { value: string; label: string };
}

// ── Constantes ────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const DATE_PRESETS = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'last_7d', label: 'Últimos 7 dias' },
  { value: 'last_14d', label: 'Últimos 14 dias' },
  { value: 'last_30d', label: 'Últimos 30 dias' },
  { value: 'this_month', label: 'Este mês' },
  { value: 'last_month', label: 'Mês passado' },
  { value: 'maximum', label: 'Máximo' },
];

const COMPARE_SHORTCUTS = [
  {
    id: 'today_yesterday',
    title: 'Hoje × Ontem',
    description: 'Últimas 24 horas vs. dia anterior',
    periods: [
      { value: 'today', label: 'Hoje' },
      { value: 'yesterday', label: 'Ontem' },
    ],
  },
  {
    id: 'month_vs_month',
    title: 'Este mês × Mês passado',
    description: 'Mês atual vs. mês anterior',
    periods: [
      { value: 'this_month', label: 'Este mês' },
      { value: 'last_month', label: 'Mês passado' },
    ],
  },
  {
    id: 'week_vs_month',
    title: '7 dias × 30 dias',
    description: 'Tendência recente vs. panorama do mês',
    periods: [
      { value: 'last_7d', label: 'Últimos 7 dias' },
      { value: 'last_30d', label: 'Últimos 30 dias' },
    ],
  },
];

const PERIOD_COLORS = [
  '#fb923c', // orange-400 (base, mais brilhante)
  '#60a5fa', // blue-400
  '#c084fc', // purple-400
  '#4ade80', // green-400
  '#facc15', // yellow-400
  '#f472b6', // pink-400
];

const METRICS = [
  { key: 'total_spend',       seriesKey: 'spend',       label: 'Gasto Total',      format: 'currency',   desc: 'Quanto foi investido no período' },
  { key: 'avg_roas',          seriesKey: 'roas',        label: 'ROAS',             format: 'multiplier', desc: 'Retorno sobre investimento. >1x = lucro' },
  { key: 'total_clicks',      seriesKey: 'clicks',      label: 'Cliques',          format: 'number',     desc: 'Cliques no link do anúncio' },
  { key: 'avg_cpc',           seriesKey: 'cpc',         label: 'CPC',              format: 'currency',   desc: 'Custo por clique. Quanto menor, melhor' },
  { key: 'avg_ctr',           seriesKey: 'ctr',         label: 'CTR',              format: 'percent',    desc: 'Taxa de cliques. Sinal de relevância' },
  { key: 'avg_cpm',           seriesKey: 'cpm',         label: 'CPM',              format: 'currency',   desc: 'Custo por mil impressões' },
  { key: 'total_impressions', seriesKey: 'impressions', label: 'Impressões',       format: 'number',     desc: 'Total de vezes que o anúncio foi exibido' },
] as const;

const LOWER_IS_BETTER = new Set(['avg_cpc', 'avg_cpm', 'cost_per_conversion']);

const KPI_STORAGE_KEY = 'atlas_kpi_fields_v1';
type KpiKey = typeof METRICS[number]['key'];
const ALL_KPI_KEYS = METRICS.map((m) => m.key) as KpiKey[];

function loadSavedKpis(): KpiKey[] {
  try {
    const raw = localStorage.getItem(KPI_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as KpiKey[];
      const valid = parsed.filter((k) => ALL_KPI_KEYS.includes(k));
      if (valid.length > 0) return valid;
    }
  } catch { /* noop */ }
  return [...ALL_KPI_KEYS];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(value: number | undefined | null, format: string, currency = 'BRL'): string {
  if (value === undefined || value === null || isNaN(value)) return '—';
  if (format === 'currency') {
    if (currency === 'BRL') return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `$ ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (format === 'percent') return `${value.toFixed(2)}%`;
  if (format === 'multiplier') return `${value.toFixed(2)}x`;
  return value.toLocaleString('pt-BR');
}

function fmtCompact(value: number | undefined | null, format: string, currency = 'BRL'): string {
  if (value === undefined || value === null || isNaN(value)) return '—';
  if (format === 'currency') {
    const sign = currency === 'BRL' ? 'R$ ' : '$ ';
    if (value >= 1_000_000) return `${sign}${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${sign}${(value / 1_000).toFixed(1)}K`;
    return `${sign}${value.toFixed(0)}`;
  }
  if (format === 'percent') return `${value.toFixed(2)}%`;
  if (format === 'multiplier') return `${value.toFixed(2)}x`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString('pt-BR');
}

function deltaPercent(current: number, reference: number): number | null {
  if (!reference || reference === 0) return null;
  return ((current - reference) / Math.abs(reference)) * 100;
}

// ── Tooltip customizado para gráficos ─────────────────────────────────────────

function CustomTooltip({ active, payload, label, metricFormat, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl px-3 py-2.5 shadow-2xl text-xs min-w-[180px]">
      <p className="text-white/50 mb-2 font-medium text-[11px]">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 mb-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-white/60">{entry.name}</span>
          </div>
          <span className="text-white/90 font-mono font-medium">
            {fmt(entry.value, metricFormat, currency)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Sparkline mini ────────────────────────────────────────────────────────────

function Sparkline({
  data,
  color,
  metricFormat,
  currency,
  metricLabel,
}: {
  data: Array<{ date: string; value: number }>;
  color: string;
  metricFormat: string;
  currency: string;
  metricLabel: string;
}) {
  if (!data || data.length < 2) {
    return (
      <div className="h-10 flex items-center justify-center text-[10px] text-white/20">
        Série temporal indisponível
      </div>
    );
  }

  const gradientId = `grad-${color.replace('#', '')}`;

  return (
    <div className="h-10 -mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            content={({ active, payload, label }: any) => {
              if (!active || !payload?.length) return null;
              const pt = payload[0];
              return (
                <div className="bg-black/85 backdrop-blur-xl border border-white/10 rounded-lg px-2 py-1.5 text-[10px] shadow-2xl">
                  <p className="text-white/40">{label}</p>
                  <p className="text-white/90 font-mono font-medium">
                    {fmt(pt.value, metricFormat, currency)} <span className="text-white/40">{metricLabel}</span>
                  </p>
                </div>
              );
            }}
            cursor={{ stroke: color, strokeWidth: 1, strokeOpacity: 0.3 }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── KPI Card estilo liquid glass (formato A) ──────────────────────────────────

function GlassKpiCard({
  metric,
  periods,
  currency,
}: {
  metric: typeof METRICS[number];
  periods: PeriodData[];
  currency: string;
}) {
  const loaded = periods.filter((p) => p.insights && !p.loading);
  if (loaded.length === 0) return null;

  const basePeriod = loaded[0];
  const baseValue = basePeriod.insights![metric.key as keyof AccountInsights] as number;
  const comparePeriod = loaded[1];
  const compareValue = comparePeriod
    ? (comparePeriod.insights![metric.key as keyof AccountInsights] as number)
    : null;

  const delta = compareValue !== null ? deltaPercent(baseValue, compareValue) : null;
  const lowerBetter = LOWER_IS_BETTER.has(metric.key);
  const isPositive = delta !== null ? (lowerBetter ? delta < 0 : delta > 0) : null;

  // Sparkline data do período base
  const sparklineData = basePeriod.series.map((pt) => ({
    date: pt.date,
    value: (pt as any)[metric.seriesKey] ?? 0,
  }));

  const contextDescription = compareValue !== null && delta !== null
    ? (isPositive
        ? delta === 0
          ? 'Sem alteração no período'
          : lowerBetter
            ? `Reduziu frente ao período comparado`
            : `Em alta no período`
        : lowerBetter
          ? `Subiu frente ao período comparado`
          : `Queda no período`)
    : `Valor do período ${basePeriod.label.toLowerCase()}`;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent backdrop-blur-2xl p-5 group transition-all hover:border-white/10 hover:from-white/[0.06]">
      {/* Highlight superior (efeito glass) */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Linha topo: label + delta pill */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-[10px] text-white/35 uppercase tracking-[0.18em] font-medium truncate">
            {metric.label}
          </p>
          <div className="relative">
            <Info className="w-2.5 h-2.5 text-white/15 hover:text-white/40 transition-colors cursor-help" />
            <div className="absolute left-0 top-4 z-30 hidden group-hover:block bg-black/85 backdrop-blur-xl border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-white/70 whitespace-normal w-48 shadow-2xl pointer-events-none">
              {metric.desc}
            </div>
          </div>
        </div>

        {delta !== null && (
          <span
            className={`flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
              isPositive
                ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20'
                : delta === 0
                ? 'bg-white/5 text-white/35 ring-1 ring-white/10'
                : 'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/20'
            }`}
          >
            {delta > 0 ? (
              <TrendingUp className="w-2.5 h-2.5" />
            ) : delta < 0 ? (
              <TrendingDown className="w-2.5 h-2.5" />
            ) : (
              <Minus className="w-2.5 h-2.5" />
            )}
            {delta >= 0 ? '+' : ''}
            {delta.toFixed(1)}%
          </span>
        )}
      </div>

      {/* Valor principal grande */}
      <div className="mb-4">
        <p className="text-[28px] font-semibold text-white/95 leading-none tracking-tight tabular-nums">
          {fmt(baseValue, metric.format, currency)}
        </p>
      </div>

      {/* Sparkline */}
      <div className="mb-3">
        <Sparkline
          data={sparklineData}
          color={PERIOD_COLORS[0]}
          metricFormat={metric.format}
          currency={currency}
          metricLabel={metric.label}
        />
      </div>

      {/* Descrição contextual */}
      <div className="flex items-center gap-1.5 text-[11px]">
        <span className={`${
          isPositive === true
            ? 'text-emerald-400/70'
            : isPositive === false
            ? 'text-rose-400/70'
            : 'text-white/35'
        }`}>
          {contextDescription}
        </span>
        {delta !== null && (
          delta > 0 ? (
            <TrendingUp className="w-3 h-3 text-emerald-400/60" />
          ) : delta < 0 ? (
            <TrendingDown className="w-3 h-3 text-rose-400/60" />
          ) : null
        )}
      </div>

      {compareValue !== null && (
        <p className="text-[10px] text-white/25 mt-1">
          {fmt(compareValue, metric.format, currency)} em {comparePeriod!.label.toLowerCase()}
        </p>
      )}
    </div>
  );
}

// ── Gráfico de barras por campanha ────────────────────────────────────────────

function CampaignBarChart({
  periods,
  metricKey,
  metricFormat,
  currency,
}: {
  periods: PeriodData[];
  metricKey: string;
  metricFormat: string;
  currency: string;
}) {
  const loaded = periods.filter((p) => p.insights && !p.loading);
  if (loaded.length === 0) return null;

  const allCampaignNames = Array.from(
    new Set(loaded.flatMap((p) => p.insights!.campaigns.map((c) => c.campaign_name)))
  );

  const topCampaigns = allCampaignNames
    .map((name) => ({
      name,
      max: Math.max(
        ...loaded.map((p) => {
          const c = p.insights!.campaigns.find((c) => c.campaign_name === name);
          return c ? ((c as any)[metricKey] ?? 0) : 0;
        })
      ),
    }))
    .sort((a, b) => b.max - a.max)
    .slice(0, 8)
    .map((c) => c.name);

  const data = topCampaigns.map((name) => {
    const entry: Record<string, any> = {
      name: name.length > 22 ? name.slice(0, 22) + '…' : name,
    };
    loaded.forEach((period) => {
      const c = period.insights!.campaigns.find((c) => c.campaign_name === name);
      entry[period.label] = c ? ((c as any)[metricKey] ?? 0) : 0;
    });
    return entry;
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 50 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          angle={-30}
          textAnchor="end"
          interval={0}
        />
        <YAxis
          tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => fmtCompact(v, metricFormat, currency)}
          width={62}
        />
        <Tooltip
          content={<CustomTooltip metricFormat={metricFormat} currency={currency} />}
          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', paddingTop: 12 }}
        />
        {loaded.map((period, i) => (
          <Bar
            key={period.preset}
            dataKey={period.label}
            fill={PERIOD_COLORS[i % PERIOD_COLORS.length]}
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
            fillOpacity={0.9}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Grid de Criativos (ranqueado por CTR) ─────────────────────────────────────

interface AdWithCreative {
  ad_id: string;
  ad_name: string;
  campaign_id: string;
  campaign_name: string;
  status: string;
  effective_status: string;
  ctr: number;
  cpc: number;
  cpm: number;
  spend: number;
  impressions: number;
  clicks: number;
  creative: {
    id?: string;
    title?: string;
    body?: string;
    thumbnail_url?: string;
    image_url?: string;
    call_to_action_type?: string;
  };
}

function CreativeCard({
  ad,
  rank,
  currency,
  bestCtr,
}: {
  ad: AdWithCreative;
  rank: number;
  currency: string;
  bestCtr: number;
}) {
  const thumb = ad.creative.image_url ?? ad.creative.thumbnail_url;
  const isWinner = rank === 0 && ad.ctr > 0;
  const ctrRelative = bestCtr > 0 ? ad.ctr / bestCtr : 0;

  // Cor do badge de CTR: verde se > 70% do melhor, amarelo 40-70%, vermelho < 40%
  const ctrTone =
    ctrRelative >= 0.7
      ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
      : ctrRelative >= 0.4
      ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
      : 'text-rose-400 bg-rose-400/10 border-rose-400/20';

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent backdrop-blur-2xl hover:border-orange-500/20 transition-all">
      {/* Highlight topo */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Thumbnail */}
      <div className="relative aspect-square bg-black/30 overflow-hidden">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={ad.ad_name}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-10 h-10 text-white/10" />
          </div>
        )}

        {/* Gradiente inferior pra legibilidade */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

        {/* Badge winner */}
        {isWinner && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/90 text-[10px] font-semibold text-white shadow-lg">
            <Trophy className="w-2.5 h-2.5" />
            TOP
          </div>
        )}

        {/* Badge CTR */}
        <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full border text-[10px] font-mono tabular-nums font-semibold backdrop-blur-sm ${ctrTone}`}>
          CTR {ad.ctr.toFixed(2)}%
        </div>

        {/* Rank badge (pequeno, canto inferior esquerdo) */}
        {!isWinner && (
          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md bg-black/50 border border-white/10 text-[10px] font-mono text-white/70 backdrop-blur-sm">
            #{rank + 1}
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="p-3 space-y-2">
        {/* Nome do anúncio */}
        <div>
          <p className="text-[12px] font-medium text-white/90 leading-tight line-clamp-2">
            {ad.creative.title || ad.ad_name}
          </p>
          <p className="text-[10px] text-white/35 mt-0.5 truncate" title={ad.campaign_name}>
            {ad.campaign_name}
          </p>
        </div>

        {/* Copy (se tiver) */}
        {ad.creative.body && (
          <p className="text-[10px] text-white/45 leading-snug line-clamp-2 italic">
            "{ad.creative.body}"
          </p>
        )}

        {/* Métricas em linha */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] tabular-nums">
          <div className="flex flex-col">
            <span className="text-white/30 uppercase tracking-wider text-[9px]">Gasto</span>
            <span className="text-white/80 font-mono">
              {currency === 'BRL' ? 'R$ ' : '$ '}
              {ad.spend.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-white/30 uppercase tracking-wider text-[9px]">Cliques</span>
            <span className="text-white/80 font-mono">{ad.clicks.toLocaleString('pt-BR')}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-white/30 uppercase tracking-wider text-[9px]">CPC</span>
            <span className="text-white/80 font-mono">
              {currency === 'BRL' ? 'R$ ' : '$ '}
              {ad.cpc.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreativesGrid({
  selectedAccount,
  selectedWorkspace,
  currency,
  datePreset,
  periodLabel,
}: {
  selectedAccount: string;
  selectedWorkspace: string;
  currency: string;
  datePreset: string;
  periodLabel: string;
}) {
  const [ads, setAds] = useState<AdWithCreative[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAccount || !selectedWorkspace || !datePreset) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(
      `${API_URL}/api/traffic/ads/insights?accountId=${selectedAccount}&workspace=${selectedWorkspace}&datePreset=${datePreset}`,
    )
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if ((data as any).error) throw new Error((data as any).error);
        setAds(Array.isArray(data) ? data : []);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e.message || 'Erro ao carregar criativos');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedAccount, selectedWorkspace, datePreset]);

  const topAds = ads.filter((a) => a.impressions > 0).slice(0, 12);
  const bestCtr = topAds[0]?.ctr ?? 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] via-white/[0.015] to-transparent backdrop-blur-2xl">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <ImageIcon className="w-3.5 h-3.5 text-orange-400" />
              <p className="text-[13px] font-semibold text-white/90 tracking-tight">
                Criativos em destaque
              </p>
            </div>
            <p className="text-[11px] text-white/35 mt-1">
              Ranqueados por CTR · período: <span className="text-white/60">{periodLabel}</span>
            </p>
          </div>
          {!loading && topAds.length > 0 && (
            <div className="flex items-center gap-2 text-[10px] text-white/40">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Alto
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" /> Médio
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Baixo
              </span>
            </div>
          )}
        </div>

        {/* Estado de loading / erro / vazio */}
        {loading ? (
          <div className="flex items-center justify-center h-[240px]">
            <Loader2 className="w-6 h-6 animate-spin text-orange-400/60" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-[240px]">
            <p className="text-xs text-rose-400/70">{error}</p>
          </div>
        ) : topAds.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[240px] gap-2 text-center px-6">
            <ImageIcon className="w-8 h-8 text-white/10" />
            <p className="text-xs text-white/40">Sem criativos com dados em {periodLabel.toLowerCase()}</p>
            <p className="text-[11px] text-white/25 max-w-sm leading-relaxed">
              Essa conta não teve atividade no período selecionado. Tente trocar o período (ex: "Máximo") ou escolher outra conta de anúncios.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {topAds.map((ad, i) => (
              <CreativeCard
                key={ad.ad_id}
                ad={ad}
                rank={i}
                currency={currency}
                bestCtr={bestCtr}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Popover de filtros ────────────────────────────────────────────────────────

function FilterPopover({
  periods,
  addPeriod,
  removePeriod,
  applyShortcut,
  clearAll,
  onClose,
}: {
  periods: PeriodData[];
  addPeriod: (preset: string, label: string) => void;
  removePeriod: (preset: string) => void;
  applyShortcut: (s: typeof COMPARE_SHORTCUTS[0]) => void;
  clearAll: () => void;
  onClose: () => void;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handleClick), 0);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className="absolute top-full right-0 mt-2 w-[380px] z-40 rounded-2xl border border-white/10 bg-black/70 backdrop-blur-2xl shadow-2xl overflow-hidden"
    >
      {/* Highlight topo */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
        {/* Períodos individuais */}
        <div>
          <p className="text-[10px] text-white/55 font-semibold uppercase tracking-[0.18em] mb-2.5">
            Períodos disponíveis
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {DATE_PRESETS.map((p) => {
              const active = periods.some((x) => x.preset === p.value);
              return (
                <button
                  key={p.value}
                  onClick={() => active ? removePeriod(p.value) : addPeriod(p.value, p.label)}
                  disabled={!active && periods.length >= 6}
                  className={`flex items-center justify-between gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                    active
                      ? 'border-orange-500/40 bg-orange-500/15 text-orange-300'
                      : 'border-white/5 bg-white/[0.02] text-white/50 hover:bg-white/5 hover:text-white/80'
                  }`}
                >
                  <span className="truncate">{p.label}</span>
                  {active ? (
                    <Check className="w-3 h-3 shrink-0" />
                  ) : (
                    <Plus className="w-3 h-3 shrink-0 opacity-50" />
                  )}
                </button>
              );
            })}
          </div>
          {periods.length >= 6 && (
            <p className="text-[9px] text-white/30 mt-2">
              Máximo de 6 períodos atingido. Remova um para adicionar outro.
            </p>
          )}
        </div>

        {periods.length > 0 && (
          <>
            <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            <button
              onClick={() => { clearAll(); onClose(); }}
              className="w-full text-[11px] text-white/40 hover:text-rose-400 py-1.5 transition-colors"
            >
              Limpar seleção
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function AtlasCompareTab({ selectedAccount, selectedWorkspace, currency, fallbackPreset }: AtlasCompareTabProps) {
  const [periods, setPeriods] = useState<PeriodData[]>([]);
  const [activeMetric, setActiveMetric] = useState<typeof METRICS[number]>(METRICS[0]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleKpis, setVisibleKpis] = useState<KpiKey[]>(ALL_KPI_KEYS);
  const [kpiPickerOpen, setKpiPickerOpen] = useState(false);
  const kpiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setVisibleKpis(loadSavedKpis()); }, []);

  useEffect(() => {
    if (!kpiPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (kpiPickerRef.current && !kpiPickerRef.current.contains(e.target as Node)) {
        setKpiPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [kpiPickerOpen]);

  const toggleKpi = (key: KpiKey) => {
    setVisibleKpis((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try { localStorage.setItem(KPI_STORAGE_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  };

  const fetchPeriod = useCallback(
    async (preset: string, label: string) => {
      setPeriods((prev) => {
        if (prev.some((p) => p.preset === preset)) return prev;
        return [...prev, { preset, label, insights: null, series: [], loading: true, error: null }];
      });

      try {
        const [insightsRes, seriesRes] = await Promise.all([
          fetch(`${API_URL}/api/traffic/insights?accountId=${selectedAccount}&workspace=${selectedWorkspace}&datePreset=${preset}`),
          fetch(`${API_URL}/api/traffic/insights/timeseries?accountId=${selectedAccount}&workspace=${selectedWorkspace}&datePreset=${preset}`),
        ]);
        const insights: AccountInsights = await insightsRes.json();
        const series: TimeseriesPoint[] = await seriesRes.json();

        if ((insights as any).error) throw new Error((insights as any).error);

        setPeriods((prev) =>
          prev.map((p) =>
            p.preset === preset
              ? {
                  ...p,
                  insights,
                  series: Array.isArray(series) ? series : [],
                  loading: false,
                }
              : p
          )
        );
      } catch (e: any) {
        setPeriods((prev) =>
          prev.map((p) =>
            p.preset === preset ? { ...p, loading: false, error: e.message || 'Erro' } : p
          )
        );
      }
    },
    [selectedAccount, selectedWorkspace]
  );

  const addPeriod = (preset: string, label: string) => {
    if (periods.some((p) => p.preset === preset)) return;
    if (periods.length >= 6) return;
    fetchPeriod(preset, label);
  };

  const applyShortcut = (shortcut: typeof COMPARE_SHORTCUTS[0]) => {
    setPeriods([]);
    shortcut.periods.forEach((p) => fetchPeriod(p.value, p.label));
  };

  const removePeriod = (preset: string) => {
    setPeriods((prev) => prev.filter((p) => p.preset !== preset));
  };

  const clearAll = () => {
    if (fallbackPreset) {
      // Ao limpar, já carrega o período do filtro superior (evita voltar pro onboarding)
      setPeriods([]);
      fetchPeriod(fallbackPreset.value, fallbackPreset.label);
    } else {
      setPeriods([]);
    }
  };

  // Quando o usuário limpa tudo, recarrega o período do filtro superior (fallback)
  useEffect(() => {
    if (!selectedAccount || !selectedWorkspace) return;
    if (periods.length > 0) return;
    if (!fallbackPreset) return;
    fetchPeriod(fallbackPreset.value, fallbackPreset.label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods.length, fallbackPreset?.value, selectedAccount, selectedWorkspace]);

  // Reset ao trocar de conta — o fallback useEffect acima recarrega o período
  useEffect(() => {
    setPeriods([]);
  }, [selectedAccount, selectedWorkspace]);

  const anyLoading = periods.some((p) => p.loading);

  // Título do dropdown (ex: "Comparando: Hoje × Ontem")
  const dropdownTitle = periods.length === 0
    ? 'Escolher períodos'
    : periods.length === 1
      ? periods[0].label
      : periods.length === 2
        ? `${periods[0].label} × ${periods[1].label}`
        : `${periods[0].label} + ${periods.length - 1}`;

  // ── Estado vazio: onboarding ───────────────────────────────────────────────

  if (periods.length === 0) {
    return (
      <div className="relative h-full overflow-hidden">
        {/* Glow de fundo laranja */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -left-20 w-[500px] h-[500px] bg-orange-500/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-orange-600/8 rounded-full blur-[100px]" />
        </div>

        <div className="relative h-full overflow-y-auto px-6 py-12">
          <div className="max-w-2xl mx-auto">
            {/* Hero */}
            <div className="text-center mb-10">
              <div className="inline-flex w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400/25 to-orange-600/10 border border-orange-400/20 items-center justify-center mb-4 backdrop-blur-xl">
                <GitCompare className="w-5 h-5 text-orange-400" />
              </div>
              <h2 className="text-2xl font-semibold text-white/95 tracking-tight mb-2">
                Comparação de Períodos
              </h2>
              <p className="text-sm text-white/45 leading-relaxed max-w-md mx-auto">
                Analise lado a lado o desempenho da sua conta em diferentes janelas de tempo.
                Identifique tendências, picos e quedas.
              </p>
            </div>

            {/* Atalhos */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-1.5 px-1">
                <Sparkles className="w-3 h-3 text-orange-400" />
                <p className="text-[10px] text-white/55 font-semibold uppercase tracking-[0.18em]">
                  Comece com um atalho
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {COMPARE_SHORTCUTS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => applyShortcut(s)}
                    className="relative overflow-hidden text-left rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent backdrop-blur-2xl p-4 hover:border-orange-500/30 hover:from-orange-500/[0.06] transition-all group"
                  >
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="flex gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      </div>
                    </div>
                    <p className="text-[13px] font-medium text-white/85 group-hover:text-orange-300 transition-colors leading-tight">
                      {s.title}
                    </p>
                    <p className="text-[10px] text-white/35 mt-1.5 leading-relaxed">
                      {s.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom presets */}
            <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.02] to-transparent backdrop-blur-xl p-4">
              <p className="text-[10px] text-white/45 font-semibold uppercase tracking-[0.18em] mb-3">
                Ou escolha um período individual
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DATE_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => addPeriod(p.value, p.label)}
                    className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg border border-white/5 bg-white/[0.03] text-white/55 hover:bg-white/10 hover:text-white/85 hover:border-white/15 transition-all"
                  >
                    <Plus className="w-3 h-3 opacity-60" />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Conteúdo com períodos selecionados ──────────────────────────────────────

  return (
    <div className="relative h-full overflow-hidden">
      {/* Glow de fundo laranja */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-orange-500/8 rounded-full blur-[140px]" />
        <div className="absolute top-[40%] -right-20 w-[400px] h-[400px] bg-orange-600/6 rounded-full blur-[120px]" />
      </div>

      <div className="relative h-full overflow-y-auto">
        {/* ── Header sticky ── */}
        <div className="sticky top-0 z-20 backdrop-blur-2xl bg-black/40 border-b border-white/5 px-6 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Título e contexto */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-400/20 flex items-center justify-center shrink-0">
                <GitCompare className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <h2 className="text-[13px] font-semibold text-white/90 tracking-tight leading-none">
                  Comparação de Períodos
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  {periods.map((period, i) => (
                    <span
                      key={period.preset}
                      className="flex items-center gap-1 text-[10px]"
                      style={{ color: PERIOD_COLORS[i % PERIOD_COLORS.length] }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: PERIOD_COLORS[i % PERIOD_COLORS.length] }}
                      />
                      {period.label}
                      {i === 0 && periods.length > 1 && (
                        <span className="text-white/30 text-[9px] font-semibold tracking-widest ml-0.5">
                          BASE
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Dropdown de filtros */}
            <div className="relative">
              <button
                onClick={() => setFilterOpen((v) => !v)}
                className="flex items-center gap-2 text-[12px] px-3.5 py-2 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-xl text-white/75 hover:text-white/95 transition-all"
              >
                <span className="text-white/50">Comparando:</span>
                <span className="font-medium">{dropdownTitle}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-white/40 transition-transform ${
                    filterOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {filterOpen && (
                <FilterPopover
                  periods={periods}
                  addPeriod={addPeriod}
                  removePeriod={removePeriod}
                  applyShortcut={applyShortcut}
                  clearAll={clearAll}
                  onClose={() => setFilterOpen(false)}
                />
              )}
            </div>
          </div>
        </div>

        {/* ── Conteúdo ── */}
        <div className="px-6 py-6 space-y-6">

          {/* Loading inicial */}
          {anyLoading && periods.every((p) => !p.insights) && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-orange-400/60" />
            </div>
          )}

          {/* KPI Cards formato A */}
          {periods.some((p) => p.insights) && (
            <div>
              <div className="flex items-center justify-between mb-4 px-1">
                <p className="text-[10px] text-white/45 font-semibold uppercase tracking-[0.18em]">
                  Indicadores principais
                </p>
                <div className="flex items-center gap-3">
                  {periods.length > 1 && (
                    <p className="text-[10px] text-white/30">
                      <span className="text-white/55">▲▼</span> variação vs. {periods[1]?.label.toLowerCase()}
                    </p>
                  )}
                  {/* Seletor de métricas visíveis */}
                  <div ref={kpiPickerRef} className="relative">
                    <button
                      onClick={() => setKpiPickerOpen((v) => !v)}
                      className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md border transition-colors ${
                        kpiPickerOpen
                          ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                          : 'bg-white/[0.04] text-white/35 border-white/[0.06] hover:bg-white/[0.08] hover:text-white/60'
                      }`}
                      title="Escolher métricas"
                    >
                      <SlidersHorizontal className="w-2.5 h-2.5" />
                      <span className="uppercase tracking-wider">Métricas</span>
                    </button>

                    {kpiPickerOpen && (
                      <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-white/10 bg-[#141014]/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden">
                        <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
                          <p className="text-[10px] uppercase tracking-wider text-white/40">Indicadores</p>
                          <button
                            onClick={() => {
                              const all = [...ALL_KPI_KEYS];
                              setVisibleKpis(all);
                              try { localStorage.setItem(KPI_STORAGE_KEY, JSON.stringify(all)); } catch { /* noop */ }
                            }}
                            className="text-[9px] text-white/30 hover:text-orange-400 transition-colors uppercase tracking-wider"
                          >
                            Todos
                          </button>
                        </div>
                        <div className="py-1">
                          {METRICS.map((m) => {
                            const active = visibleKpis.includes(m.key as KpiKey);
                            return (
                              <button
                                key={m.key}
                                onClick={() => toggleKpi(m.key as KpiKey)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5 hover:text-white/90 transition-colors"
                              >
                                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                  active ? 'bg-orange-500/30 border-orange-500/60' : 'border-white/15'
                                }`}>
                                  {active && <Check className="w-2 h-2 text-orange-400" />}
                                </span>
                                {m.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {METRICS.filter((m) => visibleKpis.includes(m.key as KpiKey)).map((m) => (
                  <GlassKpiCard
                    key={m.key}
                    metric={m}
                    periods={periods}
                    currency={currency}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Criativos em destaque (ranqueados por CTR do período base) */}
          {periods[0]?.insights && (
            <CreativesGrid
              selectedAccount={selectedAccount}
              selectedWorkspace={selectedWorkspace}
              currency={currency}
              datePreset={periods[0].preset}
              periodLabel={periods[0].label}
            />
          )}
        </div>
      </div>
    </div>
  );
}
