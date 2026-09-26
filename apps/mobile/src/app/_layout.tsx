import '@/lib/i18n';

import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { createQueryClient } from '@/lib/query-client';
import { palette } from '@/theme/colors';
import { useColorSchemeName } from '@/theme/use-theme';

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  const scheme = useColorSchemeName();
  const { t } = useTranslation();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const colors = palette[scheme];

  return (
    <QueryClientProvider client={queryClient}>
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
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="about" options={{ title: t('about.title') }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
