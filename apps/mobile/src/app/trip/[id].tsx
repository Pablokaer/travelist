import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { PageHeader, Screen, Section } from '@/components/screen';
import { ErrorState, LoadingState } from '@/components/states';
import { Text } from '@/components/text';
import { AttractionRow } from '@/features/destinations/components';
import { MapView } from '@/features/map/map-view';
import { boundsOf } from '@/features/map/map-view.types';
import { useProfile } from '@/features/profile/api';
import { NavigationLinks, RouteTotals } from '@/features/route/components';
import { useDeleteTrip, useTrip } from '@/features/trips/api';
import { env } from '@/lib/env';
import { formatDate } from '@/lib/format';
import { radius, spacing } from '@/theme/colors';
import { useBreakpoint, useShadows, useTheme } from '@/theme/use-theme';

export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const trip = useTrip(id);
  const profile = useProfile();
  const del = useDeleteTrip();
  const [confirming, setConfirming] = useState(false);
  const lang = i18n.resolvedLanguage ?? 'en';
  const theme = useTheme();
  const shadows = useShadows();
  const { isDesktop } = useBreakpoint();

  const points = useMemo(
    () =>
      (trip.data?.stops ?? []).map((s, i) => ({
        id: s.id,
        lat: s.lat,
        lng: s.lng,
        color: theme.primary,
        selected: true,
        order: i + 1,
      })),
    [trip.data, theme.primary],
  );

  if (trip.isPending) return <LoadingState />;
  if (trip.isError) return <ErrorState onRetry={() => trip.refetch()} />;
  const data = trip.data;

  const map = (
    <View style={[styles.map, isDesktop && styles.mapDesktop, { boxShadow: shadows.card }]}>
      <MapView
        testID="trip-map"
        accessibilityLabel={t('route.mapLabel')}
        styleUrl={env.mapStyleUrl}
        bounds={boundsOf(data.stops, [-180, -85, 180, 85])}
        points={points}
        routes={data.geometry ? [{ geometry: data.geometry, color: theme.primary }] : []}
        onPointPress={(aid) => router.push({ pathname: '/attraction/[id]', params: { id: aid } })}
      />
    </View>
  );

  const details = (
    <View style={styles.column}>
      <RouteTotals
        distanceM={data.distanceM}
        walkingSeconds={data.walkingSeconds}
        visitMinutes={data.visitMinutes ?? 0}
        units={profile.data?.units ?? 'metric'}
        isFallback={data.isFallback}
        attribution={
          data.provider === 'openrouteservice'
            ? '© openrouteservice.org by HeiGIT | Map data © OpenStreetMap contributors'
            : null
        }
      />
      <Section title={t('route.stopsTitle')}>
        {data.stops.map((s, i) => (
          <AttractionRow
            key={s.id}
            item={s}
            index={i}
            onPress={() => router.push({ pathname: '/attraction/[id]', params: { id: s.id } })}
          />
        ))}
      </Section>
      <NavigationLinks stops={data.stops} />
      {confirming ? (
        <Card style={{ borderColor: theme.danger }}>
          <Text>{t('trips.deleteConfirm')}</Text>
          <View style={styles.actions}>
            <Button
              variant="danger"
              label={t('trips.deleteYes')}
              loading={del.isPending}
              onPress={() => del.mutate(data.id, { onSuccess: () => router.back() })}
            />
            <Button
              variant="ghost"
              label={t('common.cancel')}
              onPress={() => setConfirming(false)}
            />
          </View>
        </Card>
      ) : (
        <View style={styles.actions}>
          <Button
            variant="ghost"
            icon="trash"
            label={t('trips.delete')}
            onPress={() => setConfirming(true)}
          />
        </View>
      )}
    </View>
  );

  return (
    <Screen edges={['left', 'right']} width={isDesktop ? 'wide' : 'content'}>
      <Stack.Screen options={{ title: data.name }} />
      <PageHeader
        size="title"
        title={data.name}
        subtitle={data.tripDate ? formatDate(data.tripDate, lang, { dateStyle: 'full' }) : null}
      />
      {isDesktop ? (
        <View style={styles.split}>
          <View style={styles.column}>{map}</View>
          {details}
        </View>
      ) : (
        <>
          {map}
          {details}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  map: { height: 300, borderRadius: radius.xl, overflow: 'hidden' },
  mapDesktop: { height: 560 },
  split: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl },
  column: { flex: 1, gap: spacing.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
