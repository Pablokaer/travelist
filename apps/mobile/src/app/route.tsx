import { zodResolver } from '@hookform/resolvers/zod';
import {
  ROUTE_MAX_STOPS,
  ROUTE_MIN_STOPS,
  saveTripFormSchema,
  type RouteResponse,
  type SaveTripForm,
} from '@wayfarer/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { EmptyState } from '@/components/states';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { FormError } from '@/features/auth/components';
import { useCities } from '@/features/destinations/api';
import { AttractionRow } from '@/features/destinations/components';
import { MapView } from '@/features/map/map-view';
import { boundsOf } from '@/features/map/map-view.types';
import { useProfile } from '@/features/profile/api';
import { useOptimizeRoute } from '@/features/route/api';
import { RouteTotals } from '@/features/route/components';
import { useRouteStore } from '@/features/route/store';
import { useSaveTrip } from '@/features/trips/api';
import { env } from '@/lib/env';
import { spacing } from '@/theme/colors';

export default function RouteScreen() {
  const { t, i18n } = useTranslation();
  const { stops, citySlug, remove, move, setOrder, clear } = useRouteStore();
  const cities = useCities();
  const profile = useProfile();
  const city = cities.data?.find((c) => c.slug === citySlug);
  const optimize = useOptimizeRoute();
  const save = useSaveTrip();
  const [result, setResult] = useState<RouteResponse | null>(null);

  const cityName = city ? (i18n.resolvedLanguage === 'pt' ? city.namePt : city.nameEn) : '';
  const { control, handleSubmit } = useForm<SaveTripForm>({
    resolver: zodResolver(saveTripFormSchema),
    defaultValues: { name: t('route.defaultName', { city: cityName }), tripDate: null },
  });

  const points = useMemo(
    () =>
      stops.map((s, i) => ({
        id: s.id,
        lat: s.lat,
        lng: s.lng,
        color: '#0B6E99',
        selected: true,
        order: i + 1,
      })),
    [stops],
  );
  const visitMinutes = stops.reduce((sum, s) => sum + s.avgVisitMinutes, 0);

  if (stops.length === 0) {
    return (
      <EmptyState
        title={t('route.emptyTitle')}
        body={t('route.emptyBody')}
        action={<Button label={t('route.backToMap')} onPress={() => router.back()} />}
      />
    );
  }

  const invalidate = () => setResult(null);
  const runOptimize = () =>
    optimize.mutate(
      { stops, keepFirst: true },
      {
        onSuccess: (r) => {
          setOrder(r.order);
          setResult(r);
        },
      },
    );

  const onSave = handleSubmit((form) =>
    save.mutate(
      { ...form, citySlug: citySlug!, stops, route: result },
      {
        onSuccess: (id) => {
          clear();
          router.replace({ pathname: '/trip/[id]', params: { id } });
        },
      },
    ),
  );

  const fallbackBounds: [number, number, number, number] = city
    ? [city.bbox[1], city.bbox[0], city.bbox[3], city.bbox[2]]
    : [-180, -85, 180, 85];

  return (
    <Screen>
      <Text variant="title">{t('route.titleFor', { city: cityName })}</Text>
      <Text secondary>{t('route.stopsHint', { min: ROUTE_MIN_STOPS, max: ROUTE_MAX_STOPS })}</Text>
      <View style={styles.map}>
        <MapView
          testID="route-map"
          accessibilityLabel={t('route.mapLabel')}
          styleUrl={env.mapStyleUrl}
          bounds={boundsOf(stops, fallbackBounds)}
          points={points}
          route={result?.geometry}
        />
      </View>

      <View style={{ gap: spacing.sm }}>
        {stops.map((s, i) => (
          <AttractionRow
            key={s.id}
            item={s}
            index={i}
            trailing={
              <View style={styles.rowActions}>
                <Button
                  compact
                  variant="ghost"
                  label="↑"
                  accessibilityLabel={t('route.moveUp')}
                  disabled={i === 0}
                  onPress={() => {
                    move(s.id, -1);
                    invalidate();
                  }}
                />
                <Button
                  compact
                  variant="ghost"
                  label="↓"
                  accessibilityLabel={t('route.moveDown')}
                  disabled={i === stops.length - 1}
                  onPress={() => {
                    move(s.id, 1);
                    invalidate();
                  }}
                />
                <Button
                  compact
                  variant="ghost"
                  label="✕"
                  accessibilityLabel={t('route.removeNamed', { name: s.nameEn })}
                  onPress={() => {
                    remove(s.id);
                    invalidate();
                  }}
                />
              </View>
            }
          />
        ))}
      </View>

      <RouteTotals
        distanceM={result?.distanceM ?? null}
        walkingSeconds={result?.walkingSeconds ?? null}
        visitMinutes={visitMinutes}
        units={profile.data?.units ?? 'metric'}
        isFallback={result?.isFallback}
        attribution={result?.attribution}
      />

      <Button
        label={result ? t('route.reoptimize') : t('route.optimize')}
        onPress={runOptimize}
        loading={optimize.isPending}
        disabled={stops.length < ROUTE_MIN_STOPS}
        testID="optimize"
      />
      {stops.length < ROUTE_MIN_STOPS ? (
        <Text variant="caption" secondary>
          {t('route.needMore', { min: ROUTE_MIN_STOPS })}
        </Text>
      ) : null}
      <FormError message={optimize.error ? t('route.optimizeError') : null} />

      <View style={styles.save}>
        <Text variant="heading">{t('route.saveTitle')}</Text>
        <Controller
          control={control}
          name="name"
          render={({ field, fieldState }) => (
            <TextField
              label={t('route.tripName')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              maxLength={80}
              testID="trip-name"
            />
          )}
        />
        <Controller
          control={control}
          name="tripDate"
          render={({ field, fieldState }) => (
            <TextField
              label={t('route.tripDate')}
              placeholder={`YYYY-MM-DD · ${t('checklist.optional')}`}
              value={field.value ?? ''}
              onChangeText={(v) => field.onChange(v.trim() === '' ? null : v.trim())}
              error={fieldState.error?.message}
              maxLength={10}
            />
          )}
        />
        <FormError message={save.error ? save.error.message : null} />
        <Button
          label={t('route.save')}
          onPress={onSave}
          loading={save.isPending}
          disabled={stops.length < ROUTE_MIN_STOPS || optimize.isPending}
          testID="save-trip"
        />
        <Button
          variant="ghost"
          label={t('route.clear')}
          onPress={() => {
            clear();
            router.back();
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  map: { height: 280, borderRadius: 20, overflow: 'hidden' },
  rowActions: { flexDirection: 'row' },
  save: { gap: spacing.sm, marginTop: spacing.md },
});
