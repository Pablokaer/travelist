import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from './text';

import { MIN_TOUCH, radius, spacing } from '@/theme/colors';
import { useTheme } from '@/theme/use-theme';

type Props = TextInputProps & {
  label: string;
  /** i18n key or plain message */
  error?: string;
  hint?: string;
};

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, error, hint, style, ...rest },
  ref,
) {
  const theme = useTheme();
  const { t } = useTranslation();
  const message = error ? t(error as never, { defaultValue: error }) : undefined;
  return (
    <View style={styles.wrap}>
      <Text variant="caption" style={styles.label}>
        {label}
      </Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.surface,
            borderColor: message ? theme.danger : theme.border,
          },
          style,
        ]}
        {...rest}
      />
      {message ? (
        <Text variant="caption" style={{ color: theme.danger }} accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : hint ? (
        <Text variant="caption" secondary>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { fontWeight: '600' },
  input: {
    minHeight: MIN_TOUCH + 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 16,
  },
});
