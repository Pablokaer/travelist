import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from './text';

import { layout, spacing } from '@/theme/colors';
import { useBreakpoint, useShadows, useTheme } from '@/theme/use-theme';

type Width = keyof typeof layout;

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  /** Pauses scrolling (e.g. while a list row is being dragged) without unmounting the ScrollView. */
  scrollEnabled?: boolean;
  /** Maximum content width: `form` for auth/forms, `content` for reading, `wide` for grids. */
  width?: Width;
  /** Sticky action bar pinned to the bottom (e.g. the main call to action). */
  footer?: ReactNode;
  /** Vertically centre short content (auth screens). */
  centered?: boolean;
  /** Screens under a stack header don't need the top safe-area inset. */
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}>;

/** Horizontal page gutter: tighter on phones, roomier on tablets and desktop. */
export function useGutter() {
  return useBreakpoint().isTablet ? spacing.xl : spacing.lg - 4;
}

export function Screen({
  children,
  scroll = true,
  scrollEnabled = true,
  width = 'content',
  footer,
  centered,
  edges = ['top', 'left', 'right'],
}: ScreenProps) {
  const theme = useTheme();
  const gutter = useGutter();
  const content = (
    <View
      style={[
        styles.content,
        { maxWidth: layout[width] + gutter * 2, paddingHorizontal: gutter },
        centered && styles.centered,
      ]}>
      {children}
    </View>
  );
  return (
    <SafeAreaView edges={edges} style={[styles.safe, { backgroundColor: theme.background }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          scrollEnabled={scrollEnabled}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          {content}
        </ScrollView>
      ) : (
        content
      )}
      {footer ? <FooterBar>{footer}</FooterBar> : null}
    </SafeAreaView>
  );
}

/** Bottom action bar with a hairline and soft shadow, respecting the home indicator. */
export function FooterBar({ children }: PropsWithChildren) {
  const theme = useTheme();
  const shadows = useShadows();
  const gutter = useGutter();
  return (
    <SafeAreaView
      edges={['bottom']}
      style={[
        styles.footer,
        { backgroundColor: theme.surface, borderColor: theme.border, boxShadow: shadows.card },
      ]}>
      <View
        style={[
          styles.footerInner,
          { maxWidth: layout.content + gutter * 2, paddingHorizontal: gutter },
        ]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

/** Page title block with optional subtitle, eyebrow and trailing action. */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  action,
  size = 'display',
}: {
  title: string;
  subtitle?: string | null;
  eyebrow?: ReactNode;
  action?: ReactNode;
  size?: 'display' | 'title';
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        {eyebrow}
        <Text variant={size}>{title}</Text>
        {subtitle ? <Text secondary>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

/** A titled group of content with consistent spacing between sections. */
export function Section({
  title,
  action,
  children,
  style,
}: PropsWithChildren<{ title?: string; action?: ReactNode; style?: ViewStyle }>) {
  return (
    <View style={[styles.section, style]}>
      {title || action ? (
        <View style={styles.sectionHeader}>
          {title ? (
            <Text variant="heading" style={styles.flex}>
              {title}
            </Text>
          ) : null}
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  centered: { justifyContent: 'center' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
  footerInner: {
    width: '100%',
    alignSelf: 'center',
    paddingVertical: spacing.md - 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  headerText: { flex: 1, gap: spacing.xs },
  section: { gap: spacing.md - 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
