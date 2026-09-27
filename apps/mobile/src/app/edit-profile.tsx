import { zodResolver } from '@hookform/resolvers/zod';
import { profileFormSchema, type ProfileForm } from '@wayfarer/shared';
import { router } from 'expo-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ErrorState, LoadingState } from '@/components/states';
import { FormError } from '@/features/auth/components';
import { useProfile, useSaveProfile, type Profile } from '@/features/profile/api';
import {
  NameAndPreferencesFields,
  NationalityFields,
  PassportFields,
} from '@/features/profile/profile-fields';

function EditProfileForm({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const save = useSaveProfile();
  const { control, handleSubmit } = useForm<ProfileForm>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: profile.displayName ?? '',
      language: profile.language,
      units: profile.units,
      homeCountry: profile.homeCountry ?? '',
      nationalities: profile.nationalities,
      passportExpiry: profile.passportExpiry,
    },
  });
  const onSave = handleSubmit((form) => save.mutate(form, { onSuccess: () => router.back() }));
  return (
    <Screen>
      <NameAndPreferencesFields control={control} />
      <NationalityFields control={control} />
      <PassportFields control={control} />
      <FormError message={save.error ? save.error.message : null} />
      <Button
        label={t('common.save')}
        loading={save.isPending}
        onPress={onSave}
        testID="save-profile"
      />
    </Screen>
  );
}

export default function EditProfileScreen() {
  const profile = useProfile();
  if (profile.isPending) return <LoadingState />;
  if (profile.isError) return <ErrorState onRetry={() => profile.refetch()} />;
  return <EditProfileForm profile={profile.data} />;
}
