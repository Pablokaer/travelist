import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { View } from 'react-native';

import { useTheme } from '@/theme/use-theme';

type SymbolName = Exclude<SymbolViewProps['name'], string>;

/** App icon set: SF Symbols on iOS, Material Symbols on Android and web. */
const ICONS = {
  add: { ios: 'plus', android: 'add', web: 'add' },
  arrowDown: { ios: 'arrow.down', android: 'arrow_downward', web: 'arrow_downward' },
  arrowUp: { ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' },
  calendar: { ios: 'calendar', android: 'calendar_today', web: 'calendar_today' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  checklist: { ios: 'checklist', android: 'checklist', web: 'checklist' },
  chevronDown: { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  clock: { ios: 'clock', android: 'schedule', web: 'schedule' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  directions: {
    ios: 'arrow.triangle.turn.up.right.diamond',
    android: 'directions',
    web: 'directions',
  },
  error: { ios: 'exclamationmark.circle', android: 'error', web: 'error' },
  external: { ios: 'arrow.up.right.square', android: 'open_in_new', web: 'open_in_new' },
  flag: { ios: 'flag', android: 'flag', web: 'flag' },
  globe: { ios: 'globe', android: 'language', web: 'language' },
  grid: { ios: 'square.grid.2x2', android: 'apps', web: 'apps' },
  home: { ios: 'house', android: 'home', web: 'home' },
  info: { ios: 'info.circle', android: 'info', web: 'info' },
  list: { ios: 'list.bullet', android: 'list', web: 'list' },
  logout: {
    ios: 'rectangle.portrait.and.arrow.right',
    android: 'logout',
    web: 'logout',
  },
  luggage: { ios: 'suitcase', android: 'luggage', web: 'luggage' },
  mail: { ios: 'envelope', android: 'mail', web: 'mail' },
  map: { ios: 'map', android: 'map', web: 'map' },
  passport: { ios: 'person.text.rectangle', android: 'badge', web: 'badge' },
  person: { ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' },
  photo: { ios: 'photo', android: 'image', web: 'image' },
  pin: { ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' },
  route: {
    ios: 'point.topleft.down.to.point.bottomright.curvepath',
    android: 'route',
    web: 'route',
  },
  ruler: { ios: 'ruler', android: 'straighten', web: 'straighten' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  sparkles: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  ticket: { ios: 'ticket', android: 'confirmation_number', web: 'confirmation_number' },
  trash: { ios: 'trash', android: 'delete', web: 'delete' },
  walk: { ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' },
  // Attraction categories
  museum: { ios: 'building.columns', android: 'museum', web: 'museum' },
  monument: { ios: 'flag.2.crossed', android: 'flag', web: 'flag' },
  church: { ios: 'bell', android: 'church', web: 'church' },
  castle: { ios: 'shield', android: 'castle', web: 'castle' },
  viewpoint: { ios: 'binoculars', android: 'landscape', web: 'landscape' },
  landmark: { ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' },
  park: { ios: 'leaf', android: 'park', web: 'park' },
  palace: { ios: 'crown', android: 'fort', web: 'fort' },
  other: { ios: 'ellipsis.circle', android: 'more_horiz', web: 'more_horiz' },
} satisfies Record<string, SymbolName>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 20,
  color,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const theme = useTheme();
  // Decorative: the web build renders symbols as font glyphs, so hide them from assistive tech.
  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}>
      <SymbolView name={ICONS[name]} size={size} tintColor={color ?? theme.text} />
    </View>
  );
}

export function categoryIcon(category: string): IconName {
  return category in ICONS ? (category as IconName) : 'other';
}
