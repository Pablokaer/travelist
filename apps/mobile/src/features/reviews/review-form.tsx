// Writing, editing and deleting the signed-in user's review (D-028).
import { zodResolver } from '@hookform/resolvers/zod';
import { REVIEW_COMMENT_MAX, reviewFormSchema, type ReviewForm as Form } from '@wayfarer/shared';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { FormError } from '@/features/auth/components';
import { StarRating } from '@/features/reviews/star-rating';
import { spacing } from '@/theme/colors';
import { useTheme } from '@/theme/use-theme';

type Props = {
  /** The user's current review, or null to write a new one. */
  initial: Form | null;
  onSave: (form: Form) => void;
  onDelete: () => void;
  saving?: boolean;
  deleting?: boolean;
  error?: string | null;
};

/** Inline "Delete your review?" confirmation, as for trips. */
function DeleteConfirm({
  onDelete,
  onCancel,
  deleting,
}: {
  onDelete: () => void;
  onCancel: () => void;
  deleting?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Card style={{ borderColor: theme.danger }}>
      <Text>{t('reviews.deleteConfirm')}</Text>
      <View style={styles.actions}>
        <Button
          variant="danger"
          label={t('reviews.deleteYes')}
          loading={deleting}
          onPress={onDelete}
        />
        <Button variant="ghost" label={t('common.cancel')} onPress={onCancel} />
      </View>
    </Card>
  );
}

/**
 * Star picker and optional comment; publishes a new review or updates the user's own.
 * @example <ReviewForm initial={null} onSave={save.mutate} onDelete={remove} />
 */
export function ReviewForm({ initial, onSave, onDelete, saving, deleting, error }: Props) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const { control, handleSubmit } = useForm<Form>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: initial ?? { rating: 0, comment: '' },
  });
  return (
    <Card testID="review-form">
      <Text variant="subtitle">
        {initial ? t('reviews.yourReviewTitle') : t('reviews.writeTitle')}
      </Text>
      <Controller
        control={control}
        name="rating"
        render={({ field, fieldState }) => (
          <View>
            <StarRating value={field.value} onChange={field.onChange} />
            <FormError
              message={fieldState.error?.message ? t(fieldState.error.message as never) : null}
            />
          </View>
        )}
      />
      <Controller
        control={control}
        name="comment"
        render={({ field, fieldState }) => (
          <TextField
            label={t('reviews.comment')}
            placeholder={t('reviews.commentPlaceholder')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            maxLength={REVIEW_COMMENT_MAX}
            multiline
            style={styles.comment}
          />
        )}
      />
      <FormError message={error ?? null} />
      <View style={styles.actions}>
        <Button
          label={initial ? t('reviews.update') : t('reviews.publish')}
          loading={saving}
          onPress={handleSubmit((form) => onSave(form))}
          testID="save-review"
        />
        {initial && !confirming ? (
          <Button
            variant="ghost"
            icon="trash"
            label={t('reviews.delete')}
            onPress={() => setConfirming(true)}
            testID="delete-review"
          />
        ) : null}
      </View>
      {confirming ? (
        <DeleteConfirm
          onDelete={onDelete}
          onCancel={() => setConfirming(false)}
          deleting={deleting}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  comment: { minHeight: 96, textAlignVertical: 'top' },
});
