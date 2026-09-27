import { ROUTE_MAX_STOPS, ROUTE_MIN_STOPS } from '../constants/index.ts';
import type { LatLng } from '../schemas/common.ts';
import { estimateWalkingMeters, haversineMeters, walkingSeconds } from './geo.ts';

export type RoutePoint = LatLng & { id: string };

function pathLength(order: readonly RoutePoint[]): number {
  let total = 0;
  for (let i = 1; i < order.length; i++) total += haversineMeters(order[i - 1]!, order[i]!);
  return total;
}

/**
 * Orders stops for an open walking path starting at the first stop, using nearest neighbour
 * followed by 2-opt improvement. Deterministic; fine for ≤ 12 stops.
 */
export function optimizeOrder(points: readonly RoutePoint[]): RoutePoint[] {
  if (points.length < ROUTE_MIN_STOPS || points.length > ROUTE_MAX_STOPS) {
    throw new RangeError(`a route needs between ${ROUTE_MIN_STOPS} and ${ROUTE_MAX_STOPS} stops`);
  }
  const [start, ...rest] = points;
  const order: RoutePoint[] = [start!];
  const remaining = [...rest];
  while (remaining.length) {
    const last = order[order.length - 1]!;
    let bestIdx = 0;
    let bestDist = Infinity;
    remaining.forEach((p, i) => {
      const d = haversineMeters(last, p);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    });
    order.push(remaining.splice(bestIdx, 1)[0]!);
  }

  // 2-opt on the open path; index 0 stays fixed.
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < order.length - 1; i++) {
      for (let k = i + 1; k < order.length; k++) {
        const candidate = [
          ...order.slice(0, i),
          ...order.slice(i, k + 1).reverse(),
          ...order.slice(k + 1),
        ];
        if (pathLength(candidate) + 1e-6 < pathLength(order)) {
          order.splice(0, order.length, ...candidate);
          improved = true;
        }
      }
    }
  }
  return order;
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
