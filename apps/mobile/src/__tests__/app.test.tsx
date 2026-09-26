import { userEvent } from '@testing-library/react-native';
import { act, renderRouter, screen } from 'expo-router/testing-library';

import i18n from '@/lib/i18n';
import { parseEnv } from '@/lib/env';

import RootLayout from '../app/_layout';
import AboutScreen from '../app/about';
import TabsLayout from '../app/(tabs)/_layout';
import ExploreScreen from '../app/(tabs)/index';
import ProfileScreen from '../app/(tabs)/profile';
import TripsScreen from '../app/(tabs)/trips';

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));

const routes = {
  _layout: RootLayout,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': ExploreScreen,
  '(tabs)/trips': TripsScreen,
  '(tabs)/profile': ProfileScreen,
  about: AboutScreen,
};

afterEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

describe('app shell', () => {
  it('renders the Explore tab by default', async () => {
    renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByText('Where to next?')).toBeOnTheScreen();
    expect(screen.getByTestId('map-placeholder')).toBeOnTheScreen();
  });

  it('switches the UI to Portuguese from the profile screen', async () => {
    renderRouter(routes, { initialUrl: '/profile' });
    await userEvent.press(await screen.findByRole('radio', { name: 'Português' }));
    expect(await screen.findByRole('header', { name: 'Perfil' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Português' })).toBeChecked();
  });

  it('navigates from Profile to the About / data sources screen', async () => {
    const router = renderRouter(routes, { initialUrl: '/profile' });
    await userEvent.press(await screen.findByRole('link', { name: 'About and data sources' }));
    expect(await screen.findByText(/OpenStreetMap contributors/)).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/about');
  });
});

describe('env', () => {
  it('treats empty optional values as unset and applies defaults', () => {
    const env = parseEnv({
      supabaseUrl: '',
      supabaseAnonKey: '',
      mapStyleUrl: undefined,
      sentryDsn: '',
      posthogKey: undefined,
      posthogHost: undefined,
    });
    expect(env.supabaseUrl).toBeUndefined();
    expect(env.mapStyleUrl).toBe('https://tiles.openfreemap.org/styles/liberty');
  });

  it('rejects a malformed Supabase URL', () => {
    expect(() =>
      parseEnv({
        supabaseUrl: 'not a url',
        supabaseAnonKey: undefined,
        mapStyleUrl: undefined,
        sentryDsn: undefined,
        posthogKey: undefined,
        posthogHost: undefined,
      }),
    ).toThrow(/EXPO_PUBLIC/);
  });
});
