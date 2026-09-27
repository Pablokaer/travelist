import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { countryName, useCountries, type Country } from './api';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { ErrorState, LoadingState } from '@/components/states';
import { Text } from '@/components/text';
import { MIN_TOUCH, radius, spacing } from '@/theme/colors';
import { useTheme } from '@/theme/use-theme';

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

type Props = {
  label: string;
  /** Selected ISO codes. */
  value: string[];
  onChange: (codes: string[]) => void;
  multiple?: boolean;
  max?: number;
  error?: string;
  testID?: string;
};

/** Searchable country selector (single or multiple) rendered as chips + a modal list. */
export function CountryPicker({ label, value, onChange, multiple, max = 5, error, testID }: Props) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const countries = useCountries();
  const lang = i18n.resolvedLanguage ?? 'en';

  const byCode = useMemo(
    () => new Map((countries.data ?? []).map((c) => [c.code, c] as const)),
    [countries.data],
  );
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    const list = [...(countries.data ?? [])].sort((a, b) =>
      countryName(a, lang).localeCompare(countryName(b, lang), lang),
    );
    if (!q) return list;
    return list.filter(
      (c) =>
        normalize(c.name_en).includes(q) ||
        normalize(c.name_pt).includes(q) ||
        c.code.toLowerCase() === q,
    );
  }, [countries.data, query, lang]);

  const toggle = (c: Country) => {
    if (!multiple) {
      onChange([c.code]);
      setOpen(false);
      return;
    }
    if (value.includes(c.code)) onChange(value.filter((v) => v !== c.code));
    else if (value.length < max) onChange([...value, c.code]);
  };

  const message = error ? t(error as never, { defaultValue: error }) : undefined;

  return (
    <View style={{ gap: spacing.xs }} testID={testID}>
      <Text variant="caption" style={{ fontWeight: '600' }}>
        {label}
      </Text>
      <View style={styles.chips}>
        {value.map((code) => (
          <Chip
            key={code}
            label={countryName(byCode.get(code), lang) || code}
            selected
            onRemove={
              multiple ? () => onChange(value.filter((v) => v !== code)) : () => setOpen(true)
            }
          />
        ))}
        {multiple || value.length === 0 ? (
          <Button
            compact
            variant="secondary"
            label={value.length ? t('countryPicker.addAnother') : t('countryPicker.choose')}
            onPress={() => setOpen(true)}
            disabled={multiple && value.length >= max}
          />
        ) : null}
      </View>
      {message ? (
        <Text variant="caption" style={{ color: theme.danger }}>
          {message}
        </Text>
      ) : null}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={[styles.modal, { backgroundColor: theme.background }]}>
          <View style={styles.header}>
            <Text variant="heading">{label}</Text>
            <Button
              compact
              variant="ghost"
              label={t('common.done')}
              onPress={() => setOpen(false)}
            />
          </View>
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={t('countryPicker.search')}
            accessibilityLabel={t('countryPicker.search')}
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.search,
              { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          />
          {countries.isPending ? (
            <LoadingState />
          ) : countries.isError ? (
            <ErrorState onRetry={() => countries.refetch()} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(c) => c.code}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={30}
              renderItem={({ item }) => {
                const selected = value.includes(item.code);
                return (
                  <Pressable
                    onPress={() => toggle(item)}
                    accessibilityRole={multiple ? 'checkbox' : 'radio'}
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={countryName(item, lang)}
                    style={({ pressed }) => [
                      styles.row,
                      { borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
                    ]}>
                    <Text style={{ flex: 1 }}>{countryName(item, lang)}</Text>
                    <Text secondary>{selected ? '✓' : item.code}</Text>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <Text secondary style={{ padding: spacing.md }}>
                  {t('countryPicker.noResults')}
                </Text>
              }
            />
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  modal: { flex: 1, padding: spacing.md, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  search: {
    minHeight: MIN_TOUCH + 4,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  row: {
    minHeight: MIN_TOUCH + 4,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
  },
});
