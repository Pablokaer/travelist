// Attraction photos: the image, its placeholder when there is none, and small thumbnails.
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { useTheme } from '@/theme/use-theme';

// Commons thumbnail URLs end in /<width>px-<file>; the pipeline stores the 960 px one.
const COMMONS_THUMB = /^(https:\/\/[^/]*wikimedia\.org\/.+\/thumb\/.+\/)\d+px-([^/?]+)/;

/**
 * The same Wikimedia Commons photo at a smaller standard width (map markers load dozens at
 * once); other URLs are returned unchanged.
 * @example thumbnailUrl('…/thumb/b/b5/X.jpg/960px-X.jpg', 120) // '…/thumb/b/b5/X.jpg/120px-X.jpg'
 */
export function thumbnailUrl(url: string | null, width: number): string | null {
  if (!url) return null;
  return url.replace(COMMONS_THUMB, `$1${width}px-$2`);
}

/** Photo, or a neutral placeholder with a photo glyph when there is none. */
export function Thumbnail({
  uri,
  style,
  iconSize = 28,
  testID,
}: {
  uri: string | null;
  style: object;
  iconSize?: number;
  testID?: string;
}) {
  const theme = useTheme();
  return uri ? (
    <Image
      source={uri}
      style={style}
      contentFit="cover"
      accessible={false}
      transition={200}
      testID={testID}
    />
  ) : (
    <View
      style={[style, styles.placeholder, { backgroundColor: theme.surfaceMuted }]}
      testID={testID && `${testID}-placeholder`}>
      <Icon name="photo" size={iconSize} color={theme.textSecondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center' },
});
