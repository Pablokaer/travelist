import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Text } from '@/components/text';
import { useAttractions, useCities } from '@/features/destinations/api';
import { AttractionRow, CategoryFilters, CitySwitcher } from '@/features/destinations/components';
import { useExploreStore } from '@/features/destinations/store';
import { MapView } from '@/features/map/map-view';
import { useRouteStore } from '@/features/route/store';
import { env } from '@/lib/env';
import { categoryColors, radius, spacing } from '@/theme/colors';
import { useTheme } from '@/theme/use-theme';

export default function ExploreScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const cities = useCities();
  const { citySlug, setCity, categories, toggleCategory, clearCategories, view, setView } =
    useExploreStore();
  const routeStops = useRouteStore((s) => s.stops);
  const routeCity = useRouteStore((s) => s.citySlug);

  const city = cities.data?.find((c) => c.slug === citySlug) ?? cities.data?.[0];
  useEffect(() => {
    if (!citySlug && cities.data?.[0]) setCity(routeCity ?? cities.data[0].slug);
  }, [citySlug, cities.data, routeCity, setCity]);

  const attractions = useAttractions(city, categories);
  const stopOrder = useMemo(() => new Map(routeStops.map((s, i) => [s.id, i + 1])), [routeStops]);
  const points = useMemo(
    () =>
      (attractions.data ?? []).map((a) => ({
        id: a.id,
        lat: a.lat,
        lng: a.lng,
        color: categoryColors[a.category] ?? categoryColors.other!,
        selected: stopOrder.has(a.id),
        order: stopOrder.get(a.id),
      })),
    [attractions.data, stopOrder],
  );

  if (cities.isPending) return <LoadingState />;
  if (cities.isError) return <ErrorState onRetry={() => cities.refetch()} />;
  if (!city) return <EmptyState title={t('explore.noCities')} body={t('explore.noCitiesBody')} />;

  const [south, west, north, east] = city.bbox;
  const openAttraction = (id: string) =>
    router.push({ pathname: '/attraction/[id]', params: { id } });

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <CitySwitcher cities={cities.data} current={city} onSelect={setCity} />
          <Button
            compact
            variant="secondary"
            label={t('checklist.open')}
            onPress={() =>
              router.push({ pathname: '/checklist/[city]', params: { city: city.slug } })
            }
            testID="open-checklist"
          />
        </View>
        <CategoryFilters
          selected={categories}
          onToggle={toggleCategory}
          onClear={clearCategories}
        />
        <View style={styles.headerRow}>
          <Text variant="caption" secondary accessibilityLiveRegion="polite">
            {attractions.isPending
              ? t('common.loading')
              : t('explore.placesCount', { count: attractions.data?.length ?? 0 })}
          </Text>
          <View
            style={styles.toggle}
            accessibilityRole="radiogroup"
            accessibilityLabel={t('explore.viewMode')}>
            <Chip
              label={t('explore.mapView')}
              selected={view === 'map'}
              onPress={() => setView('map')}
            />
            <Chip
              label={t('explore.listView')}
              selected={view === 'list'}
              onPress={() => setView('list')}
            />
          </View>
        </View>
      </View>

      <View style={styles.body}>
        {attractions.isError ? (
          <ErrorState onRetry={() => attractions.refetch()} />
        ) : view === 'map' ? (
          <MapView
            testID="explore-map"
            accessibilityLabel={t('explore.mapLabel')}
            styleUrl={env.mapStyleUrl}
            bounds={[west, south, east, north]}
            points={points}
            onPointPress={openAttraction}
          />
        ) : attractions.isPending ? (
          <LoadingState />
        ) : (
          <FlatList
            testID="attraction-list"
            data={attractions.data}
            keyExtractor={(a) => a.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <AttractionRow item={item} onPress={() => openAttraction(item.id)} />
            )}
            ListEmptyComponent={<EmptyState title={t('explore.noResults')} />}
          />
        )}
      </View>

      {routeStops.length > 0 ? (
        <View style={[styles.tray, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={{ flex: 1 }} accessibilityLiveRegion="polite">
            {t('route.trayCount', { count: routeStops.length })}
          </Text>
          <Button
            compact
            label={t('route.build')}
            onPress={() => router.push('/route')}
            testID="open-route"
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  toggle: { flexDirection: 'row', gap: spacing.xs },
  body: { flex: 1, marginTop: spacing.sm },
  list: { padding: spacing.md, gap: spacing.sm },
  tray: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
});
