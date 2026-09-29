import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ErrorState, LoadingState } from '@/components/states';
import { Text } from '@/components/text';
import { useProfile } from '@/features/profile/api';
import { useDeleteTrip, useTrip, type TripDetail } from '@/features/trips/api';
import {
  createLinkSharer,
  platformShareDeps,
  tripShareUrl,
  type ShareOutcome,
} from '@/features/trips/share-link';
import { useSetTripVisibility } from '@/features/trips/sharing-api';
import { TripView } from '@/features/trips/trip-view';
import { VisibilityEditor } from '@/features/trips/visibility-editor';
import { env } from '@/lib/env';
import { spacing } from '@/theme/colors';
import { useTheme } from '@/theme/use-theme';

const openStop = (id: string) => router.push({ pathname: '/attraction/[id]', params: { id } });

function DeleteTrip({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const del = useDeleteTrip();
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <View style={styles.actions}>
        <Button
          variant="ghost"
          icon="trash"
          label={t('trips.delete')}
          onPress={() => setConfirming(true)}
        />
      </View>
    );
  }
  return (
    <Card style={{ borderColor: theme.danger }}>
      <Text>{t('trips.deleteConfirm')}</Text>
      <View style={styles.actions}>
        <Button
          variant="danger"
          label={t('trips.deleteYes')}
          loading={del.isPending}
          onPress={() => del.mutate(tripId, { onSuccess: () => router.back() })}
        />
        <Button variant="ghost" label={t('common.cancel')} onPress={() => setConfirming(false)} />
      </View>
    </Card>
  );
}

/** Visibility form + share button for the owner (D-031). */
function TripSharing({ trip }: { trip: TripDetail }) {
  const setVisibility = useSetTripVisibility(trip.id);
  const [shareNotice, setShareNotice] = useState<ShareOutcome | 'failed' | null>(null);
  const share = async () => {
    const url = tripShareUrl(trip.id, env.webUrl);
    try {
      setShareNotice(await createLinkSharer(platformShareDeps()).share(url, trip.name));
    } catch {
      setShareNotice('failed');
    }
  };
  return (
    <VisibilityEditor
      visibility={trip.visibility}
      onSave={(form) => setVisibility.mutate(form)}
      onShare={() => void share()}
      saving={setVisibility.isPending}
      error={setVisibility.error?.message ?? null}
      shareNotice={shareNotice}
    />
  );
}

export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id);
  const profile = useProfile();

  if (trip.isPending) return <LoadingState />;
  if (trip.isError) return <ErrorState onRetry={() => trip.refetch()} />;
  return (
    <TripView trip={trip.data} units={profile.data?.units ?? 'metric'} onOpenStop={openStop}>
      <TripSharing trip={trip.data} />
      <DeleteTrip tripId={trip.data.id} />
    </TripView>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
