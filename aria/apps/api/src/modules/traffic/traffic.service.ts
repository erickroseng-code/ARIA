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

    return {
      ...totals,
      avg_ctr,
      avg_cpm,
      avg_cpc,
      avg_roas,
      campaigns,
    };
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
