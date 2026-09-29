// Adding a place to the route tray within the plan's places per list (D-047): one hook for the
// city page and the attraction page, so the limit is read in one place.
import { ROUTE_MAX_STOPS, itemCapacity } from '@wayfarer/shared';
import { useCallback } from 'react';

import { useRouteStore, type ToggleOutcome } from '@/features/route/store';
import { useMySubscription } from '@/features/subscription/api';

type Stop = Parameters<ReturnType<typeof useRouteStore.getState>['toggle']>[0];

/**
 * `toggle` with the caller's plan capacity; until the plan is known, the technical limit.
 * @example const toggle = useToggleStop(); const outcome = toggle(place); // 'planLimit'
 */
export function useToggleStop(): (stop: Stop) => ToggleOutcome {
  const toggle = useRouteStore((s) => s.toggle);
  const plan = useMySubscription().data?.plan;
  const capacity = plan ? itemCapacity(plan.rules, ROUTE_MAX_STOPS) : ROUTE_MAX_STOPS;
  return useCallback((stop) => toggle(stop, capacity), [toggle, capacity]);
}
