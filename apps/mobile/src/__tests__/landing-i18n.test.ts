import i18n, { LANDING_LANGUAGE, landingI18n } from '@/lib/i18n';

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('landingI18n (D-077)', () => {
  test('is the same instance every time', () => {
    expect(landingI18n()).toBe(landingI18n());
  });

  test('stays in the landing language when the app switches language', async () => {
    const landing = landingI18n();
    await i18n.changeLanguage('pt');
    expect(landing.resolvedLanguage).toBe(LANDING_LANGUAGE);
    expect(landing.t('auth.signUpTitle')).toBe('Create your account');
    expect(i18n.t('auth.signUpTitle')).toBe('Criar conta');
  });

  test('is only built when first asked for, so the native apps never build it', () => {
    jest.isolateModules(() => {
      // i18next's CommonJS build exports the instance itself, not `{ default }`.
      const appI18n = jest.requireActual<typeof import('i18next').default>('i18next');
      const clone = jest.spyOn(appI18n, 'cloneInstance');
      const isolated = jest.requireActual<typeof import('@/lib/i18n')>('@/lib/i18n');
      expect(clone).not.toHaveBeenCalled();
      isolated.landingI18n();
      expect(clone).toHaveBeenCalledTimes(1);
    });
  });
});
