import { describe, expect, it } from 'vitest';

import { optimizeOrder, optimizeOrderAnyStart, pathLength, type RoutePoint } from './route.ts';

/** Every ordering of `items` (fine for the ≤ 7 points used here). */
function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, i) =>
    permutations(items.filter((_, j) => j !== i)).map((rest) => [item, ...rest]),
  );
}

/** Shortest open path by trying every order; `fixedStart` keeps the first point first. */
function bruteForceLength(points: readonly RoutePoint[], fixedStart: boolean): number {
  const [first, ...rest] = points;
  const orders = fixedStart ? permutations(rest).map((p) => [first!, ...p]) : permutations(points);
  return Math.min(...orders.map(pathLength));
}

/** Deterministic pseudo-random points in central Lisbon. */
function randomPoints(count: number, seed: number): RoutePoint[] {
  let state = seed;
  const next = () => (state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    lat: 38.7 + next() * 0.03,
    lng: -9.16 + next() * 0.05,
  }));
}

const ids = (points: readonly RoutePoint[]) => points.map((p) => p.id).join('');

describe('optimizeOrder', () => {
  it('finds the shortest path where nearest neighbour + 2-opt did not (8.1 km → 7.3 km)', () => {
    // Regression: the previous heuristic walked a→b→c→d→e (8081 m) from a.
    const lisbon: RoutePoint[] = [
      { id: 'a', lat: 38.7222, lng: -9.1568 },
      { id: 'b', lat: 38.7185, lng: -9.1352 },
      { id: 'c', lat: 38.7061, lng: -9.1154 },
      { id: 'd', lat: 38.7021, lng: -9.1199 },
      { id: 'e', lat: 38.7044, lng: -9.1586 },
    ];
    const order = optimizeOrder(lisbon);
    expect(ids(order)).toBe('aebcd');
    expect(Math.round(pathLength(order))).toBe(7345);
  });

  it('matches brute force on random routes and keeps the first stop', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const points = randomPoints(3 + (seed % 5), seed);
      const order = optimizeOrder(points);
      expect(order[0]).toBe(points[0]);
      expect(new Set(order).size).toBe(points.length);
      expect(pathLength(order)).toBeCloseTo(bruteForceLength(points, true), 6);
    }
  });

  it('orders the 12-stop maximum in a few milliseconds', () => {
    const points = randomPoints(12, 99);
    const started = Date.now();
    optimizeOrder(points);
    expect(Date.now() - started).toBeLessThan(50);
  });
});

describe('optimizeOrderAnyStart', () => {
  it('matches brute force over every start', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const points = randomPoints(3 + (seed % 5), seed);
      expect(pathLength(optimizeOrderAnyStart(points))).toBeCloseTo(
        bruteForceLength(points, false),
        6,
      );
    }
  });

  it('starts at an end of a line of stops', () => {
    const line = [0.02, 0, 0.01, 0.03].map((lng, i) => ({ id: `${i}`, lat: 38.7, lng }));
    // Both directions are equally short; the one starting from the earlier-listed end wins.
    expect(ids(optimizeOrderAnyStart(line))).toBe('1203');
  });

  it('rejects too few stops, naming the count', () => {
    expect(() => optimizeOrderAnyStart(randomPoints(1, 1))).toThrow('got 1');
  });
});
