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
    const token = this.getToken(workspace);
    const data = await metaGet<{ data: Campaign[] }>(`/${accountId}/campaigns`, {
      fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time',
      access_token: token,
      limit: '50',
    });
    return data.data;
  }

  async getAccountInsights(
    accountId: string,
    workspace: string,
    datePreset: string = 'last_30d'
  ): Promise<AccountInsights> {
    const token = this.getToken(workspace);
    const data = await metaGet<{ data: any[] }>(`/${accountId}/insights`, {
      fields: 'campaign_id,campaign_name,impressions,clicks,spend,cpc,cpm,ctr,reach,actions,action_values',
      date_preset: datePreset,
      level: 'campaign',
      access_token: token,
      limit: '50',
    });

    const raw: any[] = data.data ?? [];

    const campaigns: CampaignInsights[] = raw.map((c) => {
      const purchaseValue = c.action_values?.find((av: any) => av.action_type === 'purchase')?.value;
      const spend = parseFloat(c.spend || '0');
      const roas = purchaseValue && spend > 0 ? parseFloat(purchaseValue) / spend : undefined;

      return {
        campaign_id: c.campaign_id,
        campaign_name: c.campaign_name,
        impressions: parseInt(c.impressions || '0', 10),
        clicks: parseInt(c.clicks || '0', 10),
        spend,
        cpc: parseFloat(c.cpc || '0'),
        cpm: parseFloat(c.cpm || '0'),
        ctr: parseFloat(c.ctr || '0'),
        reach: parseInt(c.reach || '0', 10),
        roas,
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

    const avg_ctr =
      totals.total_impressions > 0 ? (totals.total_clicks / totals.total_impressions) * 100 : 0;
    const avg_cpm =
      totals.total_impressions > 0 ? (totals.total_spend / totals.total_impressions) * 1000 : 0;
    const avg_cpc = totals.total_clicks > 0 ? totals.total_spend / totals.total_clicks : 0;

    const roasValues = campaigns.filter((c) => c.roas !== undefined).map((c) => c.roas!);
    const avg_roas =
      roasValues.length > 0 ? roasValues.reduce((a, b) => a + b, 0) / roasValues.length : 0;

    return {
      ...totals,
      avg_ctr,
      avg_cpm,
      avg_cpc,
      avg_roas,
      campaigns,
    };
  }

  async pauseCampaign(campaignId: string, workspace: string): Promise<void> {
    const token = this.getToken(workspace);
    await metaPost(`/${campaignId}`, { status: 'PAUSED', access_token: token });
  }

  async enableCampaign(campaignId: string, workspace: string): Promise<void> {
    const token = this.getToken(workspace);
    await metaPost(`/${campaignId}`, { status: 'ACTIVE', access_token: token });
  }
}
