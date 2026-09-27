import { zodResolver } from '@hookform/resolvers/zod';
import { signUpSchema } from '@wayfarer/shared';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { signUp } from '@/features/auth/api';
import { AuthFooter, FormError, OAuthButtons } from '@/features/auth/components';
import { useTheme } from '@/theme/use-theme';

type Form = z.infer<typeof signUpSchema>;

export default function SignUpScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (form) => {
    setError(null);
    try {
      const needsConfirmation = await signUp({
        ...form,
        email: form.email.trim(),
        language: i18n.resolvedLanguage ?? 'en',
      });
      if (needsConfirmation) setConfirmEmail(form.email.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.generic'));
    }
  });

  if (confirmEmail) {
    return (
      <Screen>
        <Text variant="title">{t('auth.checkInboxTitle')}</Text>
        <Text>{t('auth.confirmEmailBody', { email: confirmEmail })}</Text>
        <Link href="/sign-in" style={{ color: theme.primary, fontSize: 16, paddingVertical: 10 }}>
          {t('auth.backToSignIn')}
        </Link>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="title">{t('auth.signUpTitle')}</Text>
      <Controller
        control={control}
        name="displayName"
        render={({ field, fieldState }) => (
          <TextField
            label={t('profile.displayName')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            autoComplete="name"
            textContentType="name"
            testID="displayName"
          />
        )}
      />
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <TextField
            label={t('auth.email')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            testID="email"
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <TextField
            label={t('auth.password')}
            hint={t('auth.passwordHint')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            onSubmitEditing={onSubmit}
            testID="password"
          />
        )}
      />
      <FormError message={error} />
      <Button label={t('auth.createAccount')} loading={formState.isSubmitting} onPress={onSubmit} />
      <OAuthButtons onError={setError} />
      <Link href="/sign-in" style={{ color: theme.primary, fontSize: 16, paddingVertical: 10 }}>
        {t('auth.haveAccount')}
      </Link>
      <AuthFooter />
    </Screen>
  );
}
