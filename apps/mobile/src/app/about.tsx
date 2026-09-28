import Constants from 'expo-constants';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Screen, Section } from '@/components/screen';
import { Text } from '@/components/text';
import { radius, spacing } from '@/theme/colors';
import { useTheme } from '@/theme/use-theme';

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
  const theme = useTheme();
  return (
    <Screen edges={['left', 'right']}>
      <View style={styles.hero}>
        <View style={[styles.logo, { backgroundColor: theme.primary }]}>
          <Icon name="map" size={28} color={theme.onPrimary} />
        </View>
        <Text variant="title">{t('common.appName')}</Text>
        <Text secondary style={styles.center}>
          {t('about.body')}
        </Text>
      </View>
      <Section title={t('about.dataSources')}>
        <Card style={styles.sources}>
          {SOURCES.map((key, i) => (
            <View
              key={key}
              style={[
                styles.source,
                i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
              ]}>
              <Icon name="check" size={16} color={theme.textSecondary} />
              <Text variant="caption" style={styles.flex}>
                {t(`about.sources.${key}`)}
              </Text>
            </View>
          ))}
        </Card>
      </Section>
      <Text variant="helper" secondary style={styles.center}>
        {t('about.version', { version: Constants.expoConfig?.version ?? '0.0.0' })}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  center: { textAlign: 'center', maxWidth: 420 },
  sources: { paddingVertical: 0, gap: 0 },
  source: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md - 4,
    paddingVertical: spacing.md - 4,
  },
  flex: { flex: 1 },
});
