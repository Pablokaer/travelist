import { StyleSheet, View } from 'react-native';

import { Text } from './text';

import { initials } from '@/lib/format';
import { useTheme } from '@/theme/use-theme';

/**
 * Round avatar with up to two initials, inverted colours (profile, review authors).
 * @example <Avatar name="Ana Traveller" size={40} /> // "AT"
 */
export function Avatar({ name, size = 64 }: { name: string; size?: number }) {
  const theme = useTheme();
  return (
    <View
      aria-hidden
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.text },
      ]}>
      <Text variant={size >= 56 ? 'title' : 'label'} style={{ color: theme.background }}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
});
