import { zodResolver } from '@hookform/resolvers/zod';
import { signInSchema } from '@wayfarer/shared';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { signInWithPassword } from '@/features/auth/api';
import { AuthFooter, FormError, OAuthButtons } from '@/features/auth/components';
import { useTheme } from '@/theme/use-theme';

type Form = z.infer<typeof signInSchema>;

export default function SignInScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setError(null);
    try {
      await signInWithPassword(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.generic'));
    }
  });

  return (
    <Screen>
      <Text variant="title">{t('auth.signInTitle')}</Text>
      <Text secondary>{t('auth.signInSubtitle')}</Text>
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
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditing={onSubmit}
            testID="password"
          />
        )}
      />
      <FormError message={error} />
      <Button label={t('auth.signIn')} loading={formState.isSubmitting} onPress={onSubmit} />
      <Link href="/magic-link" style={{ color: theme.primary, fontSize: 16, paddingVertical: 10 }}>
        {t('auth.useMagicLink')}
      </Link>
      <OAuthButtons onError={setError} />
      <Link href="/sign-up" style={{ color: theme.primary, fontSize: 16, paddingVertical: 10 }}>
        {t('auth.noAccount')}
      </Link>
      <AuthFooter />
    </Screen>
  );
}
