import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { radius, spacing } from '@/theme/colors';
import { useTheme } from '@/theme/use-theme';

export default function ExploreScreen() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Screen>
      <Text variant="title">{t('explore.title')}</Text>
      <Text secondary>{t('explore.subtitle')}</Text>
      <View
        testID="map-placeholder"
        style={[styles.placeholder, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text secondary style={styles.center}>
          {t('explore.mapPlaceholder')}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    minHeight: 280,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  center: { textAlign: 'center' },
});
