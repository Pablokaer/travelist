import { ATTRACTION_CATEGORIES, type AttractionCategory } from '@wayfarer/shared';
import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { localizedName, type AttractionSummary, type City } from './api';

import { Badge } from '@/components/card';
import { Icon, categoryIcon } from '@/components/icon';
import { Sheet } from '@/components/sheet';
import { Tappable } from '@/components/tappable';
import { Text } from '@/components/text';
import { flagEmoji } from '@/lib/format';
import { categoryColors, MIN_TOUCH, radius, spacing } from '@/theme/colors';
import { fontFamilyFor } from '@/theme/fonts';
import { useShadows, useTheme } from '@/theme/use-theme';

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Search-style pill showing the current city; opens the city picker. */
export function CitySwitcher({
  cities,
  current,
  onSelect,
}: {
  cities: City[];
  current: City | undefined;
  onSelect: (slug: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const shadows = useShadows();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const lang = i18n.resolvedLanguage ?? 'en';
  const name = (c: City) => (lang === 'pt' ? c.namePt : c.nameEn);

  const q = normalize(query.trim());
  const filtered = [...cities]
    .sort((a, b) => name(a).localeCompare(name(b), lang))
    .filter((c) => !q || normalize(c.nameEn).includes(q) || normalize(c.namePt).includes(q));

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <Tappable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('explore.changeCity', { city: current ? name(current) : '' })}
        testID="city-switcher"
        pressScale={0.98}
        style={({ hovered }) => [
          styles.pill,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            boxShadow: hovered ? shadows.raised : shadows.card,
          },
        ]}>
        <View style={[styles.pillIcon, { backgroundColor: theme.primary }]}>
          <Icon name="search" size={16} color={theme.onPrimary} />
        </View>
        <Text variant="subtitle" numberOfLines={1} style={styles.flex}>
          {current
            ? `${flagEmoji(current.countryCode)}  ${name(current)}`
            : t('explore.chooseCity')}
        </Text>
        <Icon name="chevronDown" size={16} color={theme.textSecondary} />
      </Tappable>

      <Sheet visible={open} onClose={close} title={t('explore.chooseCity')}>
        <View
          style={[
            styles.search,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}>
          <Icon name="search" size={18} color={theme.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('explore.searchCities')}
            accessibilityLabel={t('explore.searchCities')}
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.slug}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text secondary style={styles.empty}>
              {t('explore.noCityMatch')}
            </Text>
          }
          renderItem={({ item }) => {
            const selected = item.slug === current?.slug;
            return (
              <Tappable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={name(item)}
                pressScale={0.98}
                onPress={() => {
                  onSelect(item.slug);
                  close();
                }}
                style={({ hovered, pressed }) => [
                  styles.cityRow,
                  {
                    backgroundColor: selected
                      ? theme.primarySoft
                      : hovered || pressed
                        ? theme.surfaceMuted
                        : 'transparent',
                  },
                ]}>
                <View style={[styles.flag, { backgroundColor: theme.surfaceMuted }]}>
                  <Text style={styles.flagText}>{flagEmoji(item.countryCode)}</Text>
                </View>
                <View style={styles.flex}>
                  <Text variant="subtitle">{name(item)}</Text>
                  <Text variant="caption" secondary>
                    {t('explore.placesCount', { count: item.attractionCount })}
                  </Text>
                </View>
                {selected ? <Icon name="check" size={18} color={theme.primary} /> : null}
              </Tappable>
            );
          }}
        />
      </Sheet>
    </>
  );
}

/** Icon + label category tabs; the active ones are underlined in the text colour. */
export function CategoryFilters({
  selected,
  onToggle,
  onClear,
}: {
  selected: AttractionCategory[];
  onToggle: (c: AttractionCategory) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filters}
      accessibilityLabel={t('explore.filters')}>
      <CategoryTab
        label={t('explore.allCategories')}
        icon="grid"
        selected={selected.length === 0}
        onPress={onClear}
      />
      {ATTRACTION_CATEGORIES.map((c) => (
        <CategoryTab
          key={c}
          label={t(`category.${c}`)}
          icon={categoryIcon(c)}
          selected={selected.includes(c)}
          onPress={() => onToggle(c)}
        />
      ))}
    </ScrollView>
  );
}

function CategoryTab({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: ReturnType<typeof categoryIcon>;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      pressScale={0.94}
      style={styles.tab}>
      {({ hovered }) => {
        const color = selected || hovered ? theme.text : theme.textSecondary;
        return (
          <>
            <Icon name={icon} size={22} color={color} />
            <Text variant="helper" style={{ color, fontWeight: selected ? '600' : '500' }}>
              {label}
            </Text>
            <View
              style={[
                styles.tabBar,
                {
                  backgroundColor: selected
                    ? theme.text
                    : hovered
                      ? theme.borderStrong
                      : 'transparent',
                },
              ]}
            />
          </>
        );
      }}
    </Tappable>
  );
}

export function CategoryDot({ category }: { category: string }) {
  return (
    <View
      style={[styles.dot, { backgroundColor: categoryColors[category] ?? categoryColors.other }]}
    />
  );
}

function Thumbnail({ uri, style }: { uri: string | null; style: object }) {
  const theme = useTheme();
  return uri ? (
    <Image source={uri} style={style} contentFit="cover" accessible={false} transition={200} />
  ) : (
    <View style={[style, styles.placeholder, { backgroundColor: theme.surfaceMuted }]}>
      <Icon name="photo" size={28} color={theme.textSecondary} />
    </View>
  );
}

/** Image-led card for browsing attractions in a grid. */
export function AttractionCard({
  item,
  onPress,
  order,
}: {
  item: AttractionSummary;
  onPress?: () => void;
  /** Position in the current route, when the place is in it. */
  order?: number;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const name = localizedName(item, i18n.resolvedLanguage ?? 'en');
  return (
    <Tappable
      onPress={onPress}
      disabled={!onPress}
      pressScale={0.98}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${t(`category.${item.category}`)}`}
      style={styles.card}>
      {({ hovered }) => (
        <>
          <View style={styles.media}>
            <Thumbnail uri={item.imageUrl} style={[styles.cover, hovered && styles.coverHover]} />
            <View style={styles.overlayRow} pointerEvents="none">
              {item.isUnesco ? <Badge label="UNESCO" tone="overlay" /> : <View />}
              {order != null ? (
                <View style={[styles.orderBadge, { backgroundColor: theme.primary }]}>
                  <Text variant="helper" style={{ color: theme.onPrimary, fontWeight: '700' }}>
                    {order}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.cardBody}>
            <Text variant="subtitle" numberOfLines={1}>
              {name}
            </Text>
            <View style={styles.meta}>
              <CategoryDot category={item.category} />
              <Text variant="caption" secondary numberOfLines={1} style={styles.flex}>
                {t(`category.${item.category}`)} ·{' '}
                {t('attraction.visitMinutes', { minutes: item.avgVisitMinutes })}
              </Text>
            </View>
          </View>
        </>
      )}
    </Tappable>
  );
}

/** Compact row for ordered lists (route stops, trip stops). */
export function AttractionRow({
  item,
  onPress,
  trailing,
  index,
}: {
  item: AttractionSummary;
  onPress?: () => void;
  trailing?: React.ReactNode;
  index?: number;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const shadows = useShadows();
  const name = localizedName(item, i18n.resolvedLanguage ?? 'en');
  return (
    <Tappable
      onPress={onPress}
      disabled={!onPress}
      pressScale={0.99}
      accessibilityRole="button"
      accessibilityLabel={`${index != null ? `${index + 1}. ` : ''}${name}, ${t(`category.${item.category}`)}`}
      style={({ hovered }) => [
        styles.row,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          boxShadow: hovered ? shadows.raised : shadows.card,
        },
      ]}>
      <View>
        <Thumbnail uri={item.imageUrl} style={styles.thumb} />
        {index != null ? (
          <View
            style={[
              styles.rowBadge,
              { backgroundColor: theme.primary, borderColor: theme.surface },
            ]}>
            <Text variant="helper" style={{ color: theme.onPrimary, fontWeight: '700' }}>
              {index + 1}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.rowText}>
        <Text variant="subtitle" numberOfLines={2}>
          {name}
        </Text>
        <View style={styles.meta}>
          <CategoryDot category={item.category} />
          <Text variant="caption" secondary numberOfLines={1} style={styles.flex}>
            {t(`category.${item.category}`)} ·{' '}
            {t('attraction.visitMinutes', { minutes: item.avgVisitMinutes })}
            {item.isUnesco ? ' · UNESCO' : ''}
          </Text>
        </View>
      </View>
      {trailing}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    minHeight: MIN_TOUCH + 12,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: MIN_TOUCH + 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, alignSelf: 'stretch', fontSize: 16, fontFamily: fontFamilyFor('400') },
  empty: { padding: spacing.md, textAlign: 'center' },
  cityRow: {
    minHeight: MIN_TOUCH + 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  flag: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagText: { fontSize: 22, lineHeight: 28 },
  filters: { gap: spacing.lg, paddingHorizontal: spacing.xs },
  tab: { alignItems: 'center', gap: spacing.xs, paddingTop: spacing.xs, minWidth: 56 },
  tabBar: { height: 2, alignSelf: 'stretch', borderRadius: 1, marginTop: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  card: { flex: 1, gap: spacing.md - 4 },
  media: { borderRadius: radius.lg, overflow: 'hidden' },
  cover: { width: '100%', aspectRatio: 4 / 3 },
  coverHover: { opacity: 0.88 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  overlayRow: {
    position: 'absolute',
    top: spacing.md - 4,
    left: spacing.md - 4,
    right: spacing.md - 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  cardBody: { gap: spacing.xxs, paddingHorizontal: spacing.xxs },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm - 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm + 2,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 64, height: 64, borderRadius: radius.md },
  rowBadge: {
    position: 'absolute',
    top: -6,
    left: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: spacing.xxs },
});
