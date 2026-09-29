// Web implementation (maplibre-gl). Native lives in map-view.native.tsx.
import 'maplibre-gl/dist/maplibre-gl.css';

import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import {
  circlePaint,
  labelLayout,
  routePaint,
  toFeatureCollection,
  toRouteFeature,
  type MapViewProps,
} from './map-view.types';

export function MapView({
  styleUrl,
  bounds,
  points,
  routes,
  onPointPress,
  style,
  testID,
  accessibilityLabel,
}: MapViewProps) {
  const container = useRef<View>(null);
  const map = useRef<MapLibreMap | null>(null);
  const loaded = useRef(false);
  const latest = useRef({ points, routes, onPointPress });
  useEffect(() => {
    latest.current = { points, routes, onPointPress };
  }, [points, routes, onPointPress]);

  // Create the map once (client-side only; never during static rendering).
  useEffect(() => {
    let cancelled = false;
    let instance: MapLibreMap | null = null;
    void import('maplibre-gl').then((maplibregl) => {
      const el = container.current as unknown as HTMLElement | null;
      if (cancelled || !el) return;
      // Served from public/ (see scripts/copy-maplibre-worker.mjs).
      maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
      const created = new maplibregl.Map({
        container: el,
        style: styleUrl,
        bounds,
        fitBoundsOptions: { padding: 40 },
        attributionControl: { compact: true },
      });
      instance = created;
      created.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      created.on('load', () => {
        const m = created;
        m.addSource('route', { type: 'geojson', data: toRouteFeature(latest.current.routes) });
        m.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          paint: routePaint as never,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
        });
        m.addSource('points', {
          type: 'geojson',
          data: toFeatureCollection(latest.current.points),
        });
        m.addLayer({
          id: 'points-circle',
          type: 'circle',
          source: 'points',
          paint: circlePaint as never,
        });
        m.addLayer({
          id: 'points-label',
          type: 'symbol',
          source: 'points',
          layout: labelLayout as never,
          paint: { 'text-color': '#FFFFFF' },
        });
        m.on('click', 'points-circle', (e) => {
          const id = e.features?.[0]?.properties?.id;
          if (typeof id === 'string') latest.current.onPointPress?.(id);
        });
        m.on('mouseenter', 'points-circle', () => (m.getCanvas().style.cursor = 'pointer'));
        m.on('mouseleave', 'points-circle', () => (m.getCanvas().style.cursor = ''));
        loaded.current = true;
      });
      map.current = created;
    });
    return () => {
      cancelled = true;
      loaded.current = false;
      instance?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the map is created once per style
  }, [styleUrl]);

  useEffect(() => {
    if (!loaded.current) return;
    (map.current?.getSource('points') as GeoJSONSource | undefined)?.setData(
      toFeatureCollection(points),
    );
  }, [points]);

  useEffect(() => {
    if (!loaded.current) return;
    (map.current?.getSource('route') as GeoJSONSource | undefined)?.setData(toRouteFeature(routes));
  }, [routes]);

  const boundsKey = bounds.join(',');
  useEffect(() => {
    map.current?.fitBounds(bounds, { padding: 40, duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- compare by value
  }, [boundsKey]);

  return (
    <View
      ref={container}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      style={[{ flex: 1, minHeight: 240, overflow: 'hidden' }, style]}
    />
  );
}
