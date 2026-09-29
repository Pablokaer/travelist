import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/button';
import { Screen, Section } from '@/components/screen';
import { ErrorState, LoadingState } from '@/components/states';
import { Text } from '@/components/text';
import { BeforeYouGoSection } from '@/features/checklist/before-you-go-section';
import { cityName, useCities, type City } from '@/features/destinations/api';
import { useCityAbout } from '@/features/destinations/city-about-api';
import { CityHero } from '@/features/destinations/city-hero';
import { CityNotFound } from '@/features/destinations/city-not-found';
import { ReviewsSection } from '@/features/reviews/reviews-section';
import { CityWalklistsSection } from '@/features/trips/city-walklists-section';
import { spacing } from '@/theme/colors';

/**
 * City page (`/short/[slug]`, D-033): the hub of a city, opened from its card on the Home —
 * photo, rating, About, community and official walk lists, Before you go and reviews.
 * "Explore attractions" opens the Map / List page (`/city/[slug]`).
 */
export default function CityHubScreen() {
  const { t, i18n } = useTranslation();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const cities = useCities();
  const city = cities.data?.find((c) => c.slug === slug);

  if (cities.isPending) return <LoadingState />;
  if (cities.isError) return <ErrorState onRetry={() => cities.refetch()} />;
  if (!city) return <CityNotFound />;
  const openAttractions = () =>
    router.push({ pathname: '/city/[slug]', params: { slug: city.slug } });
  return (
    <Screen edges={['left', 'right']} width="wide">
      <Stack.Screen
        options={{ headerShown: true, title: cityName(city, i18n.resolvedLanguage ?? 'en') }}
      />
      <CityHero city={city} onExplore={openAttractions} />
      <AboutSection city={city} />
      <CityWalklistsSection city={city} kind="community" />
      <CityWalklistsSection city={city} kind="official" />
      <BeforeYouGoSection citySlug={city.slug} />
      <ReviewsSection target={{ kind: 'city', id: city.slug }} />
      <Text variant="helper" secondary>
        {t('attraction.dataCredit')}
      </Text>
    </Screen>
  );
}

function AboutSection({ city }: { city: City }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const about = useCityAbout(city.slug, lang);
  const source = about.data?.sourceUrl;
  return (
    <Section title={t('cityHub.about', { city: cityName(city, lang) })}>
      {about.isPending ? <LoadingState /> : null}
      {about.data?.summary ? (
        <Text style={styles.summary}>{about.data.summary}</Text>
      ) : about.isPending ? null : (
        <Text secondary>{t('cityHub.noAbout')}</Text>
      )}
      {about.data?.summary ? (
        <View style={styles.source}>
          <Text variant="helper" secondary>
            {t('cityHub.aboutSource')}
          </Text>
          {source ? (
            <Button
              compact
              variant="ghost"
              icon="external"
              label={t('cityHub.readMore')}
              accessibilityRole="link"
              onPress={() => void WebBrowser.openBrowserAsync(source)}
            />
          ) : null}
        </View>
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  summary: { fontSize: 17, lineHeight: 27 },
  source: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
});
