import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing } from '@/theme/colors';
import { useTheme } from '@/theme/use-theme';

const MAX_CONTENT_WIDTH = 720;

export function Screen({ children, scroll = true }: PropsWithChildren<{ scroll?: boolean }>) {
  const theme = useTheme();
  const content = <View style={styles.content}>{children}</View>;
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safe, { backgroundColor: theme.background }]}>
      {scroll ? <ScrollView contentContainerStyle={styles.scroll}>{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
});
