import { assertEquals } from 'jsr:@std/assert@1';

import { requireUser } from './auth.ts';

const handler = requireUser(
  (token) => Promise.resolve(token === 'good' ? { id: 'u1' } : null),
  (_req, user) => Promise.resolve(new Response(user.id)),
);

Deno.test('requireUser: rejects missing and invalid tokens, passes valid users', async () => {
  assertEquals((await handler(new Request('http://x', { method: 'POST' }))).status, 401);
  const bad = new Request('http://x', { method: 'POST', headers: { Authorization: 'Bearer bad' } });
  assertEquals((await handler(bad)).status, 401);
  const good = new Request('http://x', {
    method: 'POST',
    headers: { Authorization: 'Bearer good' },
  });
  assertEquals(await (await handler(good)).text(), 'u1');
});

Deno.test('requireUser: lets CORS preflight through', async () => {
  const res = await handler(new Request('http://x', { method: 'OPTIONS' }));
  assertEquals(res.status, 200);
});
