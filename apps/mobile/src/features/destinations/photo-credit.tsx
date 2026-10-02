// Credit over a cover photo (city cards, walk list cards): Commons images must be shown with
// their author and licence (docs/DATA_SOURCES.md).
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PhotoCover } from './api';

import { Text } from '@/components/text';
import { radius, spacing } from '@/theme/colors';

/**
 * Author and licence pill in the bottom-left corner of a photo; nothing when both are unknown.
 * The parent must be positioned (it is absolutely placed over the photo).
 * @example <View><Thumbnail uri={cover.url} style={s.photo} /><PhotoCredit cover={cover} /></View>
 */
export function PhotoCredit({ cover }: { cover: PhotoCover }) {
  const { t } = useTranslation();
  if (!cover.author && !cover.license) return null;
  return (
    <View style={styles.credit} pointerEvents="none">
      <Text variant="helper" numberOfLines={1} style={styles.creditText}>
        {t('home.photoCredit', { author: cover.author ?? '?', license: cover.license ?? '' })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Over the photo in both themes, so fixed light-on-dark colours rather than theme tokens.
  credit: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    maxWidth: '80%',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  creditText: { color: '#FFFFFF', fontSize: 11, lineHeight: 14 },
});
