import { isoDateSchema, type Language } from '@wayfarer/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useChecklist } from '@/features/checklist/api';
import {
  MoneySection,
  PassportSection,
  PowerSection,
  PracticalSection,
  SafetySection,
  VisaSection,
  WeatherSection,
} from '@/features/checklist/sections';
import { useCities } from '@/features/destinations/api';
import { useProfile } from '@/features/profile/api';
import { todayIso } from '@/lib/format';
import { spacing } from '@/theme/colors';

const valid = (v: string) => isoDateSchema.safeParse(v).success;

export default function ChecklistScreen() {
  const { city: citySlug } = useLocalSearchParams<{ city: string }>();
  const { t, i18n } = useTranslation();
  const profile = useProfile();
  const cities = useCities();
  const city = cities.data?.find((c) => c.slug === citySlug);

  const [arrivalInput, setArrivalInput] = useState(todayIso());
  const [departureInput, setDepartureInput] = useState('');
  const [dates, setDates] = useState<{ arrival: string; departure: string | null }>({
    arrival: todayIso(),
    departure: null,
  });
  const datesError =
    !valid(arrivalInput) ||
    (departureInput !== '' && (!valid(departureInput) || departureInput < arrivalInput))
      ? 'validation.date'
      : undefined;

  const p = profile.data;
  const request = useMemo(
    () =>
      p && citySlug && p.nationalities.length
        ? {
            city: citySlug,
            nationalities: p.nationalities,
            homeCountry: p.homeCountry,
            passportExpiry: p.passportExpiry,
            arrival: dates.arrival,
            departure: dates.departure,
            language: (i18n.resolvedLanguage ?? 'en') as Language,
          }
        : null,
    [p, citySlug, dates, i18n.resolvedLanguage],
  );
  const checklist = useChecklist(request);
  const cityName = city ? (i18n.resolvedLanguage === 'pt' ? city.namePt : city.nameEn) : '';

  if (profile.isPending) return <LoadingState />;
  if (p && p.nationalities.length === 0) {
    return (
      <EmptyState
        title={t('checklist.needNationality')}
        action={<Button label={t('profile.edit')} onPress={() => router.push('/edit-profile')} />}
      />
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t('checklist.titleFor', { city: cityName }) }} />
      <Text secondary>{t('checklist.intro')}</Text>
      <View style={styles.dates}>
        <View style={styles.flex}>
          <TextField
            label={t('checklist.arrival')}
            value={arrivalInput}
            onChangeText={setArrivalInput}
            placeholder="YYYY-MM-DD"
            maxLength={10}
            testID="arrival"
          />
        </View>
        <View style={styles.flex}>
          <TextField
            label={t('checklist.departure')}
            value={departureInput}
            onChangeText={setDepartureInput}
            placeholder={t('checklist.optional')}
            maxLength={10}
            testID="departure"
          />
        </View>
      </View>
      {datesError ? (
        <Text variant="caption" secondary>
          {t('checklist.datesHint')}
        </Text>
      ) : null}
      <Button
        compact
        variant="secondary"
        label={t('checklist.update')}
        disabled={!!datesError}
        onPress={() => setDates({ arrival: arrivalInput, departure: departureInput || null })}
      />

      {checklist.isPending ? (
        <LoadingState label={t('checklist.loading')} />
      ) : checklist.isError ? (
        <ErrorState message={t('checklist.error')} onRetry={() => checklist.refetch()} />
      ) : (
        <View style={{ gap: spacing.md }}>
          <VisaSection data={checklist.data.visa} />
          <PassportSection data={checklist.data.passport} />
          <WeatherSection data={checklist.data.weather} units={p?.units ?? 'metric'} />
          <PowerSection data={checklist.data.power} />
          <MoneySection data={checklist.data.money} />
          <SafetySection data={checklist.data.safety} />
          <PracticalSection data={checklist.data.practical} />
          <Text variant="caption" secondary>
            {t('checklist.disclaimer')}
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dates: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
