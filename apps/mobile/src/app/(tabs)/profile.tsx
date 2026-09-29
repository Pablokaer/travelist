import { DEFAULT_THEME, SUPPORTED_LANGUAGES, THEMES, UNITS } from '@wayfarer/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ListRow, RowGroup } from '@/components/list-row';
import { PageHeader, Screen, Section } from '@/components/screen';
import { Text } from '@/components/text';
import { deleteAccount, signOut } from '@/features/auth/api';
import { useAuth } from '@/features/auth/auth-provider';
import { FormError } from '@/features/auth/components';
import {
  countryName,
  useCountries,
  useProfile,
  useUpdatePreferences,
} from '@/features/profile/api';
import { formatDate, initials } from '@/lib/format';
import { spacing } from '@/theme/colors';
import { useBreakpoint, useTheme } from '@/theme/use-theme';

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { isTablet } = useBreakpoint();
  const { session } = useAuth();
  const profile = useProfile();
  const countries = useCountries();
  const update = useUpdatePreferences();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lang = i18n.resolvedLanguage ?? 'en';
  const p = profile.data;
  const name = (code: string) =>
    countryName(
      countries.data?.find((c) => c.code === code),
      lang,
    ) || code;
  const displayName = p?.displayName ?? session?.user.email ?? '';

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <PageHeader title={t('profile.title')} />

      {p ? (
        <Card style={styles.identity}>
          <View style={[styles.avatar, { backgroundColor: theme.text }]}>
            <Text variant="title" style={{ color: theme.background }}>
              {initials(displayName)}
            </Text>
          </View>
          <View style={styles.identityText}>
            <Text variant="heading" numberOfLines={1}>
              {displayName}
            </Text>
            <Text variant="caption" secondary numberOfLines={1}>
              {session?.user.email}
            </Text>
          </View>
          <Button
            compact
            variant="secondary"
            label={t('profile.edit')}
            onPress={() => router.push('/edit-profile')}
            testID="edit-profile"
          />
        </Card>
      ) : null}

      <View style={[styles.columns, isTablet && styles.columnsWide]}>
        {p ? (
          <Section
            title={t('profile.travelDocuments')}
            style={isTablet ? styles.column : undefined}>
            <RowGroup>
              <ListRow
                icon="flag"
                label={t('profile.nationalities')}
                value={p.nationalities.map(name).join(', ') || '–'}
              />
              <ListRow
                icon="home"
                label={t('profile.homeCountry')}
                value={p.homeCountry ? name(p.homeCountry) : '–'}
              />
              <ListRow
                icon="passport"
                label={t('profile.passportExpiry')}
                value={p.passportExpiry ? formatDate(p.passportExpiry, lang) : t('profile.notSet')}
              />
            </RowGroup>
          </Section>
        ) : null}

        <Section title={t('profile.preferences')} style={isTablet ? styles.column : undefined}>
          <Text variant="label" secondary>
            {t('profile.language')}
          </Text>
          <View accessibilityRole="radiogroup">
            <RowGroup>
              {SUPPORTED_LANGUAGES.map((lng) => (
                <ListRow
                  key={lng}
                  role="radio"
                  label={t(`profile.languageName.${lng}`)}
                  selected={lang === lng}
                  onPress={() => {
                    void i18n.changeLanguage(lng);
                    if (p) update.mutate({ language: lng });
                  }}
                />
              ))}
            </RowGroup>
          </View>
          <Text variant="label" secondary>
            {t('profile.units')}
          </Text>
          <View accessibilityRole="radiogroup">
            <RowGroup>
              {UNITS.map((u) => (
                <ListRow
                  key={u}
                  role="radio"
                  label={t(`profile.unitsName.${u}`)}
                  selected={(p?.units ?? 'metric') === u}
                  onPress={() => update.mutate({ units: u })}
                />
              ))}
            </RowGroup>
          </View>
          <Text variant="label" secondary>
            {t('profile.theme')}
          </Text>
          <View accessibilityRole="radiogroup">
            <RowGroup>
              {THEMES.map((th) => (
                <ListRow
                  key={th}
                  role="radio"
                  label={t(`profile.themeName.${th}`)}
                  selected={(p?.theme ?? DEFAULT_THEME) === th}
                  onPress={() => update.mutate({ theme: th })}
                />
              ))}
            </RowGroup>
          </View>
        </Section>
      </View>

      <Section title={t('profile.account')}>
        <RowGroup>
          <ListRow
            icon="info"
            role="link"
            label={t('profile.about')}
            onPress={() => router.push('/about')}
          />
        </RowGroup>
        <FormError message={error} />
        <View style={styles.actions}>
          <Button
            variant="secondary"
            icon="logout"
            label={t('auth.signOut')}
            loading={busy && !confirmDelete}
            onPress={() => void run(signOut)}
            testID="sign-out"
          />
          {!confirmDelete ? (
            <Button
              variant="ghost"
              icon="trash"
              label={t('profile.deleteAccount')}
              onPress={() => setConfirmDelete(true)}
            />
          ) : null}
        </View>
        {confirmDelete ? (
          <Card style={{ borderColor: theme.danger }}>
            <Text>{t('profile.deleteConfirm')}</Text>
            <View style={styles.actions}>
              <Button
                variant="danger"
                label={t('profile.deleteYes')}
                loading={busy}
                onPress={() => void run(deleteAccount)}
              />
              <Button
                variant="ghost"
                label={t('common.cancel')}
                onPress={() => setConfirmDelete(false)}
              />
            </View>
          </Card>
        ) : null}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityText: { flex: 1, minWidth: 140, gap: spacing.xxs },
  columns: { gap: spacing.lg },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
