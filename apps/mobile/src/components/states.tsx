import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from './button';
import { Text } from './text';

import { spacing } from '@/theme/colors';
import { useTheme } from '@/theme/use-theme';

export function LoadingState({ label }: { label?: string }) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View
      style={styles.center}
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? t('common.loading')}>
      <ActivityIndicator color={theme.primary} size="large" />
      <Text secondary>{label ?? t('common.loading')}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.center} accessibilityRole="alert">
      <Text style={styles.text}>{message ?? t('errors.generic')}</Text>
      {onRetry ? (
        <Button label={t('common.retry')} variant="secondary" compact onPress={onRetry} />
      ) : null}
    </View>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.center}>
      <Text variant="heading" style={styles.text}>
        {title}
      </Text>
      {body ? (
        <Text secondary style={styles.text}>
          {body}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  text: { textAlign: 'center' },
});
