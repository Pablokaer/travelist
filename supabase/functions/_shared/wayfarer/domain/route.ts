import { ROUTE_MAX_STOPS, ROUTE_MIN_STOPS } from '../constants/index.ts';
import type { LatLng } from '../schemas/common.ts';
import { estimateWalkingMeters, haversineMeters, walkingSeconds } from './geo.ts';

export type RoutePoint = LatLng & { id: string };

/** Straight-line length of an open path, in metres. */
export function pathLength(order: readonly RoutePoint[]): number {
  let total = 0;
  for (let i = 1; i < order.length; i++) total += haversineMeters(order[i - 1]!, order[i]!);
  return total;
}

function assertStopCount(points: readonly RoutePoint[]): void {
  if (points.length < ROUTE_MIN_STOPS || points.length > ROUTE_MAX_STOPS) {
    throw new RangeError(
      `a route needs between ${ROUTE_MIN_STOPS} and ${ROUTE_MAX_STOPS} stops, got ${points.length}`,
    );
  }
}

/** Pairwise straight-line distances, in metres. */
function distanceMatrix(points: readonly RoutePoint[]): number[][] {
  return points.map((a) => points.map((b) => haversineMeters(a, b)));
}

/** Held-Karp tables: `cost[mask·n + last]` is the shortest path over `mask` ending at `last`. */
type PathTables = { n: number; cost: Float64Array; prev: Int8Array };

/** Relaxes every path over `mask` by one more stop. */
function extendPaths(d: readonly number[][], mask: number, t: PathTables): void {
  for (let last = 0; last < t.n; last++) {
    const here = t.cost[mask * t.n + last]!;
    if (here === Infinity) continue;
    for (let next = 0; next < t.n; next++) {
      if (mask & (1 << next)) continue;
      const slot = (mask | (1 << next)) * t.n + next;
      const cost = here + d[last]![next]!;
      // Strict comparison (lowest index wins ties) keeps the result deterministic.
      if (cost < t.cost[slot]! - 1e-9) [t.cost[slot], t.prev[slot]] = [cost, last];
    }
  }
}

/** Walks the `prev` links back from the cheapest complete path. */
function tracePath(t: PathTables): number[] {
  let mask = (1 << t.n) - 1;
  let last = 0;
  for (let j = 1; j < t.n; j++) if (t.cost[mask * t.n + j]! < t.cost[mask * t.n + last]!) last = j;
  const order: number[] = [];
  while (last >= 0) {
    order.push(last);
    const prev = t.prev[mask * t.n + last]!;
    mask &= ~(1 << last);
    last = prev;
  }
  return order.reverse();
}

/**
 * Exact shortest open path by dynamic programming over subsets (Held-Karp): O(2ⁿ·n²), about
 * 1 ms for the 12-stop maximum. It replaced nearest neighbour + 2-opt, which walked up to 21%
 * further on 46% of random 12-stop routes. `start` fixes the first stop; null lets any start.
 */
function shortestOpenPath(d: readonly number[][], start: number | null): number[] {
  const n = d.length;
  const size = (1 << n) * n;
  const t: PathTables = {
    n,
    cost: new Float64Array(size).fill(Infinity),
    prev: new Int8Array(size).fill(-1),
  };
  for (let j = 0; j < n; j++) if (start === null || j === start) t.cost[(1 << j) * n + j] = 0;
  for (let mask = 1; mask < 1 << n; mask++) extendPaths(d, mask, t);
  const order = tracePath(t);
  // With a free start a path and its reverse are equally short: start from the stop listed
  // first, so e.g. the second half of a split carries on from where the first one ended.
  return start === null && order[order.length - 1]! < order[0]! ? order.reverse() : order;
}

/**
 * Orders stops into the shortest open walking path (straight-line distance) that starts at the
 * first stop. Exact and deterministic for 2–12 stops.
 * @example optimizeOrder([hotel, castle, museum]) // [hotel, museum, castle]
 */
export function optimizeOrder<T extends RoutePoint>(points: readonly T[]): T[] {
  assertStopCount(points);
  return shortestOpenPath(distanceMatrix(points), 0).map((i) => points[i]!);
}

/**
 * Shortest open walking path over the stops starting from whichever stop makes it shortest
 * (one exact pass, instead of optimising once per candidate start).
 * @example optimizeOrderAnyStart([mid, west, east]) // [west, mid, east]
 */
export function optimizeOrderAnyStart<T extends RoutePoint>(points: readonly T[]): T[] {
  assertStopCount(points);
  return shortestOpenPath(distanceMatrix(points), null).map((i) => points[i]!);
}

export type RouteLeg = { fromId: string; toId: string; distanceM: number; durationS: number };

/** Straight-line legs scaled to an estimated street distance. */
export function estimateLegs(order: readonly RoutePoint[]): RouteLeg[] {
  const legs: RouteLeg[] = [];
  for (let i = 1; i < order.length; i++) {
    const distanceM = Math.round(estimateWalkingMeters(haversineMeters(order[i - 1]!, order[i]!)));
    legs.push({
      fromId: order[i - 1]!.id,
      toId: order[i]!.id,
      distanceM,
      durationS: walkingSeconds(distanceM),
    });
  }
  return legs;
}
