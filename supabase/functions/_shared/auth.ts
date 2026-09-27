// Rejects requests that do not carry a valid *user* access token. The gateway's verify_jwt
// only checks the signature, so it also lets the public anon key through; this check asks
// Supabase Auth for the user behind the token.
import type { SupabaseClient } from '@supabase/supabase-js';

import { errorResponse, handleOptions } from './cors.ts';

export type AuthUser = { id: string };
export type UserVerifier = (token: string) => Promise<AuthUser | null>;

export function supabaseUserVerifier(client: SupabaseClient): UserVerifier {
  return async (token) => {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return null;
    return { id: data.user.id };
  };
}

export function bearerToken(req: Request): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.get('Authorization') ?? '');
  return match ? match[1]! : null;
}

export function requireUser(
  verify: UserVerifier,
  handler: (req: Request, user: AuthUser) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req) => {
    const preflight = handleOptions(req);
    if (preflight) return preflight;
    const token = bearerToken(req);
    if (!token) return errorResponse(401, 'unauthorized', 'missing bearer token');
    let user: AuthUser | null = null;
    try {
      user = await verify(token);
    } catch (err) {
      console.warn('auth verification failed:', err);
    }
    if (!user) return errorResponse(401, 'unauthorized', 'invalid or expired user token');
    return handler(req, user);
  };
}
