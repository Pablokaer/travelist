import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Text } from '@/components/text';
import { useCities } from '@/features/destinations/api';
import { useProfile } from '@/features/profile/api';
import { useTrips } from '@/features/trips/api';
import { formatDate, formatDistance, formatDuration } from '@/lib/format';
import { radius, spacing } from '@/theme/colors';
import { useTheme } from '@/theme/use-theme';

export default function TripsScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const trips = useTrips();
  const cities = useCities();
  const profile = useProfile();
  const lang = i18n.resolvedLanguage ?? 'en';
  const units = profile.data?.units ?? 'metric';
  const cityName = (slug: string) => {
    const c = cities.data?.find((x) => x.slug === slug);
    return c ? (lang === 'pt' ? c.namePt : c.nameEn) : slug;
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safe, { backgroundColor: theme.background }]}>
      <Text variant="title" style={styles.title}>
        {t('trips.title')}
      </Text>
      {trips.isPending ? (
        <LoadingState />
      ) : trips.isError ? (
        <ErrorState onRetry={() => trips.refetch()} />
      ) : (
        <FlatList
          data={trips.data}
          keyExtractor={(trip) => trip.id}
          contentContainerStyle={styles.list}
          refreshing={trips.isRefetching}
          onRefresh={() => trips.refetch()}
          ListEmptyComponent={
            <EmptyState
              title={t('trips.emptyTitle')}
              body={t('trips.empty')}
              action={<Button label={t('trips.explore')} onPress={() => router.navigate('/')} />}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${cityName(item.citySlug)}`}
              onPress={() => router.push({ pathname: '/trip/[id]', params: { id: item.id } })}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}>
              <Text variant="heading">{item.name}</Text>
              <Text secondary>
                {cityName(item.citySlug)}
                {item.tripDate ? ` · ${formatDate(item.tripDate, lang)}` : ''}
              </Text>
              <View style={styles.meta}>
                <Text variant="caption" secondary>
                  {t('trips.stops', { count: item.stopCount })}
                  {item.distanceM != null
                    ? ` · ${formatDistance(item.distanceM, units, lang)}`
                    : ''}
                  {item.walkingSeconds != null
                    ? ` · ${t('trips.walk', { duration: formatDuration(item.walkingSeconds) })}`
                    : ''}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  title: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  list: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs },
  meta: { flexDirection: 'row' },
});
