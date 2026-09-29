import { zodResolver } from '@hookform/resolvers/zod';
import { signUpSchema } from '@wayfarer/shared';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { signUp } from '@/features/auth/api';
import {
  AuthFooter,
  AuthLayout,
  FormError,
  OAuthButtons,
  TextLink,
} from '@/features/auth/components';

type Form = z.infer<typeof signUpSchema>;

export default function SignUpScreen() {
  const { t, i18n } = useTranslation();
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
      <AuthLayout
        title={t('auth.checkInboxTitle')}
        subtitle={t('auth.confirmEmailBody', { email: confirmEmail })}>
        <TextLink href="/sign-in" label={t('auth.backToSignIn')} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('auth.signUpTitle')} footer={<AuthFooter />}>
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
            icon="mail"
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
      <TextLink href="/sign-in" label={t('auth.haveAccount')} />
    </AuthLayout>
  );
}
