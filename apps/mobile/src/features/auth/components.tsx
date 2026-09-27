import { SUPPORTED_LANGUAGES } from '@wayfarer/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { signInWithOAuth, type OAuthProvider } from './api';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Text } from '@/components/text';
import { env } from '@/lib/env';
import { spacing } from '@/theme/colors';
import { useTheme } from '@/theme/use-theme';

export function FormError({ message }: { message: string | null }) {
  const theme = useTheme();
  if (!message) return null;
  return (
    <Text accessibilityRole="alert" style={{ color: theme.danger }}>
      {message}
    </Text>
  );
}

export function OAuthButtons({ onError }: { onError: (message: string) => void }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  if (env.authProviders.length === 0) return null;

  const run = async (provider: OAuthProvider) => {
    setBusy(provider);
    try {
      await signInWithOAuth(provider);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // Users closing the Apple sheet is not an error worth showing.
      if (!/cancel/i.test(message)) onError(message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.oauth}>
      <View style={styles.divider}>
        <Text secondary variant="caption">
          {t('auth.orContinueWith')}
        </Text>
      </View>
      {env.authProviders.map((p) => (
        <Button
          key={p}
          variant="secondary"
          label={t(`auth.provider.${p}`)}
          loading={busy === p}
          disabled={busy !== null}
          onPress={() => void run(p)}
        />
      ))}
    </View>
  );
}

export function AuthFooter() {
  const { t, i18n } = useTranslation();
  return (
    <View style={styles.footer}>
      <View
        style={styles.langs}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('profile.language')}>
        {SUPPORTED_LANGUAGES.map((lng) => (
          <Chip
            key={lng}
            label={t(`profile.languageName.${lng}`)}
            selected={i18n.resolvedLanguage === lng}
            onPress={() => void i18n.changeLanguage(lng)}
          />
        ))}
      </View>
      <Button
        variant="ghost"
        compact
        label={t('profile.about')}
        onPress={() => router.push('/about')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  oauth: { gap: spacing.sm },
  divider: { alignItems: 'center', paddingVertical: spacing.sm },
  footer: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  langs: { flexDirection: 'row', gap: spacing.sm },
});
