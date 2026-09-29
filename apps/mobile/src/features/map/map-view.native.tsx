import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';

import {
  circlePaint,
  labelLayout,
  routePaint,
  toFeatureCollection,
  toRouteFeature,
  type MapPoint,
  type MapViewProps,
} from './map-view.types';
import { MARKER_SELECTED_SIZE, PhotoMarker } from './photo-marker';

/** Photo markers as native map annotations (D-029); the selected one is drawn last, on top. */
function PhotoMarkers({ points, onPress }: { points: MapPoint[]; onPress?: (id: string) => void }) {
  const ordered = [...points.filter((p) => !p.selected), ...points.filter((p) => p.selected)];
  return ordered.map((p) => (
    <Marker
      key={p.id}
      id={p.id}
      lngLat={[p.lng, p.lat]}
      onPress={() => onPress?.(p.id)}
      accessibilityLabel={p.name}
      accessibilityRole="button">
      <PhotoMarker
        imageUrl={p.imageUrl ?? null}
        name={p.name ?? ''}
        selected={p.selected}
        order={p.order}
      />
    </Marker>
  ));
}

export function MapView({
  styleUrl,
  bounds,
  points,
  routes,
  onPointPress,
  markers = 'circle',
  selectedId,
  popup,
  onMapPress,
  style,
  testID,
  accessibilityLabel,
}: MapViewProps) {
  const camera = useRef<CameraRef>(null);
  const photo = markers === 'photo';
  // Photo markers are annotations, so the dot layer stays empty.
  const pointsData = useMemo(() => toFeatureCollection(photo ? [] : points), [photo, points]);
  const selected = photo ? points.find((p) => p.id === selectedId) : undefined;
  const routeData = useMemo(() => toRouteFeature(routes), [routes]);
  const boundsKey = bounds.join(',');

  useEffect(() => {
    camera.current?.fitBounds(bounds, {
      padding: { top: 40, right: 40, bottom: 40, left: 40 },
      duration: 600,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- compare by value
  }, [boundsKey]);

  return (
    <View
      style={[{ flex: 1, minHeight: 240 }, style]}
      testID={testID}
      accessibilityLabel={accessibilityLabel}>
      <Map
        style={{ flex: 1 }}
        mapStyle={styleUrl}
        attribution
        logo={false}
        compass={false}
        // Marker presses are handled by the markers; a press here is on the map itself.
        onPress={photo ? () => onMapPress?.() : undefined}>
        <Camera ref={camera} initialViewState={{ bounds }} />
        <GeoJSONSource id="route" data={routeData}>
          <Layer
            type="line"
            id="route-line"
            paint={routePaint as never}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          />
        </GeoJSONSource>
        <GeoJSONSource
          id="points"
          data={pointsData}
          onPress={(e) => {
            const id = e.nativeEvent.features?.[0]?.properties?.id;
            if (typeof id === 'string') onPointPress?.(id);
          }}>
          <Layer type="circle" id="points-circle" paint={circlePaint as never} />
          <Layer
            type="symbol"
            id="points-label"
            layout={labelLayout as never}
            paint={{ 'text-color': '#FFFFFF' }}
          />
        </GeoJSONSource>
        {photo ? <PhotoMarkers points={points} onPress={onPointPress} /> : null}
        {selected && popup ? (
          <Marker
            lngLat={[selected.lng, selected.lat]}
            anchor="bottom"
            offset={[0, -(MARKER_SELECTED_SIZE / 2 + 8)]}>
            <View>{popup}</View>
          </Marker>
        ) : null}
      </Map>
    </View>
  );
}
