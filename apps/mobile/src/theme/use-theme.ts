import { useColorScheme, useWindowDimensions } from 'react-native';

import { palette, shadows, type ColorScheme, type ThemeColors } from './colors';

export function useColorSchemeName(): ColorScheme {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

export function useTheme(): ThemeColors {
  return palette[useColorSchemeName()];
}

export function useShadows() {
  return shadows[useColorSchemeName()];
}

/** Breakpoints shared by every responsive layout (phone < 600 ≤ tablet < 1024 ≤ desktop). */
export function useBreakpoint() {
  const { width } = useWindowDimensions();
  return {
    width,
    isTablet: width >= 600,
    isDesktop: width >= 1024,
    /** Columns for card grids. */
    columns: width >= 1200 ? 4 : width >= 900 ? 3 : width >= 600 ? 2 : 1,
  };
}
