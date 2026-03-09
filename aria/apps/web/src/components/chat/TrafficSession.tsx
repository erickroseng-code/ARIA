'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, RefreshCw, Loader2, TrendingUp, Eye, MousePointer,
  DollarSign, Activity, Pause, Play, BarChart2, Target, Zap, AlertCircle,
} from 'lucide-react';

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
  date_start: string;
  date_stop: string;
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

interface Workspace {
  id: string;
  name: string;
}

interface TrafficSessionProps {
  onClose: () => void;
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

// ── KPI Card ──────────────────────────────────────────────────────────────────

const colorMap = {
  orange: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  blue:   { bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-blue-500/20' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  green:  { bg: 'bg-green-500/10',  text: 'text-green-400',  border: 'border-green-500/20' },
  yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  pink:   { bg: 'bg-pink-500/10',   text: 'text-pink-400',   border: 'border-pink-500/20' },
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

// ── Componente principal ──────────────────────────────────────────────────────

export function TrafficSession({ onClose }: TrafficSessionProps) {
  const [workspaces, setWorkspaces]           = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState('');
  const [accounts, setAccounts]               = useState<AdAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [insights, setInsights]               = useState<AccountInsights | null>(null);
  const [campaigns, setCampaigns]             = useState<Campaign[]>([]);
  const [datePreset, setDatePreset]           = useState('last_30d');
  const [loading, setLoading]                 = useState(false);
  const [loadingAction, setLoadingAction]     = useState<string | null>(null);
  const [error, setError]                     = useState<string | null>(null);
  const [initialized, setInitialized]         = useState(false);

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
      setError(e.message || 'Erro ao carregar dados do Meta ADS');
    } finally {
      setLoading(false);
    }
  }, [selectedAccount, selectedWorkspace, datePreset]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

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
          {/* Seletor de workspace */}
          {workspaces.length > 0 && (
            <select
              value={selectedWorkspace}
              onChange={(e) => setSelectedWorkspace(e.target.value)}
              className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white/80 outline-none cursor-pointer hover:bg-white/10 transition-colors"
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id} className="bg-[#1a0f0a]">
                  {w.name}
                </option>
              ))}
            </select>
          )}

          {/* Seletor de conta */}
          {accounts.length > 0 && (
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white/80 outline-none cursor-pointer hover:bg-white/10 transition-colors max-w-[180px] truncate"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id} className="bg-[#1a0f0a]">
                  {a.name}
                </option>
              ))}
            </select>
          )}

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

      {/* ── Filtro de período ── */}
      <div className="px-4 py-2 border-b border-white/5 flex gap-2 overflow-x-auto scrollbar-hide shrink-0">
        {DATE_PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => setDatePreset(p.value)}
            className={`text-xs px-3 py-1 rounded-full whitespace-nowrap transition-all ${
              datePreset === p.value
                ? 'bg-orange-500/25 text-orange-300 border border-orange-500/40'
                : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/80'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Conteúdo principal ── */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading inicial */}
        {loading && !initialized ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
              <p className="text-white/40 text-sm">Carregando dados do Meta ADS…</p>
            </div>
          </div>
        ) : error ? (
          /* Error state */
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3 text-center px-8 max-w-sm">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <p className="text-white/60 text-sm leading-relaxed">{error}</p>
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
          /* Dashboard */
          <div className="p-4 space-y-4">

            {/* KPI Grid */}
            {insights && (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                <KpiCard
                  label="Gasto Total"
                  value={formatCurrency(insights.total_spend, currency)}
                  icon={DollarSign}
                  color="orange"
                  loading={loading}
                />
                <KpiCard
                  label="Impressões"
                  value={formatNumber(insights.total_impressions)}
                  icon={Eye}
                  color="blue"
                  loading={loading}
                />
                <KpiCard
                  label="Cliques"
                  value={formatNumber(insights.total_clicks)}
                  icon={MousePointer}
                  color="purple"
                  loading={loading}
                />
                <KpiCard
                  label="CTR Médio"
                  value={`${insights.avg_ctr.toFixed(2)}%`}
                  icon={TrendingUp}
                  color="green"
                  loading={loading}
                />
                <KpiCard
                  label="CPM Médio"
                  value={formatCurrency(insights.avg_cpm, currency)}
                  icon={BarChart2}
                  color="yellow"
                  loading={loading}
                />
                <KpiCard
                  label="CPC Médio"
                  value={formatCurrency(insights.avg_cpc, currency)}
                  icon={Target}
                  color="pink"
                  loading={loading}
                />
              </div>
            )}

            {/* Tabela de Campanhas */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-orange-400" />
                  Campanhas
                </h3>
                <span className="text-xs text-white/30 px-2 py-0.5 bg-white/5 rounded-full">
                  {campaigns.length} campanha{campaigns.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/5 text-white/30">
                      <th className="text-left px-4 py-2.5 font-medium">Campanha</th>
                      <th className="text-center px-3 py-2.5 font-medium">Status</th>
                      <th className="text-right px-3 py-2.5 font-medium">Gasto</th>
                      <th className="text-right px-3 py-2.5 font-medium">Impressões</th>
                      <th className="text-right px-3 py-2.5 font-medium">Cliques</th>
                      <th className="text-right px-3 py-2.5 font-medium">CTR</th>
                      <th className="text-right px-3 py-2.5 font-medium">CPC</th>
                      <th className="text-center px-3 py-2.5 font-medium">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-white/25 text-sm">
                          Nenhuma campanha encontrada nessa conta
                        </td>
                      </tr>
                    ) : (
                      campaigns.map((campaign) => {
                        const ci = insights?.campaigns.find(
                          (c) => c.campaign_id === campaign.id
                        );
                        const isActive = campaign.status === 'ACTIVE';
                        const isActionable =
                          campaign.status !== 'DELETED' && campaign.status !== 'ARCHIVED';
                        const isLoadingThis = loadingAction === campaign.id;

                        return (
                          <tr
                            key={campaign.id}
                            className="border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors"
                          >
                            {/* Nome */}
                            <td className="px-4 py-3">
                              <div className="max-w-[220px]">
                                <p className="truncate text-white/80 font-medium">{campaign.name}</p>
                                <p className="text-white/25 text-[10px] mt-0.5 uppercase tracking-wide">
                                  {campaign.objective?.replace(/_/g, ' ')}
                                </p>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="px-3 py-3 text-center">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                  isActive
                                    ? 'bg-green-500/15 text-green-400'
                                    : campaign.status === 'PAUSED'
                                    ? 'bg-yellow-500/15 text-yellow-400'
                                    : 'bg-white/5 text-white/30'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isActive ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'
                                  }`}
                                />
                                {isActive ? 'Ativo' : campaign.status === 'PAUSED' ? 'Pausado' : campaign.status}
                              </span>
                            </td>

                            {/* Métricas */}
                            <td className="px-3 py-3 text-right text-white/60">
                              {ci ? formatCurrency(ci.spend, currency) : '—'}
                            </td>
                            <td className="px-3 py-3 text-right text-white/60">
                              {ci ? formatNumber(ci.impressions) : '—'}
                            </td>
                            <td className="px-3 py-3 text-right text-white/60">
                              {ci ? formatNumber(ci.clicks) : '—'}
                            </td>
                            <td className="px-3 py-3 text-right text-white/60">
                              {ci ? `${ci.ctr.toFixed(2)}%` : '—'}
                            </td>
                            <td className="px-3 py-3 text-right text-white/60">
                              {ci ? formatCurrency(ci.cpc, currency) : '—'}
                            </td>

                            {/* Ação */}
                            <td className="px-3 py-3 text-center">
                              {isActionable && (
                                <button
                                  onClick={() =>
                                    isActive
                                      ? handlePause(campaign.id)
                                      : handleEnable(campaign.id)
                                  }
                                  disabled={isLoadingThis}
                                  title={isActive ? 'Pausar campanha' : 'Ativar campanha'}
                                  className={`p-1.5 rounded-lg transition-all disabled:opacity-40 ${
                                    isActive
                                      ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/25'
                                      : 'bg-green-500/10 text-green-400 hover:bg-green-500/25'
                                  }`}
                                >
                                  {isLoadingThis ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : isActive ? (
                                    <Pause className="w-3.5 h-3.5" />
                                  ) : (
                                    <Play className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Rodapé com timestamp */}
            {initialized && (
              <p className="text-center text-[10px] text-white/20 pb-2">
                Dados do Meta ADS • Atualizado em {new Date().toLocaleTimeString('pt-BR')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
