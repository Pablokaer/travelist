import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { fontFamilyFor } from '@/theme/fonts';
import { useBreakpoint, useTheme } from '@/theme/use-theme';

function TabIcon({ name, color }: { name: IconName; color: string }) {
  return <Icon name={name} color={color} size={24} />;
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  // Desktop gets a side rail instead of a phone-style bottom bar.
  const { isDesktop } = useBreakpoint();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: isDesktop ? 'left' : 'bottom',
        tabBarVariant: isDesktop ? 'material' : 'uikit',
        // Label under the icon keeps the desktop rail narrow (side labels force a ~360px sidebar).
        tabBarLabelPosition: 'below-icon',
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelStyle: { fontFamily: fontFamilyFor('500'), fontSize: 12, lineHeight: 16 },
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          ...(isDesktop
            ? { borderRightWidth: StyleSheet.hairlineWidth, paddingTop: 24, width: 104 }
            : {
                // Each item adds 5px padding around a 28px icon box; the default 49pt bar
                // leaves Inter's 16px labels about 9px and clips them.
                borderTopWidth: StyleSheet.hairlineWidth,
                height: 68 + insets.bottom,
                paddingTop: 6,
                paddingBottom: 6 + insets.bottom,
              }),
        },
        sceneStyle: { backgroundColor: theme.background },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.explore'),
          tabBarIcon: ({ color }) => <TabIcon name="search" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: t('tabs.trips'),
          tabBarIcon: ({ color }) => <TabIcon name="luggage" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color }) => <TabIcon name="person" color={String(color)} />,
        }}
      />
    </Tabs>
  );
}
