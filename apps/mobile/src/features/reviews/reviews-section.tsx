// The Reviews section of an attraction (D-028): summary, the user's own review form and every
// published review, newest first.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Section } from '@/components/screen';
import { LoadingState } from '@/components/states';
import { Text } from '@/components/text';
import {
  useAttractionReviews,
  useDeleteReview,
  useRatingSummary,
  useSaveReview,
  type Review,
} from '@/features/reviews/api';
import { RatingSummaryLine, ReviewCard } from '@/features/reviews/components';
import { ReviewForm } from '@/features/reviews/review-form';
import { spacing } from '@/theme/colors';
import { useTheme } from '@/theme/use-theme';

/** The signed-in user's review form, wired to save and delete. */
function OwnReview({ attractionId, own }: { attractionId: string; own: Review | undefined }) {
  const { t } = useTranslation();
  const save = useSaveReview(attractionId);
  const remove = useDeleteReview(attractionId);
  const [saved, setSaved] = useState(false);
  const error = save.error ?? remove.error;
  return (
    <View style={styles.list}>
      <ReviewForm
        // Remounts with the server's values once a review is published, edited or deleted.
        key={own ? `${own.id}:${own.updatedAt}` : 'new'}
        initial={own ? { rating: own.rating, comment: own.comment ?? '' } : null}
        onSave={(form) => save.mutate(form, { onSuccess: () => setSaved(true) })}
        onDelete={() => own && remove.mutate(own.id, { onSuccess: () => setSaved(false) })}
        saving={save.isPending}
        deleting={remove.isPending}
        error={error ? t('errors.generic') : null}
      />
      {saved && own ? (
        <Text variant="helper" secondary accessibilityLiveRegion="polite">
          {t('reviews.saved')}
        </Text>
      ) : null}
    </View>
  );
}

/** Every review, separated by hairlines, or an invitation to write the first one. */
function ReviewList({ reviews }: { reviews: Review[] }) {
  const { t } = useTranslation();
  const theme = useTheme();
  if (reviews.length === 0) {
    return <Text secondary>{t('reviews.noneBody')}</Text>;
  }
  return (
    <View>
      {reviews.map((review, i) => (
        <View
          key={review.id}
          style={i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border }}>
          <ReviewCard review={review} />
        </View>
      ))}
    </View>
  );
}

/**
 * Reviews of one attraction: average and count, the user's review form, then the list.
 * @example <ReviewsSection attractionId={attraction.id} />
 */
export function ReviewsSection({ attractionId }: { attractionId: string }) {
  const { t } = useTranslation();
  const reviews = useAttractionReviews(attractionId);
  const summary = useRatingSummary(attractionId);
  const own = reviews.data?.find((r) => r.isOwn);
  return (
    <Section title={t('reviews.title')}>
      {summary.data ? <RatingSummaryLine summary={summary.data} variant="heading" /> : null}
      <OwnReview attractionId={attractionId} own={own} />
      {reviews.isPending ? <LoadingState /> : null}
      {reviews.error ? <Text secondary>{t('reviews.error')}</Text> : null}
      {reviews.data ? <ReviewList reviews={reviews.data} /> : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.xs },
});
