import { SUPPORTED_LANGUAGES, UNITS } from '@wayfarer/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/button';
import { ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
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
import { formatDate } from '@/lib/format';
import { spacing } from '@/theme/colors';

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
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
      <Text variant="title">{t('profile.title')}</Text>
      {p ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="heading">{p.displayName ?? session?.user.email}</Text>
          <Text secondary>{session?.user.email}</Text>
          <ListRow
            label={t('profile.nationalities')}
            value={p.nationalities.map(name).join(', ') || '–'}
          />
          <ListRow
            label={t('profile.homeCountry')}
            value={p.homeCountry ? name(p.homeCountry) : '–'}
          />
          <ListRow
            label={t('profile.passportExpiry')}
            value={p.passportExpiry ? formatDate(p.passportExpiry, lang) : t('profile.notSet')}
          />
          <Button
            variant="secondary"
            label={t('profile.edit')}
            onPress={() => router.push('/edit-profile')}
            testID="edit-profile"
          />
        </View>
      ) : null}

      <Text variant="heading">{t('profile.language')}</Text>
      <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
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
      </View>

      <Text variant="heading">{t('profile.units')}</Text>
      <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
        {UNITS.map((u) => (
          <ListRow
            key={u}
            role="radio"
            label={t(`profile.unitsName.${u}`)}
            selected={(p?.units ?? 'metric') === u}
            onPress={() => update.mutate({ units: u })}
          />
        ))}
      </View>

      <ListRow role="link" label={t('profile.about')} onPress={() => router.push('/about')} />
      <FormError message={error} />
      <Button
        variant="secondary"
        label={t('auth.signOut')}
        loading={busy && !confirmDelete}
        onPress={() => void run(signOut)}
        testID="sign-out"
      />
      {confirmDelete ? (
        <View style={{ gap: spacing.sm }}>
          <Text>{t('profile.deleteConfirm')}</Text>
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
      ) : (
        <Button
          variant="ghost"
          label={t('profile.deleteAccount')}
          onPress={() => setConfirmDelete(true)}
        />
      )}
    </Screen>
  );
}
