// Picks a city the app has by name (D-085): where a planned trip starts from. Ported from the
// TravelisHachtoberfest fork without its "search the whole world" part, which needed the fork's
// local city-builder service.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ListRow } from '@/components/list-row';
import { SearchField } from '@/components/search-field';
import { cityName, countryOf, type City } from '@/features/destinations/api';
import { searchCities } from '@/features/destinations/search';
import { spacing } from '@/theme/colors';

/** Matches shown at once; typing narrows the rest. */
const MAX_MATCHES = 6;

type Props = {
  cities: City[];
  onChoose: (slug: string) => void;
};

/**
 * @example <CityChooser cities={cities} onChoose={chooseCity} />
 */
export function CityChooser({ cities, onChoose }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const [query, setQuery] = useState('');
  const matches = searchCities(cities, query, lang).slice(0, MAX_MATCHES);
  return (
    <View style={styles.box}>
      <SearchField value={query} onChangeText={setQuery} label={t('plan.searchCity')} />
      {matches.map((city) => (
        <ListRow
          key={city.slug}
          label={cityName(city, lang)}
          value={countryOf(city, lang)}
          onPress={() => onChoose(city.slug)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ box: { gap: spacing.sm } });
