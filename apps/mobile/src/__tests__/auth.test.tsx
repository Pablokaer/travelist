import { userEvent } from '@testing-library/react-native';
import { act, renderRouter, screen } from 'expo-router/testing-library';

import i18n from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

import RootLayout from '../app/_layout';
import AuthLayout from '../app/(auth)/_layout';
import MagicLinkScreen from '../app/(auth)/magic-link';
import SignInScreen from '../app/(auth)/sign-in';
import SignUpScreen from '../app/(auth)/sign-up';
import AboutScreen from '../app/about';

jest.mock('@/lib/supabase', () => {
  const auth = {
    getSession: jest.fn(async () => ({ data: { session: null }, error: null })),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    signInWithPassword: jest.fn(async () => ({ data: {}, error: null })),
    signInWithOtp: jest.fn(async () => ({ data: {}, error: null })),
    verifyOtp: jest.fn(async () => ({ data: {}, error: null })),
    signUp: jest.fn(async () => ({ data: { session: null }, error: null })),
  };
  return {
    supabase: { auth, from: jest.fn(), rpc: jest.fn() },
    unwrap: (r: { data: unknown }) => r.data,
    check: () => undefined,
  };
});

const routes = {
  _layout: RootLayout,
  '(tabs)/_layout': () => null,
  '(tabs)/index': () => null,
  '(auth)/_layout': AuthLayout,
  '(auth)/sign-in': SignInScreen,
  '(auth)/sign-up': SignUpScreen,
  '(auth)/magic-link': MagicLinkScreen,
  about: AboutScreen,
};

afterEach(async () => {
  jest.clearAllMocks();
  await act(() => i18n.changeLanguage('en'));
});

describe('signed-out experience', () => {
  it('redirects signed-out users to sign-in and validates the form', async () => {
    renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByRole('header', { name: 'Welcome back' })).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email address')).toBeOnTheScreen();
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('signs in with email and password', async () => {
    renderRouter(routes, { initialUrl: '/sign-in' });
    await userEvent.type(await screen.findByTestId('email'), 'traveller@example.com');
    await userEvent.type(screen.getByTestId('password'), 'secret-password');
    await userEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'traveller@example.com',
      password: 'secret-password',
    });
  });

  it('sends a magic link and then asks for the code', async () => {
    renderRouter(routes, { initialUrl: '/magic-link' });
    await userEvent.type(await screen.findByTestId('email'), 'traveller@example.com');
    await userEvent.press(screen.getByRole('button', { name: 'Send link' }));
    expect(await screen.findByTestId('code')).toBeOnTheScreen();
    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'traveller@example.com' }),
    );
    await userEvent.type(screen.getByTestId('code'), '123456');
    await userEvent.press(screen.getByRole('button', { name: 'Verify code' }));
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      email: 'traveller@example.com',
      token: '123456',
      type: 'email',
    });
  });

  it('requires 8+ character passwords on sign-up and asks to confirm email', async () => {
    renderRouter(routes, { initialUrl: '/sign-up' });
    await userEvent.type(await screen.findByTestId('displayName'), 'Ana');
    await userEvent.type(screen.getByTestId('email'), 'ana@example.com');
    await userEvent.type(screen.getByTestId('password'), 'short');
    await userEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Use at least 8 characters')).toBeOnTheScreen();

    await userEvent.clear(screen.getByTestId('password'));
    await userEvent.type(screen.getByTestId('password'), 'long-enough-password');
    await userEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('header', { name: 'Check your inbox' })).toBeOnTheScreen();
  });

  it('switches the auth screens to Portuguese', async () => {
    renderRouter(routes, { initialUrl: '/sign-in' });
    await userEvent.press(await screen.findByRole('checkbox', { name: 'Português' }));
    expect(await screen.findByRole('header', { name: 'Bem-vindo de volta' })).toBeOnTheScreen();
  });
});
