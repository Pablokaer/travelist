import { assertEquals, assertMatch } from 'jsr:@std/assert@1';

import { cacheKey, type CacheStore, createCached, stableStringify } from './cache.ts';

function memoryStore(failing = false) {
  const rows = new Map<string, { value: unknown; expiresAt: Date }>();
  const store: CacheStore = {
    get: (key, now) => {
      if (failing) return Promise.reject(new Error('db down'));
      const row = rows.get(key);
      return Promise.resolve(row && row.expiresAt > now ? row.value : undefined);
    },
    set: (key, value, expiresAt) => {
      if (failing) return Promise.reject(new Error('db down'));
      rows.set(key, { value, expiresAt });
      return Promise.resolve();
    },
    purgeExpired: (now) => {
      for (const [k, r] of rows) if (r.expiresAt <= now) rows.delete(k);
      return Promise.resolve();
    },
  };
  return { store, rows };
}

Deno.test('stableStringify sorts keys recursively', () => {
  assertEquals(
    stableStringify({ b: 1, a: { d: [1, { f: 2, e: 1 }], c: null } }),
    stableStringify({
      a: { c: null, d: [1, { e: 1, f: 2 }] },
      b: 1,
    }),
  );
});

Deno.test('cacheKey is namespaced sha256', async () => {
  assertMatch(await cacheKey('fx', { from: 'BRL', to: 'EUR' }), /^fx:[0-9a-f]{64}$/);
  assertEquals(await cacheKey('x', { a: 1, b: 2 }), await cacheKey('x', { b: 2, a: 1 }));
});

Deno.test('cached: hit, expiry, ttl function and purge', async () => {
  const { store, rows } = memoryStore();
  let t = new Date('2026-09-27T00:00:00Z');
  let n = 0;
  const cached = createCached(store, { now: () => t, random: () => 0 });
  const fetcher = () => Promise.resolve(++n);
  assertEquals(await cached('k', 60, fetcher), 1);
  assertEquals(await cached('k', 60, fetcher), 1);
  t = new Date(t.getTime() + 61_000);
  assertEquals(await cached('k', 60, fetcher), 2);
  // ttl ≤ 0 → not stored
  assertEquals(await cached('skip', () => 0, fetcher), 3);
  assertEquals(rows.has('skip'), false);
});

Deno.test('cached: store errors are swallowed', async () => {
  const { store } = memoryStore(true);
  const cached = createCached(store);
  assertEquals(await cached('k', 60, () => Promise.resolve('fresh')), 'fresh');
});
