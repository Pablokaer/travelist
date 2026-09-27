import Constants from 'expo-constants';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { spacing } from '@/theme/colors';

const SOURCES = [
  'osm',
  'wikidata',
  'commons',
  'pageviews',
  'openfreemap',
  'ors',
  'openMeteo',
  'passportIndex',
  'canada',
  'fx',
] as const;

export default function AboutScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <Text>{t('about.body')}</Text>
      <Text variant="heading">{t('about.dataSources')}</Text>
      <View style={{ gap: spacing.sm }}>
        {SOURCES.map((key) => (
          <Text key={key} secondary>
            • {t(`about.sources.${key}`)}
          </Text>
        ))}
      </View>
      <Text variant="caption" secondary>
        {t('about.version', { version: Constants.expoConfig?.version ?? '0.0.0' })}
      </Text>
    </Screen>
  );
}
