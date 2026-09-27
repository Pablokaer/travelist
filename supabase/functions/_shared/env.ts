// Typed access to Edge Function environment variables. Empty strings count as unset, so a
// blank `ORS_API_KEY=` in .env behaves exactly like a missing key.

function optional(name: string): string | undefined {
  const value = Deno.env.get(name)?.trim();
  return value ? value : undefined;
}

function required(name: string): string {
  const value = optional(name);
  if (!value) throw new Error(`missing environment variable ${name}`);
  return value;
}

export const env = {
  /** Injected by the Supabase edge runtime. */
  supabaseUrl: (): string => required('SUPABASE_URL'),
  /** Injected by the Supabase edge runtime. */
  serviceRoleKey: (): string => required('SUPABASE_SERVICE_ROLE_KEY'),
  orsApiKey: (): string | undefined => optional('ORS_API_KEY'),
  /** Frankfurter-compatible base URL overriding the public Frankfurter instance. */
  exchangeRatesBaseUrl: (): string | undefined => optional('EXCHANGE_RATES_BASE_URL'),
};
