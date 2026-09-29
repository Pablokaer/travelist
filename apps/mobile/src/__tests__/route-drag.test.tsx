import { fireEvent, render, screen } from '@testing-library/react-native';

import type { AttractionSummary } from '@/features/destinations/api';
import { RouteStopList } from '@/features/route/route-plan';
import '@/lib/i18n';

const place = (id: string, km: number): AttractionSummary => ({
  id,
  citySlug: 'lisbon',
  nameEn: `Place ${id}`,
  namePt: null,
  category: 'museum',
  lat: 38.7,
  lng: -9.2 + km / 86.8,
  popularity: 1,
  avgVisitMinutes: 30,
  imageUrl: null,
  isUnesco: false,
});

/** A single-finger touch history, as the responder system hands it to PanResponder. */
class FakeTouchHistory {
  numberActiveTouches = 1;
  indexOfSingleActiveTouch = 0;
  mostRecentTimeStamp = 0;
  touchBank: Record<string, number | boolean>[];

  constructor(startY: number, currentY: number) {
    this.mostRecentTimeStamp = Date.now();
    const touch = { startPageX: 0, currentPageX: 0, previousPageX: 0, startPageY: startY };
    this.touchBank = [
      {
        ...touch,
        touchActive: true,
        currentPageY: currentY,
        previousPageY: startY,
        currentTimeStamp: this.mostRecentTimeStamp,
        previousTimeStamp: this.mostRecentTimeStamp,
        startTimeStamp: this.mostRecentTimeStamp,
      },
    ];
  }
}

function renderList(onMoveTo: jest.Mock, onDragActive: jest.Mock) {
  render(
    <RouteStopList
      route={[place('a', 0), place('b', 1), place('c', 2)]}
      routeIndex={0}
      routeCount={1}
      splittable={false}
      units="metric"
      onMove={jest.fn()}
      onMoveTo={onMoveTo}
      onRemove={jest.fn()}
      onSplitAt={jest.fn()}
      onDragActive={onDragActive}
    />,
  );
  [0, 1, 2].forEach((i) =>
    fireEvent(screen.getByTestId(`route-0-stop-${i}`), 'layout', {
      nativeEvent: { layout: { x: 0, y: i * 100, width: 300, height: 96 } },
    }),
  );
}

function dragStop(index: number, dy: number) {
  const handle = screen.getByTestId(`drag-stop-${index}`);
  const event = (y: number) => ({ touchHistory: new FakeTouchHistory(0, y), nativeEvent: {} });
  fireEvent(handle, 'responderGrant', event(0));
  fireEvent(handle, 'responderMove', event(dy));
  fireEvent(handle, 'responderRelease', event(dy));
}

test('dragging the first stop below the last makes it the last stop', () => {
  const onMoveTo = jest.fn();
  const onDragActive = jest.fn();
  renderList(onMoveTo, onDragActive);
  dragStop(0, 230);
  expect(onMoveTo).toHaveBeenCalledWith('a', 2);
  expect(onDragActive.mock.calls).toEqual([[true], [false]]);
});

test('a short drag leaves the order alone', () => {
  const onMoveTo = jest.fn();
  renderList(onMoveTo, jest.fn());
  dragStop(1, 30);
  expect(onMoveTo).not.toHaveBeenCalled();
});

test('the grip is labelled with the stop name', () => {
  renderList(jest.fn(), jest.fn());
  expect(screen.getByLabelText('Drag Place b to reorder')).toBeTruthy();
});
