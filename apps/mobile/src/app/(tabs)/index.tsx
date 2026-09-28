import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/button';
import { useGutter } from '@/components/screen';
import { Segmented } from '@/components/segmented';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Text } from '@/components/text';
import { useAttractions, useCities } from '@/features/destinations/api';
import { AttractionCard, CategoryFilters, CitySwitcher } from '@/features/destinations/components';
import { useExploreStore } from '@/features/destinations/store';
import { MapView } from '@/features/map/map-view';
import { useRouteStore } from '@/features/route/store';
import { env } from '@/lib/env';
import { categoryColors, layout, radius, spacing } from '@/theme/colors';
import { useBreakpoint, useShadows, useTheme } from '@/theme/use-theme';

const GRID_GAP = spacing.lg;

export default function ExploreScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const shadows = useShadows();
  const gutter = useGutter();
  const { isTablet, columns } = useBreakpoint();
  const [listWidth, setListWidth] = useState(0);
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
  if (!city)
    return (
      <EmptyState icon="globe" title={t('explore.noCities')} body={t('explore.noCitiesBody')} />
    );

  const [south, west, north, east] = city.bbox;
  const openAttraction = (id: string) =>
    router.push({ pathname: '/attraction/[id]', params: { id } });
  const openChecklist = () =>
    router.push({ pathname: '/checklist/[city]', params: { city: city.slug } });

  const inner = { maxWidth: layout.wide + gutter * 2, paddingHorizontal: gutter };
  const itemWidth = listWidth
    ? (Math.min(listWidth, layout.wide + gutter * 2) - gutter * 2 - GRID_GAP * (columns - 1)) /
      columns
    : undefined;
  const count = attractions.isPending
    ? t('common.loading')
    : t('explore.placesCount', { count: attractions.data?.length ?? 0 });

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safe, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: theme.surface, borderColor: theme.border, boxShadow: shadows.card },
        ]}>
        <View style={[styles.inner, inner, styles.headerRow]}>
          <View style={styles.search}>
            <CitySwitcher cities={cities.data} current={city} onSelect={setCity} />
          </View>
          {isTablet ? (
            <Button
              compact
              variant="secondary"
              icon="checklist"
              label={t('checklist.open')}
              onPress={openChecklist}
              testID="open-checklist"
            />
          ) : (
            <IconButton
              icon="checklist"
              variant="outlined"
              accessibilityLabel={t('checklist.open')}
              onPress={openChecklist}
              testID="open-checklist"
            />
          )}
        </View>
        <View style={[styles.inner, inner]}>
          <CategoryFilters
            selected={categories}
            onToggle={toggleCategory}
            onClear={clearCategories}
          />
        </View>
      </View>

      <View style={styles.body} onLayout={(e) => setListWidth(e.nativeEvent.layout.width)}>
        {attractions.isError ? (
          <ErrorState onRetry={() => attractions.refetch()} />
        ) : view === 'map' ? (
          <>
            <MapView
              testID="explore-map"
              accessibilityLabel={t('explore.mapLabel')}
              styleUrl={env.mapStyleUrl}
              bounds={[west, south, east, north]}
              points={points}
              onPointPress={openAttraction}
            />
            <View
              style={[styles.mapCount, { backgroundColor: theme.surface, boxShadow: shadows.card }]}
              pointerEvents="none">
              <Text variant="label" accessibilityLiveRegion="polite">
                {count}
              </Text>
            </View>
          </>
        ) : attractions.isPending ? (
          <LoadingState />
        ) : (
          <FlatList
            key={columns}
            testID="attraction-list"
            data={attractions.data}
            keyExtractor={(a) => a.id}
            numColumns={columns}
            columnWrapperStyle={columns > 1 ? { gap: GRID_GAP } : undefined}
            contentContainerStyle={[styles.inner, inner, styles.grid]}
            ListHeaderComponent={
              <Text variant="heading" accessibilityLiveRegion="polite">
                {count}
              </Text>
            }
            renderItem={({ item }) => (
              <View style={itemWidth ? { width: itemWidth } : styles.flex}>
                <AttractionCard
                  item={item}
                  order={stopOrder.get(item.id)}
                  onPress={() => openAttraction(item.id)}
                />
              </View>
            )}
            ListEmptyComponent={<EmptyState icon="search" title={t('explore.noResults')} />}
          />
        )}

        <View style={styles.floating} pointerEvents="box-none">
          <Segmented
            floating
            accessibilityLabel={t('explore.viewMode')}
            value={view}
            onChange={setView}
            options={[
              { value: 'map', label: t('explore.mapView'), icon: 'map' },
              { value: 'list', label: t('explore.listView'), icon: 'grid' },
            ]}
          />
          {routeStops.length > 0 ? (
            <View
              style={[
                styles.tray,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  boxShadow: shadows.raised,
                },
              ]}>
              <View
                style={[styles.trayIcon, { backgroundColor: theme.primarySoft }]}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants">
                <Text variant="subtitle" style={{ color: theme.primary }}>
                  {routeStops.length}
                </Text>
              </View>
              <Text variant="subtitle" style={styles.flex} accessibilityLiveRegion="polite">
                {t('route.trayCount', { count: routeStops.length })}
              </Text>
              <Button
                compact
                icon="route"
                label={t('route.build')}
                onPress={() => router.push('/route')}
                testID="open-route"
              />
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  inner: { width: '100%', alignSelf: 'center' },
  header: {
    paddingTop: spacing.md - 4,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 1,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md - 4 },
  search: { flex: 1, maxWidth: 560, flexDirection: 'row' },
  body: { flex: 1 },
  grid: { paddingTop: spacing.lg, paddingBottom: 160, gap: spacing.xl - 4 },
  mapCount: {
    position: 'absolute',
    top: spacing.md,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  floating: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    alignItems: 'center',
    gap: spacing.md - 4,
  },
  tray: {
    width: '100%',
    maxWidth: 560,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
    padding: spacing.md - 4,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  trayIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
