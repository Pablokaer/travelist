import { isoDateSchema, type Language } from '@wayfarer/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { PageHeader, Screen } from '@/components/screen';
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
import { useBreakpoint } from '@/theme/use-theme';

const valid = (v: string) => isoDateSchema.safeParse(v).success;

export default function ChecklistScreen() {
  const { city: citySlug } = useLocalSearchParams<{ city: string }>();
  const { t, i18n } = useTranslation();
  const { isTablet, isDesktop } = useBreakpoint();
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
        icon="passport"
        title={t('checklist.needNationality')}
        action={<Button label={t('profile.edit')} onPress={() => router.push('/edit-profile')} />}
      />
    );
  }

  const sections = checklist.data
    ? [
        <VisaSection key="visa" data={checklist.data.visa} />,
        <PassportSection key="passport" data={checklist.data.passport} />,
        <WeatherSection key="weather" data={checklist.data.weather} units={p?.units ?? 'metric'} />,
        <PowerSection key="power" data={checklist.data.power} />,
        <MoneySection key="money" data={checklist.data.money} />,
        <SafetySection key="safety" data={checklist.data.safety} />,
        <PracticalSection key="practical" data={checklist.data.practical} />,
      ]
    : [];

  return (
    <Screen edges={['left', 'right']} width={isDesktop ? 'wide' : 'content'}>
      <Stack.Screen options={{ title: t('checklist.titleFor', { city: cityName }) }} />
      <PageHeader size="title" title={cityName} subtitle={t('checklist.intro')} />
      <Card muted style={[styles.dates, isTablet && styles.datesWide]}>
        <View style={styles.flex}>
          <TextField
            icon="calendar"
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
            icon="calendar"
            label={t('checklist.departure')}
            value={departureInput}
            onChangeText={setDepartureInput}
            placeholder={t('checklist.optional')}
            maxLength={10}
            testID="departure"
          />
        </View>
        <Button
          compact={isTablet}
          label={t('checklist.update')}
          disabled={!!datesError}
          onPress={() => setDates({ arrival: arrivalInput, departure: departureInput || null })}
        />
      </Card>
      {datesError ? (
        <Text variant="helper" secondary>
          {t('checklist.datesHint')}
        </Text>
      ) : null}

      {checklist.isPending ? (
        <LoadingState label={t('checklist.loading')} />
      ) : checklist.isError ? (
        <ErrorState message={t('checklist.error')} onRetry={() => checklist.refetch()} />
      ) : (
        <>
          {isTablet ? (
            // Two balanced columns on wider screens.
            <View style={styles.columns}>
              {[0, 1].map((col) => (
                <View key={col} style={styles.column}>
                  {sections.filter((_, i) => i % 2 === col)}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.column}>{sections}</View>
          )}
          <Text variant="helper" secondary>
            {t('checklist.disclaimer')}
          </Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dates: { gap: spacing.md },
  datesWide: { flexDirection: 'row', alignItems: 'flex-end' },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  column: { flex: 1, gap: spacing.md },
});
