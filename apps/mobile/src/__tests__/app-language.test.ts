// Kept apart from the tests that import `@/lib/i18n` at the top: the module must be loaded here
// for the first time, with a Portuguese device, to see which language it starts in.
describe('the app language before sign-in (D-086)', () => {
  test('is English even on a Portuguese device: the account sets it at sign-up', () => {
    jest.isolateModules(() => {
      jest.doMock('expo-localization', () => ({
        getLocales: () => [{ languageCode: 'pt', languageTag: 'pt-BR' }],
      }));
      const isolated = jest.requireActual<typeof import('@/lib/i18n')>('@/lib/i18n');
      expect(isolated.default.resolvedLanguage).toBe('en');
    });
  });
});
