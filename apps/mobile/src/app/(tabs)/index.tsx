import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { useGutter } from '@/components/screen';
import { Segmented } from '@/components/segmented';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Text } from '@/components/text';
import {
  useAttractions,
  useCities,
  type AttractionSummary,
  type City,
} from '@/features/destinations/api';
import { AttractionSearch } from '@/features/destinations/attraction-search';
import { AttractionCard } from '@/features/destinations/components';
import { ExploreHeader } from '@/features/destinations/explore-header';
import { searchAttractions } from '@/features/destinations/search';
import { useExploreStore } from '@/features/destinations/store';
import { MapView } from '@/features/map/map-view';
import { routeNotice } from '@/features/route/notice';
import { useRouteStore } from '@/features/route/store';
import { env } from '@/lib/env';
import { categoryColors, layout, radius, spacing } from '@/theme/colors';
import { gridColumns, gridItemWidth } from '@/theme/grid';
import { useShadows, useTheme } from '@/theme/use-theme';

const GRID_GAP = spacing.lg;
/** Cards stay at least this wide; the column count follows the space the grid really has. */
const CARD_MIN_WIDTH = 240;

const cityLabel = (city: City, lang: string) => (lang === 'pt' ? city.namePt : city.nameEn);

export default function ExploreScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const shadows = useShadows();
  const gutter = useGutter();
  const [listWidth, setListWidth] = useState(0);
  const cities = useCities();
  const { citySlug, setCity, categories, toggleCategory, clearCategories, view, setView } =
    useExploreStore();
  const routeStops = useRouteStore((s) => s.stops);
  const toggleStop = useRouteStore((s) => s.toggle);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const routeCity = useRouteStore((s) => s.citySlug);

  const city = cities.data?.find((c) => c.slug === citySlug) ?? cities.data?.[0];
  useEffect(() => {
    if (!citySlug && cities.data?.[0]) setCity(routeCity ?? cities.data[0].slug);
  }, [citySlug, cities.data, routeCity, setCity]);

  const attractions = useAttractions(city, categories);
  const lang = i18n.resolvedLanguage ?? 'en';
  // The grid and the map show every match of the search; the dropdown only the best few.
  const visible = useMemo(
    () =>
      query.trim()
        ? searchAttractions(attractions.data ?? [], query, lang)
        : (attractions.data ?? []),
    [attractions.data, query, lang],
  );
  const stopOrder = useMemo(() => new Map(routeStops.map((s, i) => [s.id, i + 1])), [routeStops]);
  const points = useMemo(
    () =>
      visible.map((a) => ({
        id: a.id,
        lat: a.lat,
        lng: a.lng,
        color: categoryColors[a.category] ?? categoryColors.other!,
        selected: stopOrder.has(a.id),
        order: stopOrder.get(a.id),
      })),
    [visible, stopOrder],
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
  const toggleWithNotice = (item: AttractionSummary) => setNotice(routeNotice(toggleStop(item), t));
  const selectCity = (slug: string) => {
    setQuery('');
    setCity(slug);
  };
  const openChecklist = () =>
    router.push({ pathname: '/checklist/[city]', params: { city: city.slug } });

  // One container for the header and the grid, so both start and end on the same lines.
  const inner = { maxWidth: layout.page + gutter * 2, paddingHorizontal: gutter };
  const gridWidth = Math.min(listWidth, layout.page + gutter * 2) - gutter * 2;
  const columns = gridColumns(gridWidth, CARD_MIN_WIDTH, GRID_GAP);
  const itemWidth = listWidth ? gridItemWidth(gridWidth, columns, GRID_GAP) : undefined;
  const count = attractions.isPending
    ? t('common.loading')
    : t('explore.placesCount', { count: visible.length });

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safe, { backgroundColor: theme.background }]}>
      <ExploreHeader
        cities={cities.data}
        city={city}
        onSelectCity={selectCity}
        search={
          <AttractionSearch
            items={attractions.data ?? []}
            cityName={cityLabel(city, lang)}
            query={query}
            onQueryChange={setQuery}
            routeOrder={stopOrder}
            onToggle={toggleWithNotice}
            onOpen={(item) => openAttraction(item.id)}
          />
        }
        categories={categories}
        onToggleCategory={toggleCategory}
        onClearCategories={clearCategories}
        onOpenChecklist={openChecklist}
        container={inner}
        gutter={gutter}
      />

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
            data={visible}
            keyExtractor={(a) => a.id}
            numColumns={columns}
            columnWrapperStyle={columns > 1 ? { gap: GRID_GAP } : undefined}
            contentContainerStyle={[styles.inner, inner, styles.grid]}
            ItemSeparatorComponent={RowGap}
            ListHeaderComponentStyle={styles.listHeader}
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
                  onToggleRoute={() => toggleWithNotice(item)}
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
              <View style={styles.flex}>
                <Text variant="subtitle" accessibilityLiveRegion="polite">
                  {t('route.trayCount', { count: routeStops.length })}
                </Text>
                {notice ? (
                  <Text variant="helper" secondary accessibilityLiveRegion="polite">
                    {notice}
                  </Text>
                ) : null}
              </View>
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

/** Vertical space between card rows (FlatList puts it between rows, not after the header). */
function RowGap() {
  return <View style={styles.rowGap} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  inner: { width: '100%', alignSelf: 'center' },
  body: { flex: 1 },
  // Bottom room for the floating Map/List switch and route tray.
  grid: { paddingTop: spacing.lg, paddingBottom: 160 },
  listHeader: { marginBottom: spacing.md },
  rowGap: { height: spacing.xl },
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
