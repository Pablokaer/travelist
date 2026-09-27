import { zodResolver } from '@hookform/resolvers/zod';
import {
  DEFAULT_LANGUAGE,
  profileFormSchema,
  type Language,
  type ProfileForm,
} from '@wayfarer/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { FormError } from '@/features/auth/components';
import { useProfile, useSaveProfile } from '@/features/profile/api';
import {
  NameAndPreferencesFields,
  NationalityFields,
  PassportFields,
} from '@/features/profile/profile-fields';
import { spacing } from '@/theme/colors';

const STEP_FIELDS = [
  ['displayName', 'language', 'units'],
  ['nationalities', 'homeCountry'],
  ['passportExpiry'],
] as const satisfies readonly (readonly (keyof ProfileForm)[])[];

export default function OnboardingScreen() {
  const { t, i18n } = useTranslation();
  const profile = useProfile();
  const save = useSaveProfile();
  const [step, setStep] = useState(0);

  const { control, trigger, handleSubmit } = useForm<ProfileForm>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: profile.data?.displayName ?? '',
      language: (i18n.resolvedLanguage as Language) ?? DEFAULT_LANGUAGE,
      units: profile.data?.units ?? 'metric',
      homeCountry: profile.data?.homeCountry ?? '',
      nationalities: profile.data?.nationalities ?? [],
      passportExpiry: profile.data?.passportExpiry ?? null,
    },
  });

  const next = async () => {
    if (await trigger([...STEP_FIELDS[step]!])) setStep((s) => s + 1);
  };
  const finish = handleSubmit((form) => save.mutate(form));

  const titles = [
    t('onboarding.step1Title'),
    t('onboarding.step2Title'),
    t('onboarding.step3Title'),
  ];

  return (
    <Screen>
      <Text variant="caption" secondary accessibilityLiveRegion="polite">
        {t('onboarding.progress', { step: step + 1, total: 3 })}
      </Text>
      <Text variant="title">{titles[step]}</Text>
      {step === 0 ? <NameAndPreferencesFields control={control} /> : null}
      {step === 1 ? <NationalityFields control={control} /> : null}
      {step === 2 ? <PassportFields control={control} /> : null}
      <FormError message={save.error ? save.error.message : null} />
      <View style={styles.actions}>
        {step > 0 ? (
          <Button
            variant="secondary"
            label={t('common.back')}
            onPress={() => setStep((s) => s - 1)}
            style={styles.flex}
          />
        ) : null}
        {step < 2 ? (
          <Button label={t('common.next')} onPress={() => void next()} style={styles.flex} />
        ) : (
          <Button
            label={t('onboarding.finish')}
            loading={save.isPending}
            onPress={finish}
            style={styles.flex}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  flex: { flex: 1 },
});
