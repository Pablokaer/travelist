import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme } from '@/theme/use-theme';

type Variant = 'title' | 'heading' | 'body' | 'caption';

export type TextProps = RNTextProps & { variant?: Variant; secondary?: boolean };

export function Text({ variant = 'body', secondary, style, ...rest }: TextProps) {
  const theme = useTheme();
  return (
    <RNText
      accessibilityRole={variant === 'title' || variant === 'heading' ? 'header' : undefined}
      style={[styles[variant], { color: secondary ? theme.textSecondary : theme.text }, style]}
      {...rest}
    />
  );
}

// Font sizes scale with the OS setting (allowFontScaling defaults to true).
const styles = StyleSheet.create({
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22 },
  caption: { fontSize: 13, lineHeight: 18 },
});
