import { Pressable, StyleSheet } from 'react-native';

import { Text } from './text';

import { MIN_TOUCH, spacing } from '@/theme/colors';
import { useTheme } from '@/theme/use-theme';

type Props = { label: string; selected?: boolean; onPress?: () => void; onRemove?: () => void };

export function Chip({ label, selected, onPress, onRemove }: Props) {
  const theme = useTheme();
  const handler = onRemove ?? onPress;
  return (
    <Pressable
      onPress={handler}
      accessibilityRole={onRemove ? 'button' : 'checkbox'}
      accessibilityLabel={label}
      accessibilityState={onRemove ? undefined : { checked: !!selected }}
      hitSlop={6}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.primary : theme.surface,
          borderColor: selected ? theme.primary : theme.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}>
      <Text
        variant="caption"
        style={{ color: selected ? theme.onPrimary : theme.text, fontWeight: '600' }}>
        {onRemove ? `${label}  ✕` : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: MIN_TOUCH - 8,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
  },
});
