export const palette = {
  light: {
    text: '#11181C',
    textSecondary: '#5B6670',
    background: '#FFFFFF',
    surface: '#F2F4F7',
    border: '#D9DEE3',
    primary: '#0B6E99',
    onPrimary: '#FFFFFF',
    danger: '#B42318',
  },
  dark: {
    text: '#ECEDEE',
    textSecondary: '#A3AEB8',
    background: '#0F1316',
    surface: '#1B2126',
    border: '#2E363D',
    primary: '#5CB8E4',
    onPrimary: '#06222F',
    danger: '#F97066',
  },
} as const;

export type ColorScheme = keyof typeof palette;
export type ThemeColors = { [K in keyof (typeof palette)['light']]: string };

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 20 } as const;
/** Minimum touch target (iOS HIG 44pt / Material 48dp). */
export const MIN_TOUCH = 44;

/** Marker colours per attraction category (readable on light and dark map styles). */
export const categoryColors: Record<string, string> = {
  museum: '#7C3AED',
  monument: '#B45309',
  church: '#0E7490',
  castle: '#9F1239',
  viewpoint: '#15803D',
  landmark: '#1D4ED8',
  park: '#4D7C0F',
  palace: '#C2410C',
  other: '#475569',
};
