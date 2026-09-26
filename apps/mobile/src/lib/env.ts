import { z } from 'zod';

/**
 * Public, client-side configuration. Only EXPO_PUBLIC_* variables are inlined by Expo.
 * Values must be read with static `process.env.EXPO_PUBLIC_X` access so Metro can inline them.
 */
const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

const envSchema = z.object({
  supabaseUrl: z.preprocess(emptyToUndefined, z.url().optional()),
  supabaseAnonKey: z.preprocess(emptyToUndefined, z.string().optional()),
  mapStyleUrl: z.preprocess(
    emptyToUndefined,
    z.url().default('https://tiles.openfreemap.org/styles/liberty'),
  ),
  sentryDsn: z.preprocess(emptyToUndefined, z.string().optional()),
  posthogKey: z.preprocess(emptyToUndefined, z.string().optional()),
  posthogHost: z.preprocess(emptyToUndefined, z.url().default('https://eu.i.posthog.com')),
});

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<keyof AppEnv, string | undefined>): AppEnv {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid EXPO_PUBLIC_* configuration: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export const env: AppEnv = parseEnv({
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  mapStyleUrl: process.env.EXPO_PUBLIC_MAP_STYLE_URL,
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY,
  posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST,
});
