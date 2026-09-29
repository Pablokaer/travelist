import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { PageHeader, useGutter } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Tappable } from '@/components/tappable';
import { Text } from '@/components/text';
import { useCities, type City } from '@/features/destinations/api';
import { useProfile } from '@/features/profile/api';
import { useTrips, type TripSummary } from '@/features/trips/api';
import { visibilityBadge } from '@/features/trips/visibility-editor';
import { flagEmoji, formatDate, formatDistance, formatDuration } from '@/lib/format';
import { layout, radius, spacing } from '@/theme/colors';
import { useBreakpoint, useShadows, useTheme } from '@/theme/use-theme';

const GRID_GAP = spacing.lg;

export default function TripsScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const gutter = useGutter();
  const { columns } = useBreakpoint();
  const [listWidth, setListWidth] = useState(0);
  const trips = useTrips();
  const cities = useCities();
  const lang = i18n.resolvedLanguage ?? 'en';
  const cols = Math.min(columns, 3);
  const inner = { maxWidth: layout.wide + gutter * 2, paddingHorizontal: gutter };
  const itemWidth = listWidth
    ? (Math.min(listWidth, layout.wide + gutter * 2) - gutter * 2 - GRID_GAP * (cols - 1)) / cols
    : undefined;

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safe, { backgroundColor: theme.background }]}
      onLayout={(e) => setListWidth(e.nativeEvent.layout.width)}>
      {trips.isPending ? (
        <LoadingState />
      ) : trips.isError ? (
        <ErrorState onRetry={() => trips.refetch()} />
      ) : (
        <FlatList
          key={cols}
          data={trips.data}
          keyExtractor={(trip) => trip.id}
          numColumns={cols}
          columnWrapperStyle={cols > 1 ? { gap: GRID_GAP } : undefined}
          contentContainerStyle={[styles.list, inner]}
          refreshing={trips.isRefetching}
          onRefresh={() => trips.refetch()}
          ListHeaderComponent={
            <PageHeader title={t('trips.title')} subtitle={t('trips.subtitle')} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="luggage"
              title={t('trips.emptyTitle')}
              body={t('trips.empty')}
              action={
                <Button
                  icon="map"
                  label={t('trips.explore')}
                  onPress={() => router.navigate('/')}
                />
              }
            />
          }
          renderItem={({ item }) => (
            <View style={itemWidth ? { width: itemWidth } : styles.flex}>
              <TripCard
                trip={item}
                city={cities.data?.find((c) => c.slug === item.citySlug)}
                lang={lang}
              />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function TripCard({ trip, city, lang }: { trip: TripSummary; city?: City; lang: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const shadows = useShadows();
  const profile = useProfile();
  const units = profile.data?.units ?? 'metric';
  const cityName = city ? (lang === 'pt' ? city.namePt : city.nameEn) : trip.citySlug;

  const meta: { icon: IconName; label: string }[] = [
    { icon: 'pin', label: t('trips.stops', { count: trip.stopCount }) },
  ];
  if (trip.distanceM != null)
    meta.push({ icon: 'route', label: formatDistance(trip.distanceM, units, lang) });
  if (trip.walkingSeconds != null)
    meta.push({
      icon: 'walk',
      label: t('trips.walk', { duration: formatDuration(trip.walkingSeconds) }),
    });
  const badge = visibilityBadge(trip.visibility);
  if (badge) meta.push({ icon: badge.icon, label: t(badge.label as never) });

  return (
    <Tappable
      accessibilityRole="button"
      accessibilityLabel={`${trip.name}, ${cityName}`}
      onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })}
      pressScale={0.98}
      style={({ hovered }) => [
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          boxShadow: hovered ? shadows.raised : shadows.card,
        },
      ]}>
      <View style={[styles.cover, { backgroundColor: theme.surfaceMuted }]}>
        <Text style={styles.flag}>{city ? flagEmoji(city.countryCode) : '🧭'}</Text>
        <View style={styles.coverText}>
          <Text variant="label" secondary numberOfLines={1}>
            {cityName}
          </Text>
          {trip.tripDate ? (
            <Text variant="helper" secondary>
              {formatDate(trip.tripDate, lang)}
            </Text>
          ) : null}
        </View>
        <Icon name="chevronRight" size={16} color={theme.textSecondary} />
      </View>
      <View style={styles.body}>
        <Text variant="heading" numberOfLines={2}>
          {trip.name}
        </Text>
        <View style={styles.meta}>
          {meta.map((m) => (
            <View key={m.icon} style={styles.metaItem}>
              <Icon name={m.icon} size={14} color={theme.textSecondary} />
              <Text variant="caption" secondary>
                {m.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  list: {
    width: '100%',
    alignSelf: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: GRID_GAP,
    flexGrow: 1,
  },
  card: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cover: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
    padding: spacing.md,
  },
  flag: { fontSize: 28, lineHeight: 34 },
  coverText: { flex: 1 },
  body: { padding: spacing.md, paddingTop: spacing.md - 4, gap: spacing.sm },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.xs },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
