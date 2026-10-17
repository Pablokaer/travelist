import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type Language } from '@wayfarer/shared';
import { resources } from '@wayfarer/shared/i18n';
import { getLocales } from 'expo-localization';
import i18n, { type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

export function detectDeviceLanguage(): Language {
  for (const locale of getLocales()) {
    const code = locale.languageCode?.toLowerCase();
    if (code && (SUPPORTED_LANGUAGES as readonly string[]).includes(code)) {
      return code as Language;
    }
  }
  return DEFAULT_LANGUAGE;
}

if (!i18n.isInitialized) {
  // eslint-disable-next-line import/no-named-as-default-member -- i18next's documented API
  void i18n.use(initReactI18next).init({
    resources,
    lng: detectDeviceLanguage(),
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    interpolation: { escapeValue: false }, // React already escapes
    returnNull: false,
  });
}

/** The landing page's only language (D-077); its `landing.*` strings exist in English alone. */
export const LANDING_LANGUAGE: Language = 'en';

let landingInstance: I18nInstance | undefined;

/**
 * A copy of the app's i18n pinned to English for the landing page, which is always English
 * whatever the device or the visitor's saved language. It shares the translation resources
 * with the app instance, so it never needs its own copy of the strings. Built on first use:
 * the native apps open on sign-in and never show the landing.
 * @example <LandingPage i18n={landingI18n()} />
 */
export function landingI18n(): I18nInstance {
  landingInstance ??= i18n.cloneInstance({ lng: LANDING_LANGUAGE });
  return landingInstance;
}

export default i18n;
