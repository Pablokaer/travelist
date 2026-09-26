import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/screen';
import { Text } from '@/components/text';

export default function TripsScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <Text variant="title">{t('trips.title')}</Text>
      <Text secondary>{t('trips.empty')}</Text>
    </Screen>
  );
}
