import '@/lib/i18n';

import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/states';
import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import { useProfile } from '@/features/profile/api';
import { createQueryClient } from '@/lib/query-client';
import { palette } from '@/theme/colors';
import { useColorSchemeName } from '@/theme/use-theme';

function RootNavigator() {
  const { t, i18n } = useTranslation();
  const { session, isLoading } = useAuth();
  const profile = useProfile();
  const signedIn = !!session;
  const onboarded = !!profile.data?.onboardedAt;

  // The profile's language wins over the device language once known.
  const profileLanguage = profile.data?.language;
  useEffect(() => {
    if (profileLanguage && i18n.resolvedLanguage !== profileLanguage)
      void i18n.changeLanguage(profileLanguage);
  }, [profileLanguage, i18n]);

  if (isLoading || (signedIn && profile.isPending)) return <LoadingState />;

  return (
    <Stack>
      <Stack.Protected guard={signedIn && onboarded}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="attraction/[id]" options={{ title: '', presentation: 'modal' }} />
        <Stack.Screen
          name="checklist/[city]"
          options={{ title: t('checklist.title'), presentation: 'modal' }}
        />
        <Stack.Screen name="route" options={{ title: t('route.title') }} />
        <Stack.Screen name="trip/[id]" options={{ title: t('trips.detailTitle') }} />
        <Stack.Screen name="edit-profile" options={{ title: t('profile.edit') }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !onboarded}>
        <Stack.Screen
          name="onboarding"
          options={{ title: t('onboarding.title'), headerBackVisible: false }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
      <Stack.Screen name="about" options={{ title: t('about.title') }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  const scheme = useColorSchemeName();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const colors = palette[scheme];

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider
          value={{
            ...base,
            colors: {
              ...base.colors,
              primary: colors.primary,
              background: colors.background,
              card: colors.background,
              text: colors.text,
              border: colors.border,
            },
          }}>
          <RootNavigator />
          <StatusBar style="auto" />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
