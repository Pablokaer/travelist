import type { Language, ProfileForm, Units } from '@wayfarer/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/auth-provider';
import { check, supabase, unwrap } from '@/lib/supabase';

export type Country = {
  code: string;
  name_en: string;
  name_pt: string;
};

export type Profile = {
  id: string;
  displayName: string | null;
  homeCountry: string | null;
  language: Language;
  units: Units;
  passportExpiry: string | null;
  onboardedAt: string | null;
  nationalities: string[];
};

export const profileKeys = {
  countries: ['countries'] as const,
  profile: (userId: string) => ['profile', userId] as const,
};

export function useCountries() {
  return useQuery({
    queryKey: profileKeys.countries,
    staleTime: 24 * 3600_000,
    queryFn: async () =>
      unwrap(
        await supabase.from('countries').select('code, name_en, name_pt').order('name_en'),
      ) as Country[],
  });
}

export function countryName(country: Country | undefined, language: string) {
  if (!country) return '';
  return language === 'pt' ? country.name_pt : country.name_en;
}

async function fetchProfile(userId: string): Promise<Profile> {
  const row = unwrap(
    await supabase
      .from('profiles')
      .select(
        'id, display_name, home_country, language, units, passport_expiry, onboarded_at, profile_nationalities(country_code)',
      )
      .eq('id', userId)
      .single(),
  );
  return {
    id: row.id,
    displayName: row.display_name,
    homeCountry: row.home_country,
    language: row.language as Language,
    units: row.units as Units,
    passportExpiry: row.passport_expiry,
    onboardedAt: row.onboarded_at,
    nationalities: (row.profile_nationalities ?? []).map((n) => n.country_code).sort(),
  };
}

export function useProfile() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: profileKeys.profile(userId ?? 'anonymous'),
    enabled: !!userId,
    queryFn: () => fetchProfile(userId!),
  });
}

export function useSaveProfile() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (form: ProfileForm) => {
      const userId = session!.user.id;
      check(
        await supabase
          .from('profiles')
          .update({
            display_name: form.displayName,
            home_country: form.homeCountry,
            language: form.language,
            units: form.units,
            passport_expiry: form.passportExpiry,
            onboarded_at: new Date().toISOString(),
          })
          .eq('id', userId),
      );
      check(await supabase.rpc('set_nationalities', { codes: form.nationalities }));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });
}

/** Lightweight update for single preferences (language, units). */
export function useUpdatePreferences() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { language?: Language; units?: Units }) => {
      check(await supabase.from('profiles').update(patch).eq('id', session!.user.id));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });
}
