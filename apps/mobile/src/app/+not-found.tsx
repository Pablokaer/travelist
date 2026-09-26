import { Link, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useTheme } from '@/theme/use-theme';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: '404' }} />
      <Screen>
        <Text variant="heading">{t('errors.notFound')}</Text>
        <Link href="/" style={{ color: theme.primary, fontSize: 16, paddingVertical: 12 }}>
          {t('errors.goHome')}
        </Link>
      </Screen>
    </>
  );
}
