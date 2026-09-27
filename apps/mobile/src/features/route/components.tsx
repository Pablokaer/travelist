import {
  appleMapsLegUrl,
  googleMapsDirectionsUrl,
  googleMapsLegUrl,
  type Units,
} from '@wayfarer/shared';
import * as Linking from 'expo-linking';
import { Platform, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/button';
import { Text } from '@/components/text';
import type { AttractionSummary } from '@/features/destinations/api';
import { localizedName } from '@/features/destinations/api';
import { formatDistance, formatDuration } from '@/lib/format';
import { radius, spacing } from '@/theme/colors';
import { useTheme } from '@/theme/use-theme';

export function RouteTotals({
  distanceM,
  walkingSeconds,
  visitMinutes,
  units,
  isFallback,
  attribution,
}: {
  distanceM: number | null;
  walkingSeconds: number | null;
  visitMinutes: number;
  units: Units;
  isFallback?: boolean;
  attribution?: string | null;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const lang = i18n.resolvedLanguage ?? 'en';
  const walk = walkingSeconds ?? 0;
  return (
    <View
      style={[styles.totals, { backgroundColor: theme.surface, borderColor: theme.border }]}
      testID="route-totals">
      <View style={styles.stats}>
        <Stat
          label={t('route.distance')}
          value={distanceM != null ? formatDistance(distanceM, units, lang) : '–'}
        />
        <Stat
          label={t('route.walking')}
          value={walkingSeconds != null ? formatDuration(walk) : '–'}
        />
        <Stat label={t('route.visiting')} value={formatDuration(visitMinutes * 60)} />
        <Stat label={t('route.total')} value={formatDuration(walk + visitMinutes * 60)} />
      </View>
      {isFallback ? (
        <Text variant="caption" secondary>
          {t('route.fallbackNotice')}
        </Text>
      ) : null}
      {attribution ? (
        <Text variant="caption" secondary>
          {attribution}
        </Text>
      ) : null}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="caption" secondary>
        {label}
      </Text>
      <Text style={{ fontWeight: '700' }}>{value}</Text>
    </View>
  );
}

/** Links that open the walking route in Google Maps / Apple Maps. */
export function NavigationLinks({ stops }: { stops: AttractionSummary[] }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  if (stops.length < 2) return null;
  const open = (url: string) => void Linking.openURL(url);
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="heading">{t('route.navigate')}</Text>
      <Button
        variant="secondary"
        label={t('route.openGoogleMaps')}
        onPress={() => open(googleMapsDirectionsUrl(stops))}
      />
      {stops.length > 11 ? (
        <Text variant="caption" secondary>
          {t('route.googleLimit')}
        </Text>
      ) : null}
      <Text variant="caption" secondary>
        {t('route.legByLeg')}
      </Text>
      {stops.slice(1).map((to, i) => {
        const from = stops[i]!;
        const label = t('route.leg', {
          from: localizedName(from, lang),
          to: localizedName(to, lang),
        });
        return (
          <View key={to.id} style={styles.leg}>
            <Text style={{ flex: 1 }} numberOfLines={2}>
              {i + 1}→{i + 2} · {label}
            </Text>
            <Button
              compact
              variant="ghost"
              label="Google"
              accessibilityLabel={`${label}, Google Maps`}
              onPress={() => open(googleMapsLegUrl(from, to))}
            />
            {Platform.OS !== 'android' ? (
              <Button
                compact
                variant="ghost"
                label="Apple"
                accessibilityLabel={`${label}, Apple Maps`}
                onPress={() => open(appleMapsLegUrl(from, to))}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  totals: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: { minWidth: 70, gap: 2 },
  leg: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
