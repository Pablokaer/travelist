// Response cache over `public.api_cache` (key text PK, value jsonb, expires_at timestamptz).
// Cache failures are logged and never fail the request: the fetcher result is returned anyway.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface CacheStore {
  get(key: string, now: Date): Promise<unknown | undefined>;
  set(key: string, value: unknown, expiresAt: Date): Promise<void>;
  purgeExpired(now: Date): Promise<void>;
}

/** TTL in seconds, or a function of the fetched value (≤ 0 means "do not store"). */
export type Ttl<T> = number | ((value: T) => number);

export type Cached = <T>(key: string, ttl: Ttl<T>, fetcher: () => Promise<T>) => Promise<T>;

/** Pass-through cache (tests, or when no store is available). */
export const noCache: Cached = (_key, _ttl, fetcher) => fetcher();

/** Stable JSON: object keys sorted recursively, so equal inputs hash equally. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** `${namespace}:${sha256(stable JSON of the normalised input)}`. */
export async function cacheKey(namespace: string, input: unknown): Promise<string> {
  return `${namespace}:${await sha256Hex(stableStringify(input))}`;
}

export function createCached(
  store: CacheStore,
  opts: { now?: () => Date; purgeProbability?: number; random?: () => number } = {},
): Cached {
  const now = opts.now ?? (() => new Date());
  const purgeProbability = opts.purgeProbability ?? 0.02;
  const random = opts.random ?? Math.random;

  return async <T>(key: string, ttl: Ttl<T>, fetcher: () => Promise<T>): Promise<T> => {
    try {
      const hit = await store.get(key, now());
      if (hit !== undefined) return hit as T;
    } catch (err) {
      console.warn(`cache read failed for ${key}:`, err);
    }

    const value = await fetcher();
    const seconds = typeof ttl === 'function' ? ttl(value) : ttl;
    if (seconds > 0) {
      try {
        const at = now();
        await store.set(key, value, new Date(at.getTime() + seconds * 1000));
        if (random() < purgeProbability) await store.purgeExpired(at);
      } catch (err) {
        console.warn(`cache write failed for ${key}:`, err);
      }
    }
    return value;
  };
}

export function supabaseCacheStore(client: SupabaseClient): CacheStore {
  return {
    async get(key, now) {
      const { data, error } = await client
        .from('api_cache')
        .select('value')
        .eq('key', key)
        .gt('expires_at', now.toISOString())
        .maybeSingle();
      if (error) throw error;
      return data ? (data.value as unknown) : undefined;
    },
    async set(key, value, expiresAt) {
      const { error } = await client
        .from('api_cache')
        .upsert({
          key,
          value,
          expires_at: expiresAt.toISOString(),
          created_at: new Date().toISOString(),
        });
      if (error) throw error;
    },
    async purgeExpired(now) {
      const { error } = await client.from('api_cache').delete().lt('expires_at', now.toISOString());
      if (error) throw error;
    },
  };
}
