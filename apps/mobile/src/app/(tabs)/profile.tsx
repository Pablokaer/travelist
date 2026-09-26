import { SUPPORTED_LANGUAGES } from '@wayfarer/shared';
import { router } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { spacing } from '@/theme/colors';

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();

  return (
    <Screen>
      <Text variant="title">{t('profile.title')}</Text>

      <Text variant="heading">{t('profile.language')}</Text>
      <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
        {SUPPORTED_LANGUAGES.map((lng) => (
          <ListRow
            key={lng}
            role="radio"
            label={t(`profile.languageName.${lng}`)}
            selected={i18n.resolvedLanguage === lng}
            onPress={() => void i18n.changeLanguage(lng)}
          />
        ))}
      </View>

      <ListRow role="link" label={t('profile.about')} onPress={() => router.push('/about')} />
    </Screen>
  );
}
