import { LandingPage } from '@/features/landing/landing-page';
import { landingI18n } from '@/lib/i18n';

/**
 * The landing page route (D-072), where signed-out visitors start on the web. Always in
 * English (D-077), whatever the app language is: it hands the page the English-pinned i18n,
 * so sign-in, sign-up and About, opened from here, keep the visitor's language.
 * @example renderRouter({ '(auth)/welcome': WelcomeScreen }, { initialUrl: '/welcome' })
 */
export default function WelcomeScreen() {
  return <LandingPage i18n={landingI18n()} />;
}
