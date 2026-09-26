import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './text';

import { MIN_TOUCH, radius, spacing } from '@/theme/colors';
import { useTheme } from '@/theme/use-theme';

type Props = {
  label: string;
  value?: string;
  selected?: boolean;
  onPress?: () => void;
  accessibilityHint?: string;
  role?: 'button' | 'radio' | 'link';
};

export function ListRow({
  label,
  value,
  selected,
  onPress,
  accessibilityHint,
  role = 'button',
}: Props) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={role}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityHint={accessibilityHint}
      accessibilityState={role === 'radio' ? { checked: !!selected } : undefined}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.surface,
          borderColor: selected ? theme.primary : theme.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.right}>
        {value ? <Text secondary>{value}</Text> : null}
        {role === 'radio' ? (
          <View
            style={[styles.radio, { borderColor: selected ? theme.primary : theme.border }]}
            importantForAccessibility="no">
            {selected ? <View style={[styles.dot, { backgroundColor: theme.primary }]} /> : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TOUCH + 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: { flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
