import { ROUTE_MAX_STOPS } from '@wayfarer/shared';
import { create } from 'zustand';

import type { AttractionSummary } from '@/features/destinations/api';

/** What `toggle` did: the tray only holds one city and at most ROUTE_MAX_STOPS stops. */
export type ToggleOutcome = 'added' | 'removed' | 'full' | 'startedNewCity';

type RouteState = {
  citySlug: string | null;
  stops: AttractionSummary[];
  /** Returns false when the tray is full or the stop belongs to another city. */
  add: (stop: AttractionSummary) => boolean;
  remove: (id: string) => void;
  /**
   * Adds or removes a stop. A stop from another city replaces the tray (new route); a full tray
   * is left unchanged.
   * @example const outcome = useRouteStore.getState().toggle(attraction); // 'added'
   */
  toggle: (stop: AttractionSummary) => ToggleOutcome;
  move: (id: string, direction: -1 | 1) => void;
  setOrder: (ids: string[]) => void;
  clear: () => void;
};

export const useRouteStore = create<RouteState>((set, get) => ({
  citySlug: null,
  stops: [],
  add: (stop) => {
    const { stops, citySlug } = get();
    if (stops.some((s) => s.id === stop.id)) return true;
    if (citySlug && citySlug !== stop.citySlug && stops.length > 0) return false;
    if (stops.length >= ROUTE_MAX_STOPS) return false;
    set({ citySlug: stop.citySlug, stops: [...stops, stop] });
    return true;
  },
  toggle: (stop) => {
    const { stops, add, remove } = get();
    if (stops.some((s) => s.id === stop.id)) {
      remove(stop.id);
      return 'removed';
    }
    if (add(stop)) return 'added';
    if (stops.length >= ROUTE_MAX_STOPS) return 'full';
    set({ citySlug: stop.citySlug, stops: [stop] });
    return 'startedNewCity';
  },
  remove: (id) =>
    set((s) => {
      const stops = s.stops.filter((x) => x.id !== id);
      return { stops, citySlug: stops.length ? s.citySlug : null };
    }),
  move: (id, direction) =>
    set((s) => {
      const i = s.stops.findIndex((x) => x.id === id);
      const j = i + direction;
      if (i < 0 || j < 0 || j >= s.stops.length) return s;
      const stops = [...s.stops];
      [stops[i], stops[j]] = [stops[j]!, stops[i]!];
      return { stops };
    }),
  setOrder: (ids) =>
    set((s) => ({
      stops: ids
        .map((id) => s.stops.find((x) => x.id === id))
        .filter((x): x is AttractionSummary => !!x),
    })),
  clear: () => set({ stops: [], citySlug: null }),
}));
