const META_API_BASE = 'https://graph.facebook.com/v20.0';

export interface AdAccount {
  id: string;
  name: string;
  account_status: number;
  currency: string;
  timezone_name: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  effective_status: string;
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
}

export interface CampaignInsights {
  campaign_id: string;
  campaign_name: string;
  impressions: number;
  clicks: number;              // inline_link_clicks (cliques no link)
  spend: number;
  cpc: number;
  cpm: number;
  ctr: number;                 // inline_link_click_ctr (taxa de cliques no link)
  reach: number;
  roas?: number;
  frequency?: number;          // média de vezes que cada pessoa viu o anúncio
  unique_clicks?: number;      // usuários únicos que clicaram
  conversions?: number;        // ações de compra
  conversion_value?: number;   // receita de compras (R$)
  cost_per_conversion?: number;// custo por compra
  engagement?: number;         // engajamentos totais no post
  video_views_25?: number;     // vídeo assistido 25%
  video_views_50?: number;     // vídeo assistido 50%
  video_views_75?: number;     // vídeo assistido 75%
  video_views_100?: number;    // vídeo assistido 100%
  date_start: string;
  date_stop: string;
}

export interface AccountInsights {
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  avg_ctr: number;
  avg_cpm: number;
  avg_cpc: number;
  avg_roas: number;
  campaigns: CampaignInsights[];
}

export interface AdSet {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  effective_status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  optimization_goal?: string;
  billing_event?: string;
}

export interface AdCreative {
  id: string;
  title?: string;
  body?: string;
  image_url?: string;
  thumbnail_url?: string;
  call_to_action_type?: string;
}

export interface Ad {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  effective_status: string;
  creative?: AdCreative;
}

export interface Workspace {
  id: string;
  name: string;
}

async function metaGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${META_API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

async function metaPost(path: string, params: Record<string, string>): Promise<void> {
  const url = new URL(`${META_API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), { method: 'POST' });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta API error ${res.status}: ${body}`);
  }
}

export class TrafficService {
  private tokens: Map<string, string>;

  // ── Cache inteligente + dedup in-flight para mitigar rate limit da Meta Ads API ──
  // Dados históricos (yesterday, last_month) nunca mudam → cache 24h.
  // Dados "hoje" → 5 min. Períodos rolling (last_7d, last_30d, etc.) → 30 min.
  //
  // Dedup: se 2 componentes pedem o mesmo recurso simultaneamente, só uma
  // chamada vai ao Meta; ambos aguardam a mesma Promise.
  private insightsCache: Map<string, { data: AccountInsights; expires: number }> = new Map();
  private insightsInflight: Map<string, Promise<AccountInsights>> = new Map();
  private timeseriesCache: Map<string, { data: any[]; expires: number }> = new Map();
  private timeseriesInflight: Map<string, Promise<any[]>> = new Map();
  private campaignsCache: Map<string, { data: Campaign[]; expires: number }> = new Map();
  private campaignsInflight: Map<string, Promise<Campaign[]>> = new Map();

  private getTtlMs(datePreset: string): number {
    // Períodos que terminaram — conteúdo nunca muda
    const HISTORICAL = new Set(['yesterday', 'last_month']);
    if (HISTORICAL.has(datePreset)) return 24 * 60 * 60 * 1000; // 24h

    // Dados de hoje — mudam continuamente, mas curto o suficiente
    if (datePreset === 'today') return 5 * 60 * 1000; // 5 min

    // Rolling windows (last_7d, last_14d, last_30d, this_month, maximum)
    return 30 * 60 * 1000; // 30 min
  }

  constructor() {
    this.tokens = new Map();

    const petyToken = process.env.META_ACCESS_TOKEN_PETY?.trim();
    const erickToken = process.env.META_ACCESS_TOKEN_ERICK?.trim();

    if (petyToken) this.tokens.set('pety', petyToken);
    if (erickToken) this.tokens.set('erick', erickToken);
  }

  private getToken(workspace: string): string {
    const token = this.tokens.get(workspace);
    if (!token) throw new Error(`Token não configurado para workspace: ${workspace}`);
    return token;
  }

  getWorkspaces(): Workspace[] {
    const workspaces: Workspace[] = [];
    for (const [id] of this.tokens) {
      workspaces.push({
        id,
        name: id === 'pety' ? 'Pety' : id === 'erick' ? 'Erick' : id,
      });
    }
    return workspaces;
  }

  async getAccounts(workspace: string): Promise<AdAccount[]> {
    const token = this.getToken(workspace);
    const data = await metaGet<{ data: AdAccount[] }>('/me/adaccounts', {
      fields: 'id,name,account_status,currency,timezone_name',
      access_token: token,
      limit: '25',
    });
    return data.data;
  }

  async getCampaigns(accountId: string, workspace: string): Promise<Campaign[]> {
    const cacheKey = `${workspace}|${accountId}`;
    const cached = this.campaignsCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.data;

    const pending = this.campaignsInflight.get(cacheKey);
    if (pending) return pending;

    const promise = (async () => {
      const token = this.getToken(workspace);
      const data = await metaGet<{ data: Campaign[] }>(`/${accountId}/campaigns`, {
        fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time',
        access_token: token,
        limit: '50',
      });
      this.campaignsCache.set(cacheKey, {
        data: data.data,
        expires: Date.now() + 30 * 60 * 1000, // 30 min — lista de campanhas muda pouco
      });
      return data.data;
    })();

    this.campaignsInflight.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      this.campaignsInflight.delete(cacheKey);
    }
  }

  async getAccountInsights(
    accountId: string,
    workspace: string,
    datePreset: string = 'last_30d'
  ): Promise<AccountInsights> {
    const cacheKey = `${workspace}|${accountId}|${datePreset}`;

    const cached = this.insightsCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.data;

    const pending = this.insightsInflight.get(cacheKey);
    if (pending) return pending;

    const promise = this.fetchAccountInsightsFromMeta(accountId, workspace, datePreset, cacheKey);
    this.insightsInflight.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      this.insightsInflight.delete(cacheKey);
    }
  }

  private async fetchAccountInsightsFromMeta(
    accountId: string,
    workspace: string,
    datePreset: string,
    cacheKey: string
  ): Promise<AccountInsights> {
    const token = this.getToken(workspace);
    const data = await metaGet<{ data: any[] }>(`/${accountId}/insights`, {
      fields: [
        'campaign_id', 'campaign_name',
        'impressions', 'inline_link_clicks', 'unique_inline_link_clicks',
        'spend', 'cpc', 'cpm', 'inline_link_click_ctr',
        'reach', 'frequency',
        'actions', 'action_values', 'cost_per_action_type',
        'video_p25_watched_actions', 'video_p50_watched_actions',
        'video_p75_watched_actions', 'video_p100_watched_actions',
      ].join(','),
      date_preset: datePreset,
      level: 'campaign',
      access_token: token,
      limit: '50',
    });

    const raw: any[] = data.data ?? [];

    const getVal = (arr: any[] | undefined, type: string) => 
      parseFloat(arr?.find((a: any) => a.action_type === type)?.value || '0');

    const campaigns: CampaignInsights[] = raw.map((c) => {
      // Prioritization list: Purchases > Leads > Messages > Contacts > Registrations
      const purchases = getVal(c.actions, 'purchase');
      const leads = getVal(c.actions, 'lead');
      const msgStarted = 
        getVal(c.actions, 'onsite_conversion.messaging_conversation_started_7d') || 
        getVal(c.actions, 'onsite_conversion.total_messaging_connection') || 
        getVal(c.actions, 'onsite_conversion.messaging_first_reply');
      const contacts = getVal(c.actions, 'contact');
      const registrations = getVal(c.actions, 'complete_registration');
      
      let resultCount = 0;
      if (purchases > 0) resultCount = purchases;
      else if (leads > 0) resultCount = leads;
      else if (msgStarted > 0) resultCount = msgStarted;
      else if (contacts > 0) resultCount = contacts;
      else if (registrations > 0) resultCount = registrations;

      // For value, mainly prioritize purchases
      let resultValue = getVal(c.action_values, 'purchase');

      const postEngagement = c.actions?.find((a: any) => a.action_type === 'post_engagement')?.value;
      
      const spend = parseFloat(c.spend || '0');
      const roas = resultValue > 0 && spend > 0 ? resultValue / spend : undefined;
      const costPerResult = resultCount > 0 ? spend / resultCount : 0;
      
      const linkClicks = parseInt(c.inline_link_clicks || '0', 10);
      const linkCtr = parseFloat(c.inline_link_click_ctr || '0');

      return {
        campaign_id: c.campaign_id,
        campaign_name: c.campaign_name,
        impressions: parseInt(c.impressions || '0', 10),
        clicks: linkClicks,
        spend,
        cpc: parseFloat(c.cpc || '0'),
        cpm: parseFloat(c.cpm || '0'),
        ctr: linkCtr,
        reach: parseInt(c.reach || '0', 10),
        frequency: parseFloat(c.frequency || '0'),
        roas,
        unique_clicks: parseInt(c.unique_inline_link_clicks || '0', 10),
        conversions: resultCount,
        conversion_value: resultValue,
        cost_per_conversion: costPerResult,
        engagement: postEngagement ? parseInt(postEngagement, 10) : 0,
        video_views_25: parseInt(c.video_p25_watched_actions?.[0]?.value || '0', 10),
        video_views_50: parseInt(c.video_p50_watched_actions?.[0]?.value || '0', 10),
        video_views_75: parseInt(c.video_p75_watched_actions?.[0]?.value || '0', 10),
        video_views_100: parseInt(c.video_p100_watched_actions?.[0]?.value || '0', 10),
        date_start: c.date_start,
        date_stop: c.date_stop,
      };
    });

    const totals = campaigns.reduce(
      (acc, c) => ({
        total_spend: acc.total_spend + c.spend,
        total_impressions: acc.total_impressions + c.impressions,
        total_clicks: acc.total_clicks + c.clicks,
      }),
      { total_spend: 0, total_impressions: 0, total_clicks: 0 }
    );

    // CTR médio = soma dos cliques no link / soma das impressões * 100
    const avg_ctr =
      totals.total_impressions > 0 ? (totals.total_clicks / totals.total_impressions) * 100 : 0;
    const avg_cpm =
      totals.total_impressions > 0 ? (totals.total_spend / totals.total_impressions) * 1000 : 0;
    const avg_cpc = totals.total_clicks > 0 ? totals.total_spend / totals.total_clicks : 0;

    const roasValues = campaigns.filter((c) => c.roas !== undefined).map((c) => c.roas!);
    const avg_roas =
      roasValues.length > 0 ? roasValues.reduce((a, b) => a + b, 0) / roasValues.length : 0;

    const result: AccountInsights = {
      ...totals,
      avg_ctr,
      avg_cpm,
      avg_cpc,
      avg_roas,
      campaigns,
    };

    this.insightsCache.set(cacheKey, {
      data: result,
      expires: Date.now() + this.getTtlMs(datePreset),
    });

    return result;
  }

  /**
   * Retorna insights agregados por dia (série temporal) para o período.
   * Usa time_increment=1 para receber um ponto por dia.
   * Ideal para sparklines e gráficos de linha.
   */
  async getAccountTimeseries(
    accountId: string,
    workspace: string,
    datePreset: string = 'last_30d'
  ): Promise<Array<{
    date: string;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    cpm: number;
    roas: number;
    conversions: number;
  }>> {
    const cacheKey = `${workspace}|${accountId}|${datePreset}`;

    const cached = this.timeseriesCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.data as any;

    const pending = this.timeseriesInflight.get(cacheKey);
    if (pending) return pending as any;

    const promise = (async () => {
      const token = this.getToken(workspace);
      const data = await metaGet<{ data: any[] }>(`/${accountId}/insights`, {
        fields: [
          'impressions', 'inline_link_clicks', 'spend',
          'cpc', 'cpm', 'inline_link_click_ctr',
          'actions', 'action_values',
        ].join(','),
        date_preset: datePreset,
        time_increment: '1',
        level: 'account',
        access_token: token,
        limit: '500',
      });

      const raw: any[] = data.data ?? [];
      const getVal = (arr: any[] | undefined, type: string) =>
        parseFloat(arr?.find((a: any) => a.action_type === type)?.value || '0');

      const result = raw
        .map((d) => {
          const spend = parseFloat(d.spend || '0');
          const purchases = getVal(d.actions, 'purchase');
          const leads = getVal(d.actions, 'lead');
          const msgStarted =
            getVal(d.actions, 'onsite_conversion.messaging_conversation_started_7d') ||
            getVal(d.actions, 'onsite_conversion.total_messaging_connection');
          const conversions = purchases || leads || msgStarted || 0;
          const purchaseValue = getVal(d.action_values, 'purchase');
          const roas = purchaseValue > 0 && spend > 0 ? purchaseValue / spend : 0;

          return {
            date: d.date_start as string,
            spend,
            impressions: parseInt(d.impressions || '0', 10),
            clicks: parseInt(d.inline_link_clicks || '0', 10),
            ctr: parseFloat(d.inline_link_click_ctr || '0'),
            cpc: parseFloat(d.cpc || '0'),
            cpm: parseFloat(d.cpm || '0'),
            roas,
            conversions,
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date));

      this.timeseriesCache.set(cacheKey, {
        data: result,
        expires: Date.now() + this.getTtlMs(datePreset),
      });
      return result;
    })();

    this.timeseriesInflight.set(cacheKey, promise as any);
    try {
      return await promise;
    } finally {
      this.timeseriesInflight.delete(cacheKey);
    }
  }

  /** Fetch ad-level insights (CTR, CPC, spend) for a given account */
  async getAdInsights(
    accountId: string,
    workspace: string,
    datePreset: string = 'last_7d'
  ): Promise<{ ad_id: string; ad_name: string; ctr: number; cpc: number; spend: number; impressions: number }[]> {
    const token = this.getToken(workspace);
    try {
      const data = await metaGet<{ data: any[] }>(`/${accountId}/insights`, {
        fields: 'ad_id,ad_name,impressions,inline_link_clicks,inline_link_click_ctr,spend,cpc',
        date_preset: datePreset,
        level: 'ad',
        access_token: token,
        limit: '100',
      });
      return (data.data ?? []).map((row: any) => ({
        ad_id: row.ad_id,
        ad_name: row.ad_name,
        ctr: parseFloat(row.inline_link_click_ctr || '0'),
        cpc: parseFloat(row.cpc || '0'),
        spend: parseFloat(row.spend || '0'),
        impressions: parseInt(row.impressions || '0', 10),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Busca todos os anúncios da conta com métricas (insights) + metadata do criativo
   * (thumbnail, título, copy). Retorna ordenado por CTR decrescente.
   */
  async getAdsWithCreatives(
    accountId: string,
    workspace: string,
    datePreset: string = 'last_30d'
  ): Promise<Array<{
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
  }>> {
    const token = this.getToken(workspace);

    // 1) Puxa insights por ad (já com datePreset)
    let insightsRows: any[] = [];
    try {
      const insightsRes = await metaGet<{ data: any[] }>(`/${accountId}/insights`, {
        fields: 'ad_id,ad_name,campaign_id,campaign_name,impressions,inline_link_clicks,inline_link_click_ctr,spend,cpc,cpm',
        date_preset: datePreset,
        level: 'ad',
        access_token: token,
        limit: '200',
      });
      insightsRows = insightsRes.data ?? [];
    } catch (e) {
      console.error('[getAdsWithCreatives] insights error:', e);
      return [];
    }

    if (insightsRows.length === 0) return [];

    // 2) Puxa metadata (creative + status) de TODOS os ads da conta em lote
    const adMeta = new Map<string, any>();
    try {
      let after: string | undefined;
      do {
        const params: any = {
          fields: 'id,name,status,effective_status,creative{id,title,body,image_url,thumbnail_url,call_to_action_type}',
          access_token: token,
          limit: '200',
        };
        if (after) params.after = after;
        const adsRes = await metaGet<{ data: any[]; paging?: { cursors?: { after?: string }; next?: string } }>(
          `/${accountId}/ads`,
          params,
        );
        (adsRes.data ?? []).forEach((ad: any) => adMeta.set(ad.id, ad));
        after = adsRes.paging?.next ? adsRes.paging?.cursors?.after : undefined;
      } while (after);
    } catch (e) {
      console.error('[getAdsWithCreatives] ads metadata error:', e);
      // Mesmo sem metadata, retorna só os insights
    }

    // 3) Junta + ordena por CTR desc (empate: por spend desc)
    return insightsRows
      .map((row: any) => {
        const meta = adMeta.get(row.ad_id);
        return {
          ad_id: row.ad_id,
          ad_name: row.ad_name ?? meta?.name ?? 'Sem nome',
          campaign_id: row.campaign_id,
          campaign_name: row.campaign_name,
          status: meta?.status ?? 'UNKNOWN',
          effective_status: meta?.effective_status ?? 'UNKNOWN',
          ctr: parseFloat(row.inline_link_click_ctr || '0'),
          cpc: parseFloat(row.cpc || '0'),
          cpm: parseFloat(row.cpm || '0'),
          spend: parseFloat(row.spend || '0'),
          impressions: parseInt(row.impressions || '0', 10),
          clicks: parseInt(row.inline_link_clicks || '0', 10),
          creative: {
            id: meta?.creative?.id,
            title: meta?.creative?.title,
            body: meta?.creative?.body,
            image_url: meta?.creative?.image_url,
            thumbnail_url: meta?.creative?.thumbnail_url,
            call_to_action_type: meta?.creative?.call_to_action_type,
          },
        };
      })
      .sort((a, b) => {
        if (b.ctr !== a.ctr) return b.ctr - a.ctr;
        return b.spend - a.spend;
      });
  }

  async getAdSets(campaignId: string, workspace: string): Promise<AdSet[]> {
    const token = this.getToken(workspace);
    const data = await metaGet<{ data: AdSet[] }>(`/${campaignId}/adsets`, {
      fields: 'id,name,status,effective_status,daily_budget,lifetime_budget,optimization_goal,billing_event',
      access_token: token,
      limit: '50',
    });
    return data.data;
  }

  async getAds(adSetId: string, workspace: string): Promise<Ad[]> {
    const token = this.getToken(workspace);
    const data = await metaGet<{ data: any[] }>(`/${adSetId}/ads`, {
      fields: 'id,name,status,effective_status,creative{id,title,body,image_url,thumbnail_url,call_to_action_type}',
      access_token: token,
      limit: '50',
    });
    return data.data.map((ad: any) => ({
      id: ad.id,
      name: ad.name,
      status: ad.status,
      effective_status: ad.effective_status,
      creative: ad.creative
        ? {
          id: ad.creative.id,
          title: ad.creative.title,
          body: ad.creative.body,
          image_url: ad.creative.image_url,
          thumbnail_url: ad.creative.thumbnail_url,
          call_to_action_type: ad.creative.call_to_action_type,
        }
        : undefined,
    }));
  }

  async pauseCampaign(campaignId: string, workspace: string): Promise<void> {
    const token = this.getToken(workspace);
    await metaPost(`/${campaignId}`, { status: 'PAUSED', access_token: token });
  }

  async enableCampaign(campaignId: string, workspace: string): Promise<void> {
    const token = this.getToken(workspace);
    await metaPost(`/${campaignId}`, { status: 'ACTIVE', access_token: token });
  }

  async updateCampaignBudget(campaignId: string, dailyBudgetCents: number, workspace: string): Promise<void> {
    const token = this.getToken(workspace);
    await metaPost(`/${campaignId}`, {
      daily_budget: String(dailyBudgetCents),
      access_token: token,
    });
  }

  // ── AdSet Mutations ────────────────────────────────────────────────────────

  async pauseAdSet(adSetId: string, workspace: string): Promise<void> {
    const token = this.getToken(workspace);
    await metaPost(`/${adSetId}`, { status: 'PAUSED', access_token: token });
  }

  async enableAdSet(adSetId: string, workspace: string): Promise<void> {
    const token = this.getToken(workspace);
    await metaPost(`/${adSetId}`, { status: 'ACTIVE', access_token: token });
  }

  async updateAdSetBudget(adSetId: string, dailyBudgetCents: number, workspace: string): Promise<void> {
    const token = this.getToken(workspace);
    await metaPost(`/${adSetId}`, {
      daily_budget: String(dailyBudgetCents),
      access_token: token,
    });
  }

  // ── Ad Mutations ───────────────────────────────────────────────────────────

  async pauseAd(adId: string, workspace: string): Promise<void> {
    const token = this.getToken(workspace);
    await metaPost(`/${adId}`, { status: 'PAUSED', access_token: token });
  }

  async enableAd(adId: string, workspace: string): Promise<void> {
    const token = this.getToken(workspace);
    await metaPost(`/${adId}`, { status: 'ACTIVE', access_token: token });
  }

  // ── Creation Methods ───────────────────────────────────────────────────────

  async createCampaign(
    accountId: string,
    name: string,
    objective: string,
    status: string,
    specialAdCategories: string[] = ['NONE'],
    workspace: string
  ): Promise<{ id: string }> {
    const token = this.getToken(workspace);
    const res = await fetch(`${META_API_BASE}/${accountId}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        objective,
        status,
        special_ad_categories: specialAdCategories,
        access_token: token,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to create campaign: ${err}`);
    }
    return res.json() as Promise<{ id: string }>;
  }

  async createAdSet(
    accountId: string,
    campaignId: string,
    name: string,
    dailyBudgetCents: number,
    optimizationGoal: string,
    billingEvent: string,
    bidAmount: number | undefined,
    status: string,
    workspace: string
  ): Promise<{ id: string }> {
    const token = this.getToken(workspace);
    const payload: any = {
      name,
      campaign_id: campaignId,
      daily_budget: String(dailyBudgetCents),
      optimization_goal: optimizationGoal,
      billing_event: billingEvent,
      status,
      // Default targeting required for Meta APIs unless explicitly provided
      targeting: { geo_locations: { countries: ['BR'] } },
      access_token: token,
    };
    if (bidAmount) payload.bid_amount = String(bidAmount);

    const res = await fetch(`${META_API_BASE}/${accountId}/adsets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to create adset: ${err}`);
    }
    return res.json() as Promise<{ id: string }>;
  }

  async createAd(
    accountId: string,
    adSetId: string,
    name: string,
    creativeId: string,
    status: string,
    workspace: string
  ): Promise<{ id: string }> {
    const token = this.getToken(workspace);
    const res = await fetch(`${META_API_BASE}/${accountId}/ads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        adset_id: adSetId,
        creative: { creative_id: creativeId },
        status,
        access_token: token,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to create ad: ${err}`);
    }
    return res.json() as Promise<{ id: string }>;
  }

  // ── Creatives ──────────────────────────────────────────────────────────────

  // Updating an ad requires patching its creative. Since creatives are often immutable in Meta, 
  // sometimes you must create a new creative and update the ad to use it.
  // For simplicity here, we assume updating the ad's creative field.
  async createAdCreative(
    accountId: string,
    name: string,
    pageId: string,
    instagramId: string | undefined,
    link: string,
    message: string,
    imageUrl: string,
    callToActionType: string,
    workspace: string
  ): Promise<{ id: string }> {
    const token = this.getToken(workspace);

    // Simplest form: Link ad creative
    const creativePayload = {
      name,
      object_story_spec: {
        page_id: pageId,
        instagram_actor_id: instagramId,
        link_data: {
          link,
          message,
          image_url: imageUrl,
          call_to_action: { type: callToActionType }
        }
      },
      access_token: token,
    };

    const res = await fetch(`${META_API_BASE}/${accountId}/adcreatives`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creativePayload),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to create ad creative: ${err}`);
    }
    return res.json() as Promise<{ id: string }>;
  }

  async updateAdCreativeId(adId: string, creativeId: string, workspace: string): Promise<void> {
    const token = this.getToken(workspace);
    await metaPost(`/${adId}`, {
      'creative': JSON.stringify({ creative_id: creativeId }),
      access_token: token
    });
  }
}
