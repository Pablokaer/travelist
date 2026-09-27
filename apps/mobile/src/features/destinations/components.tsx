import { ATTRACTION_CATEGORIES, type AttractionCategory } from '@wayfarer/shared';
import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { localizedName, type AttractionSummary, type City } from './api';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Text } from '@/components/text';
import { categoryColors, MIN_TOUCH, radius, spacing } from '@/theme/colors';
import { useTheme } from '@/theme/use-theme';

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
  const [open, setOpen] = useState(false);
  const lang = i18n.resolvedLanguage ?? 'en';
  const name = (c: City) => (lang === 'pt' ? c.namePt : c.nameEn);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('explore.changeCity', { city: current ? name(current) : '' })}
        testID="city-switcher"
        style={({ pressed }) => [
          styles.cityButton,
          {
            backgroundColor: theme.background,
            borderColor: theme.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}>
        <Text variant="heading">{current ? name(current) : t('explore.chooseCity')}</Text>
        <Text secondary>▾</Text>
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={[styles.modal, { backgroundColor: theme.background }]}>
          <View style={styles.modalHeader}>
            <Text variant="heading">{t('explore.chooseCity')}</Text>
            <Button
              compact
              variant="ghost"
              label={t('common.close')}
              onPress={() => setOpen(false)}
            />
          </View>
          <FlatList
            data={[...cities].sort((a, b) => name(a).localeCompare(name(b), lang))}
            keyExtractor={(c) => c.slug}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: item.slug === current?.slug }}
                accessibilityLabel={name(item)}
                onPress={() => {
                  onSelect(item.slug);
                  setOpen(false);
                }}
                style={({ pressed }) => [
                  styles.cityRow,
                  { borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
                ]}>
                <Text style={{ flex: 1, fontWeight: item.slug === current?.slug ? '700' : '400' }}>
                  {name(item)}
                </Text>
                <Text secondary variant="caption">
                  {t('explore.placesCount', { count: item.attractionCount })}
                </Text>
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

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
      <Chip label={t('explore.allCategories')} selected={selected.length === 0} onPress={onClear} />
      {ATTRACTION_CATEGORIES.map((c) => (
        <Chip
          key={c}
          label={t(`category.${c}`)}
          selected={selected.includes(c)}
          onPress={() => onToggle(c)}
        />
      ))}
    </ScrollView>
  );
}

export function CategoryDot({ category }: { category: string }) {
  return (
    <View
      style={[styles.dot, { backgroundColor: categoryColors[category] ?? categoryColors.other }]}
    />
  );
}

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
  const name = localizedName(item, i18n.resolvedLanguage ?? 'en');
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${index != null ? `${index + 1}. ` : ''}${name}, ${t(`category.${item.category}`)}`}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
      ]}>
      {index != null ? (
        <View style={[styles.badge, { backgroundColor: theme.primary }]}>
          <Text variant="caption" style={{ color: theme.onPrimary, fontWeight: '700' }}>
            {index + 1}
          </Text>
        </View>
      ) : item.imageUrl ? (
        <Image source={item.imageUrl} style={styles.thumb} contentFit="cover" accessible={false} />
      ) : (
        <View style={[styles.thumb, { backgroundColor: theme.border }]} />
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={2} style={{ fontWeight: '600' }}>
          {name}
        </Text>
        <View style={styles.meta}>
          <CategoryDot category={item.category} />
          <Text variant="caption" secondary>
            {t(`category.${item.category}`)} ·{' '}
            {t('attraction.visitMinutes', { minutes: item.avgVisitMinutes })}
            {item.isUnesco ? ' · UNESCO' : ''}
          </Text>
        </View>
      </View>
      {trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: MIN_TOUCH,
    borderRadius: radius.md,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  modal: { flex: 1, padding: spacing.md },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cityRow: {
    minHeight: MIN_TOUCH + 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
  },
  filters: { gap: spacing.sm, paddingVertical: spacing.xs },
  dot: { width: 10, height: 10, borderRadius: 5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: MIN_TOUCH + 16,
  },
  thumb: { width: 56, height: 56, borderRadius: radius.sm },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
