import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
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
import { spacing } from '@/theme/colors';

export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const trip = useTrip(id);
  const profile = useProfile();
  const del = useDeleteTrip();
  const [confirming, setConfirming] = useState(false);
  const lang = i18n.resolvedLanguage ?? 'en';

  const points = useMemo(
    () =>
      (trip.data?.stops ?? []).map((s, i) => ({
        id: s.id,
        lat: s.lat,
        lng: s.lng,
        color: '#0B6E99',
        selected: true,
        order: i + 1,
      })),
    [trip.data],
  );

  if (trip.isPending) return <LoadingState />;
  if (trip.isError) return <ErrorState onRetry={() => trip.refetch()} />;
  const data = trip.data;

  return (
    <Screen>
      <Stack.Screen options={{ title: data.name }} />
      <Text variant="title">{data.name}</Text>
      {data.tripDate ? (
        <Text secondary>{formatDate(data.tripDate, lang, { dateStyle: 'full' })}</Text>
      ) : null}
      <View style={styles.map}>
        <MapView
          testID="trip-map"
          accessibilityLabel={t('route.mapLabel')}
          styleUrl={env.mapStyleUrl}
          bounds={boundsOf(data.stops, [-180, -85, 180, 85])}
          points={points}
          route={data.geometry}
          onPointPress={(aid) => router.push({ pathname: '/attraction/[id]', params: { id: aid } })}
        />
      </View>
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
      <View style={{ gap: spacing.sm }}>
        {data.stops.map((s, i) => (
          <AttractionRow
            key={s.id}
            item={s}
            index={i}
            onPress={() => router.push({ pathname: '/attraction/[id]', params: { id: s.id } })}
          />
        ))}
      </View>
      <NavigationLinks stops={data.stops} />
      {confirming ? (
        <View style={{ gap: spacing.sm }}>
          <Text>{t('trips.deleteConfirm')}</Text>
          <Button
            variant="danger"
            label={t('trips.deleteYes')}
            loading={del.isPending}
            onPress={() => del.mutate(data.id, { onSuccess: () => router.back() })}
          />
          <Button variant="ghost" label={t('common.cancel')} onPress={() => setConfirming(false)} />
        </View>
      ) : (
        <Button variant="ghost" label={t('trips.delete')} onPress={() => setConfirming(true)} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  map: { height: 300, borderRadius: 20, overflow: 'hidden' },
});
