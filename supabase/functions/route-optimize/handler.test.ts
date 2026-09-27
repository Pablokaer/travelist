import { assert, assertEquals } from 'jsr:@std/assert@1';
import { type RouteResponse, routeResponseSchema } from '@wayfarer/shared';

import { cacheKey, type CacheStore, createCached, noCache } from '../_shared/cache.ts';
import { type FetchJson, type FetchJsonOptions, HttpError } from '../_shared/http.ts';
import { createHandler, FALLBACK_TTL, normalizeRouteInput, type RouteDeps } from './handler.ts';
import { createOrsRouting, FALLBACK_ATTRIBUTION, ORS_ATTRIBUTION } from './routing.ts';

// Lisbon: Belém tower, Jerónimos, Praça do Comércio, Castelo de São Jorge.
const STOPS = [
  { id: 'belem', lat: 38.6916, lng: -9.216, visitMinutes: 30 },
  { id: 'castelo', lat: 38.7139, lng: -9.1335, visitMinutes: 90 },
  { id: 'jeronimos', lat: 38.6979, lng: -9.2068, visitMinutes: 60 },
  { id: 'comercio', lat: 38.7075, lng: -9.1364, visitMinutes: 20 },
];

/** Recorded-shape VROOM response: jobs are STOPS[1..] by index (castelo=0, jeronimos=1, comercio=2). */
const VROOM_OK = {
  code: 0,
  summary: { cost: 900, routes: 1, unassigned: 0 },
  unassigned: [],
  routes: [{
    vehicle: 0,
    cost: 900,
    steps: [
      { type: 'start', location: [-9.216, 38.6916] },
      { type: 'job', id: 1, job: 1, location: [-9.2068, 38.6979] },
      { type: 'job', id: 2, job: 2, location: [-9.1364, 38.7075] },
      { type: 'job', id: 0, job: 0, location: [-9.1335, 38.7139] },
    ],
  }],
};

const DIRECTIONS_OK = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: {
      segments: [
        { distance: 1012.4, duration: 728.9, steps: [] },
        { distance: 7120.6, duration: 5126.8, steps: [] },
        { distance: 1003.2, duration: 722.3, steps: [] },
      ],
      summary: { distance: 9136.2, duration: 6578 },
      way_points: [0, 10, 50, 60],
    },
    geometry: {
      type: 'LineString',
      coordinates: [[-9.216, 38.6916], [-9.2068, 38.6979], [-9.1364, 38.7075], [-9.1335, 38.7139]],
    },
  }],
};

type Call = { url: string; options?: FetchJsonOptions };

function fakeOrsFetch(responses: { optimization?: unknown; directions?: unknown; error?: Error }) {
  const calls: Call[] = [];
  const fetchJson: FetchJson = <T>(url: string, options?: FetchJsonOptions) => {
    calls.push({ url, options });
    if (responses.error) return Promise.reject(responses.error);
    if (url.endsWith('/optimization')) return Promise.resolve(responses.optimization as T);
    if (url.includes('/v2/directions/foot-walking/geojson')) {
      return Promise.resolve(responses.directions as T);
    }
    return Promise.reject(new Error(`unexpected ${url}`));
  };
  return { fetchJson, calls };
}

function memoryStore() {
  const rows = new Map<string, { value: unknown; expiresAt: Date }>();
  const store: CacheStore = {
    get: (k, now) => {
      const r = rows.get(k);
      return Promise.resolve(r && r.expiresAt > now ? r.value : undefined);
    },
    set: (k, value, expiresAt) => {
      rows.set(k, { value, expiresAt });
      return Promise.resolve();
    },
    purgeExpired: () => Promise.resolve(),
  };
  return { store, rows };
}

async function post(deps: RouteDeps, body: unknown): Promise<Response> {
  return await createHandler(deps)(
    new Request('http://localhost/route-optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

async function ok(deps: RouteDeps, body: unknown): Promise<RouteResponse> {
  const res = await post(deps, body);
  assertEquals(res.status, 200, await res.clone().text());
  return routeResponseSchema.parse(await res.json());
}

Deno.test('route: ORS ordering from VROOM steps, legs and geometry from directions', async () => {
  const { fetchJson, calls } = fakeOrsFetch({
    optimization: VROOM_OK,
    directions: DIRECTIONS_OK,
  });
  const ors = createOrsRouting({ apiKey: 'test-key', fetchJson });
  const r = await ok({ ors, cached: noCache }, { stops: STOPS });

  assertEquals(r.order, ['belem', 'jeronimos', 'comercio', 'castelo']);
  assertEquals(r.legs, [
    { fromId: 'belem', toId: 'jeronimos', distanceM: 1012, durationS: 729 },
    { fromId: 'jeronimos', toId: 'comercio', distanceM: 7121, durationS: 5127 },
    { fromId: 'comercio', toId: 'castelo', distanceM: 1003, durationS: 722 },
  ]);
  assertEquals(r.geometry.coordinates.length, 4);
  assertEquals(r.distanceM, 1012 + 7121 + 1003);
  assertEquals(r.walkingSeconds, 729 + 5127 + 722);
  assertEquals(r.visitMinutes, 200);
  assertEquals(r.isFallback, false);
  assertEquals(r.provider, 'openrouteservice');
  assertEquals(r.attribution, ORS_ATTRIBUTION);

  // Request shapes
  const [opt, dir] = calls;
  assertEquals(opt!.options?.headers?.Authorization, 'test-key');
  const optBody = opt!.options?.body as {
    jobs: { id: number; location: number[]; service: number }[];
    vehicles: { profile: string; start: number[]; end?: number[] }[];
  };
  assertEquals(optBody.vehicles[0]!.profile, 'foot-walking');
  assertEquals(optBody.vehicles[0]!.start, [-9.216, 38.6916]);
  assertEquals(optBody.vehicles[0]!.end, undefined);
  assertEquals(optBody.jobs.map((j) => j.id), [0, 1, 2]);
  assertEquals(optBody.jobs[0]!.location, [-9.1335, 38.7139]);
  assertEquals(optBody.jobs.every((j) => j.service === 0), true);
  const dirBody = dir!.options?.body as { coordinates: number[][] };
  assertEquals(dirBody.coordinates[1], [-9.2068, 38.6979]);
});

Deno.test('route: no ORS key → fallback (cached 1 h)', async () => {
  const { store, rows } = memoryStore();
  const t0 = new Date('2026-09-27T00:00:00Z');
  const cached = createCached(store, { now: () => t0, random: () => 1 });
  const r = await ok({ ors: null, cached }, { stops: STOPS });
  assertEquals(r.isFallback, true);
  assertEquals(r.provider, 'fallback');
  assertEquals(r.attribution, FALLBACK_ATTRIBUTION);
  assertEquals(r.order[0], 'belem');
  assertEquals(new Set(r.order).size, 4);
  assertEquals(r.legs.length, 3);
  assertEquals(r.geometry.coordinates[0], [-9.216, 38.6916]);
  assertEquals(r.distanceM, r.legs.reduce((a, l) => a + l.distanceM, 0));
  const [row] = [...rows.values()];
  assertEquals(row!.expiresAt.getTime() - t0.getTime(), FALLBACK_TTL * 1000);
});

Deno.test('route: ORS error → fallback, not cached', async () => {
  const { store, rows } = memoryStore();
  const { fetchJson } = fakeOrsFetch({
    error: new HttpError('https://api.openrouteservice.org/optimization', 503, 'busy'),
  });
  const ors = createOrsRouting({ apiKey: 'k', fetchJson });
  const r = await ok({ ors, cached: createCached(store) }, { stops: STOPS });
  assertEquals(r.isFallback, true);
  assertEquals(r.provider, 'fallback');
  assertEquals(rows.size, 0);
});

Deno.test('route: malformed ORS response (unassigned job) → fallback', async () => {
  const { fetchJson } = fakeOrsFetch({
    optimization: { ...VROOM_OK, unassigned: [{ id: 2 }] },
    directions: DIRECTIONS_OK,
  });
  const ors = createOrsRouting({ apiKey: 'k', fetchJson });
  const r = await ok({ ors, cached: noCache }, { stops: STOPS });
  assertEquals(r.provider, 'fallback');
});

Deno.test('route: ORS results are cached for 30 days by normalized input', async () => {
  const { store, rows } = memoryStore();
  const { fetchJson, calls } = fakeOrsFetch({
    optimization: VROOM_OK,
    directions: DIRECTIONS_OK,
  });
  const deps = { ors: createOrsRouting({ apiKey: 'k', fetchJson }), cached: createCached(store) };
  await ok(deps, { stops: STOPS });
  // Same stops with sub-micro-degree noise hit the cache.
  const noisy = STOPS.map((s) => ({ ...s, lat: s.lat + 1e-9 }));
  const again = await ok(deps, { stops: noisy });
  assertEquals(again.provider, 'openrouteservice');
  assertEquals(calls.length, 2);
  const key = await cacheKey('route:ors', normalizeRouteInput({ stops: STOPS, keepFirst: true }));
  assert(rows.has(key));
});

Deno.test('route: keepFirst=false lets the optimiser pick the start', async () => {
  // Stops on a line, given in a bad order: the best open path starts at an end.
  const line = [
    { id: 'b', lat: 38.7, lng: -9.15, visitMinutes: 10 },
    { id: 'a', lat: 38.7, lng: -9.16, visitMinutes: 10 },
    { id: 'c', lat: 38.7, lng: -9.14, visitMinutes: 10 },
    { id: 'd', lat: 38.7, lng: -9.13, visitMinutes: 10 },
  ];
  const kept = await ok({ ors: null, cached: noCache }, { stops: line });
  assertEquals(kept.order[0], 'b');
  const free = await ok({ ors: null, cached: noCache }, { stops: line, keepFirst: false });
  assert(['a', 'd'].includes(free.order[0]!));
  assert(free.distanceM < kept.distanceM);
});

Deno.test('route: invalid input → 400', async () => {
  const deps = { ors: null, cached: noCache };
  const one = await post(deps, { stops: [STOPS[0]] });
  assertEquals(one.status, 400);
  assertEquals((await one.json()).error, 'bad_request');
  const dup = await post(deps, { stops: [STOPS[0], STOPS[0]] });
  assertEquals(dup.status, 400);
  const tooMany = await post(deps, {
    stops: Array.from({ length: 13 }, (_, i) => ({ ...STOPS[0], id: `s${i}` })),
  });
  assertEquals(tooMany.status, 400);
});

Deno.test('route: OPTIONS preflight and method not allowed', async () => {
  const handler = createHandler({ ors: null, cached: noCache });
  const pre = await handler(new Request('http://localhost/route-optimize', { method: 'OPTIONS' }));
  assertEquals(pre.status, 200);
  assertEquals(pre.headers.get('Access-Control-Allow-Origin'), '*');
  const get = await handler(new Request('http://localhost/route-optimize'));
  assertEquals(get.status, 405);
});
