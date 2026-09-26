import { useColorScheme } from 'react-native';

import { palette, type ColorScheme, type ThemeColors } from './colors';

export function useColorSchemeName(): ColorScheme {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

export function useTheme(): ThemeColors {
  return palette[useColorSchemeName()];
}
