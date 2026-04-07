import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

export function initSupabase(): SupabaseClient {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables'
    );
  }

  supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseClient;
}

export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    initSupabase();
  }
  return supabaseClient!;
}

/**
 * Settings operations
 */
export async function getSetting(key: string): Promise<string | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', key)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned
    console.error(`Error getting setting ${key}:`, error);
  }

  return data?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value }, { onConflict: 'key' });

  if (error) {
    throw new Error(`Failed to set setting ${key}: ${error.message}`);
  }
}

/**
 * Integration tokens operations
 */
export async function getIntegration(provider: string): Promise<{
  refreshToken?: string;
  accessToken?: string;
  isValid: boolean;
} | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('integrations')
    .select('refresh_token, access_token, is_valid')
    .eq('provider', provider)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error(`Error getting integration ${provider}:`, error);
  }

  if (!data) return null;

  return {
    refreshToken: data.refresh_token || undefined,
    accessToken: data.access_token || undefined,
    isValid: data.is_valid,
  };
}

export async function saveIntegration(provider: string, tokens: {
  refreshToken?: string;
  accessToken?: string;
}): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('integrations')
    .upsert(
      {
        provider,
        refresh_token: tokens.refreshToken,
        access_token: tokens.accessToken,
        is_valid: true,
      },
      { onConflict: 'provider' }
    );

  if (error) {
    throw new Error(`Failed to save integration ${provider}: ${error.message}`);
  }
}

export async function invalidateIntegration(provider: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('integrations')
    .update({ is_valid: false })
    .eq('provider', provider);

  if (error) {
    throw new Error(`Failed to invalidate integration ${provider}: ${error.message}`);
  }
}
