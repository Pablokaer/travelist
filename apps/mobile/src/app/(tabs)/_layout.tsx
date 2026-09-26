import { Tabs } from 'expo-router/js-tabs';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme/use-theme';

function TabIcon({ name, color }: { name: SymbolViewProps['name']; color: string }) {
  return <SymbolView name={name} tintColor={color} size={24} />;
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.explore'),
          tabBarIcon: ({ color }) => (
            <TabIcon name={{ ios: 'map', android: 'map', web: 'map' }} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: t('tabs.trips'),
          tabBarIcon: ({ color }) => (
            <TabIcon
              name={{ ios: 'suitcase', android: 'luggage', web: 'luggage' }}
              color={String(color)}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color }) => (
            <TabIcon
              name={{ ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' }}
              color={String(color)}
            />
          ),
        }}
      />
    </Tabs>
  );
}
