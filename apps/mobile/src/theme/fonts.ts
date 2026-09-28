import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import type { TextStyle } from 'react-native';

export const fontAssets = { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold };

/**
 * Custom fonts ship one family per weight, so a `fontWeight` is mapped to the matching Inter
 * family (and dropped, so Android doesn't synthesise a second bold).
 */
export function fontFamilyFor(weight: TextStyle['fontWeight']): string {
  switch (String(weight ?? '400')) {
    case '500':
      return 'Inter_500Medium';
    case '600':
      return 'Inter_600SemiBold';
    case '700':
    case '800':
    case '900':
    case 'bold':
      return 'Inter_700Bold';
    default:
      return 'Inter_400Regular';
  }
}
