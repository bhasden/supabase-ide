import { createClient, SupabaseClient } from '@supabase/supabase-js';

const clientCache = new Map<string, SupabaseClient>();

export function getSupabaseClient(url: string, apiKey: string): SupabaseClient {
  const key = `${url}::${apiKey}`;
  const cached = clientCache.get(key);
  if (cached) return cached;
  const client = createClient(url, apiKey);
  clientCache.set(key, client);
  return client;
}

export function deriveConnectionName(url: string): string {
  try {
    const host = new URL(url).hostname;
    const parts = host.split('.');
    return parts[0] || url;
  } catch {
    return url;
  }
}
