import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { removeAllProfilePhotos } from '@/features/profile/avatar-api';
import { supabase } from '@/lib/supabase';

export type OAuthProvider = 'google' | 'apple';

/** Where Supabase sends users back after magic links and OAuth. */
export function authRedirectUrl() {
  return Linking.createURL('/auth/callback');
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function signInWithPassword(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  fail(error);
}

/** Returns true when the user must confirm the email before signing in. */
export async function signUp(input: {
  email: string;
  password: string;
  displayName: string;
  language: string;
}) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: authRedirectUrl(),
      data: { display_name: input.displayName, language: input.language },
    },
  });
  fail(error);
  return !data.session;
}

export async function sendMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: authRedirectUrl(), shouldCreateUser: true },
  });
  fail(error);
}

export async function verifyEmailCode(email: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  fail(error);
}

/** Completes a PKCE callback URL (magic link, email confirmation, OAuth). */
export async function completeAuthFromUrl(url: string) {
  const { queryParams } = Linking.parse(url);
  const errorDescription = queryParams?.error_description;
  if (typeof errorDescription === 'string') throw new Error(errorDescription);
  const code = queryParams?.code;
  if (typeof code !== 'string') return false;
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  fail(error);
  return true;
}

async function nativeAppleSignIn() {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!credential.identityToken) throw new Error('Apple did not return an identity token');
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  fail(error);
  const name = [credential.fullName?.givenName, credential.fullName?.familyName]
    .filter(Boolean)
    .join(' ');
  // Apple only shares the name on the first sign-in; keep it on the profile.
  if (name) await supabase.auth.updateUser({ data: { full_name: name } });
}

/**
 * OAuth sign-in. iOS uses native Sign in with Apple; everything else goes through the
 * Supabase-hosted OAuth page (web redirect, or an in-app browser session on native).
 */
export async function signInWithOAuth(provider: OAuthProvider) {
  if (
    provider === 'apple' &&
    Platform.OS === 'ios' &&
    (await AppleAuthentication.isAvailableAsync())
  ) {
    return nativeAppleSignIn();
  }
  const redirectTo = authRedirectUrl();
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
    fail(error);
    return;
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  fail(error);
  if (!data.url) throw new Error('OAuth provider did not return a URL');
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'success') await completeAuthFromUrl(result.url);
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  fail(error);
}

export async function deleteAccount() {
  // Storage files do not cascade with the account rows: remove the profile photos first (D-039).
  const { data } = await supabase.auth.getSession();
  if (data.session) await removeAllProfilePhotos(data.session.user.id);
  const { error } = await supabase.rpc('delete_account');
  fail(error);
  await supabase.auth.signOut({ scope: 'local' });
}
