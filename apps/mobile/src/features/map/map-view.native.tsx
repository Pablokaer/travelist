import { Camera, GeoJSONSource, Layer, Map, type CameraRef } from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useRef } from 'react';
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
  route,
  onPointPress,
  style,
  testID,
  accessibilityLabel,
}: MapViewProps) {
  const camera = useRef<CameraRef>(null);
  const pointsData = useMemo(() => toFeatureCollection(points), [points]);
  const routeData = useMemo(() => toRouteFeature(route), [route]);
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
      <Map style={{ flex: 1 }} mapStyle={styleUrl} attribution logo={false} compass={false}>
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
      </Map>
    </View>
  );
}
