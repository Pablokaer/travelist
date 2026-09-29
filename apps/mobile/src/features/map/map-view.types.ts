import type { LineString } from '@wayfarer/shared';
import type { StyleProp, ViewStyle } from 'react-native';

import { palette } from '@/theme/colors';

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  color: string;
  /** Selected points are drawn larger with a ring. */
  selected?: boolean;
  /** 1-based position when the point is a route stop. */
  order?: number;
};

/** One walking route drawn on the map; split routes each get their own colour. */
export type RouteLine = { geometry: LineString; color: string };

export type MapViewProps = {
  styleUrl: string;
  /** Initial / target viewport: [west, south, east, north]. */
  bounds: [number, number, number, number];
  points: MapPoint[];
  routes?: RouteLine[];
  onPointPress?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
};

export function toFeatureCollection(points: MapPoint[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature',
      id: p.id,
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id,
        color: p.color,
        selected: p.selected ? 1 : 0,
        label: p.order ? String(p.order) : '',
      },
    })),
  };
}

export function toRouteFeature(routes: RouteLine[] | undefined): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: (routes ?? []).map((r) => ({
      type: 'Feature',
      geometry: r.geometry,
      properties: { color: r.color },
    })),
  };
}

/** Bounds that contain every point, padded; falls back to the given bounds. */
export function boundsOf(
  points: { lat: number; lng: number }[],
  fallback: [number, number, number, number],
): [number, number, number, number] {
  if (points.length === 0) return fallback;
  const lngs = points.map((p) => p.lng);
  const lats = points.map((p) => p.lat);
  const pad = 0.004;
  return [
    Math.min(...lngs) - pad,
    Math.min(...lats) - pad,
    Math.max(...lngs) + pad,
    Math.max(...lats) + pad,
  ];
}

export const circlePaint = {
  'circle-color': ['get', 'color'],
  'circle-radius': ['case', ['==', ['get', 'selected'], 1], 11, 7],
  'circle-stroke-color': '#FFFFFF',
  'circle-stroke-width': ['case', ['==', ['get', 'selected'], 1], 3, 1.5],
} as const;

export const labelLayout = {
  'text-field': ['get', 'label'],
  'text-size': 12,
  'text-font': ['Noto Sans Bold'],
  'text-allow-overlap': true,
} as const;

export const routePaint = {
  'line-color': ['coalesce', ['get', 'color'], palette.light.primary],
  'line-width': 4,
  'line-opacity': 0.85,
} as const;
