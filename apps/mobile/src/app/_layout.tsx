import '@/lib/i18n';

import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DEFAULT_THEME } from '@wayfarer/shared';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Appearance, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/states';
import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import { useProfile } from '@/features/profile/api';
import { createQueryClient } from '@/lib/query-client';
import { fontAssets, fontFamilyFor } from '@/theme/fonts';
import { navigationTheme } from '@/theme/navigation';
import { ColorSchemeContext, useTheme } from '@/theme/use-theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootNavigator() {
  const { t, i18n } = useTranslation();
  const { session, isLoading } = useAuth();
  const profile = useProfile();
  const theme = useTheme();
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
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: theme.text,
        headerBackButtonDisplayMode: 'minimal',
        headerTitleStyle: { fontFamily: fontFamilyFor('600'), fontSize: 16 },
        contentStyle: { backgroundColor: theme.background },
      }}>
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

/** Applies the profile's theme (D-021) to our tokens, navigation and native UI. */
function ThemedApp() {
  const profile = useProfile();
  const scheme = profile.data?.theme ?? DEFAULT_THEME;
  useEffect(() => {
    // Keyboards, alerts and pickers follow the app's choice, not the system's (native only).
    if (Platform.OS !== 'web') Appearance.setColorScheme(scheme);
  }, [scheme]);

  return (
    <ColorSchemeContext.Provider value={scheme}>
      <ThemeProvider value={navigationTheme(scheme)}>
        <RootNavigator />
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      </ThemeProvider>
    </ColorSchemeContext.Provider>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const ready = fontsLoaded || !!fontError;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);
  // Hold the splash screen until Inter is available, so text never reflows.
  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemedApp />
      </AuthProvider>
    </QueryClientProvider>
  );
}
