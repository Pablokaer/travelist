import { ROUTE_MAX_STOPS } from '@wayfarer/shared';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/button';
import { ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { ErrorState, LoadingState } from '@/components/states';
import { Text } from '@/components/text';
import { localizedName, useAttraction } from '@/features/destinations/api';
import { CategoryDot } from '@/features/destinations/components';
import { useRouteStore } from '@/features/route/store';
import { radius, spacing } from '@/theme/colors';

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

  return (
    <Screen>
      <Stack.Screen options={{ title: name }} />
      {a.imageUrl ? (
        <View style={{ gap: spacing.xs }}>
          <Image
            source={a.imageUrl}
            style={styles.image}
            contentFit="cover"
            accessibilityLabel={t('attraction.photoOf', { name })}
            transition={200}
          />
          <Text variant="caption" secondary>
            {t('attraction.photoCredit', {
              author: a.imageAuthor ?? t('attraction.unknownAuthor'),
              license: a.imageLicense ?? '',
            })}
          </Text>
        </View>
      ) : null}
      <Text variant="title">{name}</Text>
      <View style={styles.meta}>
        <CategoryDot category={a.category} />
        <Text secondary>
          {t(`category.${a.category}`)}
          {a.isUnesco ? ` · ${t('attraction.unesco')}` : ''}
        </Text>
      </View>
      {description ? <Text>{description}</Text> : null}

      <Button
        label={inRoute ? t('route.removeStop') : t('route.addStop')}
        variant={inRoute ? 'secondary' : 'primary'}
        onPress={toggleRoute}
        testID="toggle-route"
      />
      {notice ? (
        <Text variant="caption" secondary accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <ListRow
          label={t('attraction.visitTime')}
          value={t('attraction.visitMinutes', { minutes: a.avgVisitMinutes })}
        />
        <ListRow
          label={t('attraction.openingHours')}
          value={a.openingHours ?? t('attraction.notAvailable')}
        />
        {a.fee ? (
          <ListRow
            label={t('attraction.fee')}
            value={
              a.fee === 'yes'
                ? t('attraction.feeYes')
                : a.fee === 'no'
                  ? t('attraction.feeNo')
                  : a.fee
            }
          />
        ) : null}
        {a.website ? (
          <ListRow role="link" label={t('attraction.website')} onPress={() => open(a.website!)} />
        ) : null}
        {wikipediaUrl ? (
          <ListRow
            role="link"
            label={t('attraction.wikipedia')}
            onPress={() => open(wikipediaUrl)}
          />
        ) : null}
        {a.imagePageUrl ? (
          <ListRow
            role="link"
            label={t('attraction.imageSource')}
            onPress={() => open(a.imagePageUrl!)}
          />
        ) : null}
      </View>
      <Text variant="caption" secondary>
        {t('attraction.dataCredit')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', aspectRatio: 16 / 10, borderRadius: radius.lg },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
