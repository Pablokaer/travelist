import type { AttractionCategory } from '@wayfarer/shared';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { City } from './api';
import { CategoryFilters, CitySwitcher } from './components';

import { BrandMark } from '@/components/app-menu';
import { Button, IconButton } from '@/components/button';
import { spacing } from '@/theme/colors';
import { useBreakpoint, useShadows, useTheme } from '@/theme/use-theme';

/**
 * Logo and action slots of the single-row header. Both get the same width so the search group
 * sits on the page's centre line; wide enough for "Before you go" / "Antes de partir".
 */
const SIDE_MIN_WIDTH = 168;
const CITY_PILL_WIDTH = 220;
/** City pill + search stay a compact, centred group instead of stretching to the page. */
const SEARCH_GROUP_MAX_WIDTH = 640;
/** Below this the search placeholder ("Pesquisar locais em …") would be cut off. */
const SEARCH_GROUP_MIN_WIDTH = 580;
/** Content width from which logo, city + search and the action share one row. */
export const INLINE_HEADER_MIN_WIDTH = 2 * SIDE_MIN_WIDTH + 2 * spacing.md + SEARCH_GROUP_MIN_WIDTH;

type Props = {
  cities: City[];
  city: City;
  onSelectCity: (slug: string) => void;
  /** The attraction search field (owns its query and dropdown). */
  search: ReactNode;
  categories: AttractionCategory[];
  onToggleCategory: (c: AttractionCategory) => void;
  onClearCategories: () => void;
  onOpenChecklist: () => void;
  /** Page container (max width + gutter) shared with the grid below. */
  container: ViewStyle;
  gutter: number;
};

type Slots = { city: ReactNode; search: ReactNode; action: ReactNode };

/**
 * Explore header: [logo] [city + search] [Before you go], then the category tabs. When the
 * content is wide enough the first three share one row; narrower tablets and desktops put
 * city + search on a second row; phones keep the city next to the logo and the search below.
 * @example <ExploreHeader {...props} search={<AttractionSearch … />} />
 */
export function ExploreHeader(props: Props) {
  const theme = useTheme();
  const shadows = useShadows();
  const [contentWidth, setContentWidth] = useState(0);
  return (
    <View
      style={[
        styles.header,
        { backgroundColor: theme.surface, borderColor: theme.border, boxShadow: shadows.card },
      ]}>
      <View
        style={[styles.container, props.container]}
        testID="explore-header-container"
        onLayout={(e) => setContentWidth(e.nativeEvent.layout.width - 2 * props.gutter)}>
        <HeaderRows {...props} inline={contentWidth >= INLINE_HEADER_MIN_WIDTH} />
      </View>
      <CategoryFilters
        selected={props.categories}
        onToggle={props.onToggleCategory}
        onClear={props.onClearCategories}
        inset={props.gutter}
      />
    </View>
  );
}

function HeaderRows(props: Props & { inline: boolean }) {
  const { isTablet } = useBreakpoint();
  const slots: Slots = {
    city: <CitySwitcher cities={props.cities} current={props.city} onSelect={props.onSelectCity} />,
    search: props.search,
    action: <ChecklistAction compact={!isTablet} onPress={props.onOpenChecklist} />,
  };
  if (!isTablet) return <PhoneRows {...slots} />;
  return props.inline ? <InlineRow {...slots} /> : <StackedRows {...slots} />;
}

function InlineRow({ city, search, action }: Slots) {
  return (
    <View style={styles.row} testID="explore-header-inline">
      <View style={styles.side}>
        <BrandMark withName />
      </View>
      <SearchGroup city={city} search={search} />
      <View style={[styles.side, styles.end]}>{action}</View>
    </View>
  );
}

function StackedRows({ city, search, action }: Slots) {
  return (
    <>
      <View style={[styles.row, styles.spread]} testID="explore-header-stacked">
        <BrandMark withName />
        {action}
      </View>
      <SearchGroup city={city} search={search} />
    </>
  );
}

function PhoneRows({ city, search, action }: Slots) {
  return (
    <>
      <View style={styles.row}>
        <BrandMark />
        <View style={styles.cityFill}>{city}</View>
        {action}
      </View>
      <View style={styles.searchRow}>{search}</View>
    </>
  );
}

/** City pill and place search side by side, centred in the header. */
function SearchGroup({ city, search }: { city: ReactNode; search: ReactNode }) {
  return (
    <View style={[styles.row, styles.group]}>
      <View style={styles.cityPill}>{city}</View>
      <View style={styles.searchFill}>{search}</View>
    </View>
  );
}

function ChecklistAction({ compact, onPress }: { compact: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  return compact ? (
    <IconButton
      icon="checklist"
      variant="outlined"
      accessibilityLabel={t('checklist.open')}
      onPress={onPress}
      testID="open-checklist"
    />
  ) : (
    <Button
      compact
      variant="secondary"
      icon="checklist"
      label={t('checklist.open')}
      onPress={onPress}
      testID="open-checklist"
    />
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 1,
  },
  // Above the category tabs so the search dropdown opens over them.
  container: { width: '100%', alignSelf: 'center', gap: spacing.md, zIndex: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  spread: { justifyContent: 'space-between' },
  // Equal-width sides keep the search group centred on the page, not between logo and action.
  side: {
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 0,
    minWidth: SIDE_MIN_WIDTH,
    flexDirection: 'row',
  },
  end: { justifyContent: 'flex-end' },
  // In the single row, maxWidth caps the basis and the sides share what is left.
  group: {
    flexShrink: 1,
    maxWidth: SEARCH_GROUP_MAX_WIDTH,
    width: '100%',
    alignSelf: 'center',
    gap: spacing.sm,
  },
  cityPill: { width: CITY_PILL_WIDTH, flexDirection: 'row' },
  searchRow: { zIndex: 10 },
  // The city pill grows along a row; the search field stretches across a column.
  cityFill: { flex: 1, flexDirection: 'row' },
  searchFill: { flex: 1 },
});
