// Why a request was refused by the plan (D-047) — from the caller's plan values — and the way
// to Premium.
import type { PlanLimit } from '@wayfarer/shared';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Text } from '@/components/text';
import { useMySubscription } from '@/features/subscription/api';
import { planName } from '@/features/subscription/plan-text';
import { spacing } from '@/theme/colors';

/**
 * @example <PlanLimitNotice limit="lists" />
 */
export function PlanLimitNotice({ limit, compact }: { limit: PlanLimit; compact?: boolean }) {
  const { t } = useTranslation();
  const subscription = useMySubscription();
  const plan = subscription.data?.plan;
  const name = plan ? planName(plan, t) : '';
  const message =
    limit === 'lists'
      ? t('plans.listsReached', { plan: name, count: plan?.rules.maxLists ?? 0 })
      : limit === 'items'
        ? t('plans.itemsReached', { plan: name, count: plan?.rules.maxItemsPerList ?? 0 })
        : t('plans.deleteLocked');
  return (
    <Card muted style={styles.card} testID={`plan-limit-${limit}`}>
      <Text accessibilityLiveRegion="polite">{message}</Text>
      <View style={styles.row}>
        <Button
          compact={compact}
          icon="sparkles"
          label={t('plans.upgradeCta')}
          onPress={() => router.push('/plans')}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  row: { flexDirection: 'row' },
});
