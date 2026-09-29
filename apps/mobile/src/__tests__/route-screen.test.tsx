import { render, screen } from '@testing-library/react-native';
import { act } from 'react';

import RouteScreen from '@/app/route';
import type { AttractionSummary } from '@/features/destinations/api';
import { useRouteStore } from '@/features/route/store';
import '@/lib/i18n';

/** Server hooks without a backend: no cities or profile loaded, mutations idle. */
class MockServerHooks {
  static query = () => ({ data: undefined });
  static mutation = () => ({ mutate: jest.fn(), isPending: false, error: null });
}

jest.mock('@/features/destinations/api', () => ({
  ...jest.requireActual('@/features/destinations/api'),
  useCities: () => MockServerHooks.query(),
}));
jest.mock('@/features/profile/api', () => ({ useProfile: () => MockServerHooks.query() }));
jest.mock('@/features/trips/api', () => ({ useSaveTrips: () => MockServerHooks.mutation() }));
jest.mock('@/features/route/api', () => ({
  ...jest.requireActual('@/features/route/api'),
  useOptimizeRoutes: () => MockServerHooks.mutation(),
}));

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

beforeEach(() => {
  useRouteStore.getState().clear();
  [0, 1, 2].forEach((km) => useRouteStore.getState().add(place(`s${km}`, km)));
});

test('reordering a stop updates the list in place instead of rebuilding it', () => {
  render(<RouteScreen />);
  const list = screen.getByTestId('route-0');
  act(() => useRouteStore.getState().move('s2', -1));
  const rebuilt = screen.getByTestId('route-0') !== list;
  expect(rebuilt).toBe(false);
  expect(screen.getByTestId('route-0-stop-1')).toHaveTextContent(/Place s2/);
});
