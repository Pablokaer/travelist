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

import { Button, IconButton } from '@/components/button';
import { Card } from '@/components/card';
import { PageHeader, Screen, Section } from '@/components/screen';
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
import { radius, spacing } from '@/theme/colors';
import { useBreakpoint, useShadows, useTheme } from '@/theme/use-theme';

export default function RouteScreen() {
  const { t, i18n } = useTranslation();
  const { stops, citySlug, remove, move, setOrder, clear } = useRouteStore();
  const cities = useCities();
  const profile = useProfile();
  const city = cities.data?.find((c) => c.slug === citySlug);
  const optimize = useOptimizeRoute();
  const save = useSaveTrip();
  const [result, setResult] = useState<RouteResponse | null>(null);
  const theme = useTheme();
  const shadows = useShadows();
  const { isDesktop } = useBreakpoint();

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
        color: theme.primary,
        selected: true,
        order: i + 1,
      })),
    [stops, theme.primary],
  );
  const visitMinutes = stops.reduce((sum, s) => sum + s.avgVisitMinutes, 0);

  if (stops.length === 0) {
    return (
      <EmptyState
        icon="route"
        title={t('route.emptyTitle')}
        body={t('route.emptyBody')}
        action={<Button icon="map" label={t('route.backToMap')} onPress={() => router.back()} />}
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

  const map = (
    <View style={[styles.map, isDesktop && styles.mapDesktop, { boxShadow: shadows.card }]}>
      <MapView
        testID="route-map"
        accessibilityLabel={t('route.mapLabel')}
        styleUrl={env.mapStyleUrl}
        bounds={boundsOf(stops, fallbackBounds)}
        points={points}
        route={result?.geometry}
      />
    </View>
  );

  const details = (
    <View style={styles.column}>
      <Section title={t('route.stopsTitle')}>
        {stops.map((s, i) => (
          <AttractionRow
            key={s.id}
            item={s}
            index={i}
            trailing={
              <View style={styles.rowActions}>
                <IconButton
                  icon="arrowUp"
                  accessibilityLabel={t('route.moveUp')}
                  disabled={i === 0}
                  onPress={() => {
                    move(s.id, -1);
                    invalidate();
                  }}
                />
                <IconButton
                  icon="arrowDown"
                  accessibilityLabel={t('route.moveDown')}
                  disabled={i === stops.length - 1}
                  onPress={() => {
                    move(s.id, 1);
                    invalidate();
                  }}
                />
                <IconButton
                  icon="close"
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
      </Section>

      <RouteTotals
        distanceM={result?.distanceM ?? null}
        walkingSeconds={result?.walkingSeconds ?? null}
        visitMinutes={visitMinutes}
        units={profile.data?.units ?? 'metric'}
        isFallback={result?.isFallback}
        attribution={result?.attribution}
      />

      <View style={styles.optimize}>
        <Button
          icon="sparkles"
          variant={result ? 'secondary' : 'primary'}
          label={result ? t('route.reoptimize') : t('route.optimize')}
          onPress={runOptimize}
          loading={optimize.isPending}
          disabled={stops.length < ROUTE_MIN_STOPS}
          testID="optimize"
        />
        {stops.length < ROUTE_MIN_STOPS ? (
          <Text variant="helper" secondary>
            {t('route.needMore', { min: ROUTE_MIN_STOPS })}
          </Text>
        ) : null}
        <FormError message={optimize.error ? t('route.optimizeError') : null} />
      </View>

      <Card>
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
              icon="calendar"
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
          variant={result ? 'primary' : 'secondary'}
          label={t('route.save')}
          onPress={onSave}
          loading={save.isPending}
          disabled={stops.length < ROUTE_MIN_STOPS || optimize.isPending}
          testID="save-trip"
        />
        <Button
          variant="ghost"
          icon="trash"
          label={t('route.clear')}
          onPress={() => {
            clear();
            router.back();
          }}
        />
      </Card>
    </View>
  );

  return (
    <Screen edges={['left', 'right']} width={isDesktop ? 'wide' : 'content'}>
      <PageHeader
        size="title"
        title={t('route.titleFor', { city: cityName })}
        subtitle={t('route.stopsHint', { min: ROUTE_MIN_STOPS, max: ROUTE_MAX_STOPS })}
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
  map: { height: 280, borderRadius: radius.xl, overflow: 'hidden' },
  mapDesktop: { height: 560 },
  split: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl },
  column: { flex: 1, gap: spacing.lg },
  rowActions: { flexDirection: 'row' },
  optimize: { gap: spacing.sm },
});
