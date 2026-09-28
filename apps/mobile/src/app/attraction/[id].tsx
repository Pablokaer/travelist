import { ROUTE_MAX_STOPS } from '@wayfarer/shared';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/button';
import { Badge, StatTile } from '@/components/card';
import { categoryIcon } from '@/components/icon';
import { ListRow, RowGroup } from '@/components/list-row';
import { Screen, Section } from '@/components/screen';
import { ErrorState, LoadingState } from '@/components/states';
import { Text } from '@/components/text';
import { localizedName, useAttraction } from '@/features/destinations/api';
import { useRouteStore } from '@/features/route/store';
import { radius, spacing } from '@/theme/colors';
import { useTheme } from '@/theme/use-theme';

export default function AttractionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const attraction = useAttraction(id);
  const inRoute = useRouteStore((s) => s.stops.some((x) => x.id === id));
  const add = useRouteStore((s) => s.add);
  const remove = useRouteStore((s) => s.remove);
  const clear = useRouteStore((s) => s.clear);
  const [notice, setNotice] = useState<string | null>(null);

  if (attraction.isPending) return <LoadingState />;
  if (attraction.isError) return <ErrorState onRetry={() => attraction.refetch()} />;
  const a = attraction.data;
  const name = localizedName(a, lang);
  const description =
    lang === 'pt' ? (a.descriptionPt ?? a.descriptionEn) : (a.descriptionEn ?? a.descriptionPt);
  const wiki =
    lang === 'pt' && a.wikipediaPt
      ? { host: 'pt', title: a.wikipediaPt }
      : a.wikipediaEn
        ? { host: 'en', title: a.wikipediaEn }
        : a.wikipediaPt
          ? { host: 'pt', title: a.wikipediaPt }
          : null;
  const wikipediaUrl = wiki
    ? `https://${wiki.host}.wikipedia.org/wiki/${encodeURIComponent(wiki.title.replace(/ /g, '_'))}`
    : null;

  const toggleRoute = () => {
    setNotice(null);
    if (inRoute) return remove(a.id);
    if (!add(a)) {
      const stops = useRouteStore.getState().stops;
      if (stops.length >= ROUTE_MAX_STOPS) setNotice(t('route.full', { max: ROUTE_MAX_STOPS }));
      else {
        clear();
        add(a);
        setNotice(t('route.startedNewCity'));
      }
    }
  };

  const open = (url: string) => void WebBrowser.openBrowserAsync(url);
  const fee = a.fee
    ? a.fee === 'yes'
      ? t('attraction.feeYes')
      : a.fee === 'no'
        ? t('attraction.feeNo')
        : a.fee
    : null;

  return (
    <Screen
      edges={['left', 'right']}
      footer={
        <>
          <View style={styles.footerText}>
            <Text variant="subtitle">
              {t('attraction.visitMinutes', { minutes: a.avgVisitMinutes })}
            </Text>
            {notice ? (
              <Text variant="helper" secondary accessibilityLiveRegion="polite">
                {notice}
              </Text>
            ) : (
              <Text variant="helper" secondary numberOfLines={1}>
                {t('attraction.visitTime')}
              </Text>
            )}
          </View>
          <Button
            label={inRoute ? t('route.removeStop') : t('route.addStop')}
            variant={inRoute ? 'secondary' : 'primary'}
            onPress={toggleRoute}
            testID="toggle-route"
          />
        </>
      }>
      <Stack.Screen options={{ title: name }} />
      {a.imageUrl ? (
        <View style={styles.hero}>
          <Image
            source={a.imageUrl}
            style={styles.image}
            contentFit="cover"
            accessibilityLabel={t('attraction.photoOf', { name })}
            transition={200}
          />
          <Text variant="helper" secondary>
            {t('attraction.photoCredit', {
              author: a.imageAuthor ?? t('attraction.unknownAuthor'),
              license: a.imageLicense ?? '',
            })}
          </Text>
        </View>
      ) : null}

      <View style={styles.titleBlock}>
        <Text variant="display">{name}</Text>
        <View style={styles.badges}>
          <Badge icon={categoryIcon(a.category)} label={t(`category.${a.category}`)} />
          {a.isUnesco ? <Badge icon="globe" label={t('attraction.unesco')} /> : null}
        </View>
      </View>

      {description ? <Text style={styles.description}>{description}</Text> : null}

      <Divider />

      <Section title={t('attraction.details')}>
        <View style={styles.tiles}>
          <StatTile
            icon="clock"
            label={t('attraction.visitTime')}
            value={t('attraction.visitMinutes', { minutes: a.avgVisitMinutes })}
          />
          {fee ? <StatTile icon="ticket" label={t('attraction.fee')} value={fee} /> : null}
        </View>
        {/* Opening hours are free-form OSM strings, often too long for a tile. */}
        <RowGroup>
          <ListRow
            icon="calendar"
            label={t('attraction.openingHours')}
            value={a.openingHours ?? t('attraction.notAvailable')}
          />
        </RowGroup>
      </Section>

      {a.website || wikipediaUrl || a.imagePageUrl ? (
        <Section title={t('attraction.links')}>
          <RowGroup>
            {a.website ? (
              <ListRow
                icon="globe"
                role="link"
                external
                label={t('attraction.website')}
                onPress={() => open(a.website!)}
              />
            ) : null}
            {wikipediaUrl ? (
              <ListRow
                icon="info"
                role="link"
                external
                label={t('attraction.wikipedia')}
                onPress={() => open(wikipediaUrl)}
              />
            ) : null}
            {a.imagePageUrl ? (
              <ListRow
                icon="photo"
                role="link"
                external
                label={t('attraction.imageSource')}
                onPress={() => open(a.imagePageUrl!)}
              />
            ) : null}
          </RowGroup>
        </Section>
      ) : null}
      <Text variant="helper" secondary>
        {t('attraction.dataCredit')}
      </Text>
    </Screen>
  );
}

function Divider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

const styles = StyleSheet.create({
  hero: { gap: spacing.sm },
  image: { width: '100%', aspectRatio: 16 / 10, maxHeight: 460, borderRadius: radius.xl },
  titleBlock: { gap: spacing.md - 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  description: { fontSize: 17, lineHeight: 27 },
  divider: { height: StyleSheet.hairlineWidth },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md - 4 },
  footerText: { flex: 1, gap: spacing.xxs },
});
