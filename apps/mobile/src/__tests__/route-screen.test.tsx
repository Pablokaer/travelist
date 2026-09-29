import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { zonedToUtc } from '@wayfarer/shared';
import { act } from 'react';

import RouteScreen from '@/app/route';
import type { AttractionSummary } from '@/features/destinations/api';
import { useRouteStore } from '@/features/route/store';
import '@/lib/i18n';

/** Server hooks without a backend: no cities or profile loaded, mutations idle. */
class MockServerHooks {
  static query = () => ({ data: undefined });
  static mutation = () => ({ mutate: jest.fn(), isPending: false, error: null });
  /** The cities `useCities` returns (none by default) and the trips sent to save. */
  static cities: unknown[] | undefined;
  static saved: unknown[] = [];
  static save = () => ({
    mutate: (inputs: unknown) => MockServerHooks.saved.push(inputs),
    isPending: false,
    error: null,
  });
}

jest.mock('@/features/destinations/api', () => ({
  ...jest.requireActual('@/features/destinations/api'),
  useCities: () => ({ data: MockServerHooks.cities }),
}));
jest.mock('@/features/profile/api', () => ({ useProfile: () => MockServerHooks.query() }));
jest.mock('@/features/trips/api', () => ({ useSaveTrips: () => MockServerHooks.save() }));
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
  MockServerHooks.cities = undefined;
  MockServerHooks.saved = [];
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

describe('a start time makes the list a meetup (D-041)', () => {
  // A date a month from now, so the start is always in the future.
  const future = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  beforeEach(() => {
    MockServerHooks.cities = [
      jest
        .requireActual('@/testing/fixtures')
        .fakeCity({ slug: 'lisbon', timezone: 'Europe/Lisbon' }),
    ];
  });

  test('a date and a time are saved as the start, read in the city time', async () => {
    render(<RouteScreen />);
    fireEvent.changeText(screen.getByTestId('trip-date'), future);
    fireEvent.changeText(screen.getByTestId('trip-time'), '10:00');
    await userEvent.press(screen.getByTestId('save-trip'));
    expect(MockServerHooks.saved).toEqual([
      [
        expect.objectContaining({
          startsAt: zonedToUtc(future, '10:00', 'Europe/Lisbon').toISOString(),
        }),
      ],
    ]);
  });

  test('without a time the list is saved without a start', async () => {
    render(<RouteScreen />);
    await userEvent.press(screen.getByTestId('save-trip'));
    expect(MockServerHooks.saved).toEqual([[expect.objectContaining({ startsAt: null })]]);
  });

  test('a start in the past, or a time without a date, is refused', async () => {
    render(<RouteScreen />);
    fireEvent.changeText(screen.getByTestId('trip-date'), '2020-01-01');
    fireEvent.changeText(screen.getByTestId('trip-time'), '10:00');
    await userEvent.press(screen.getByTestId('save-trip'));
    expect(await screen.findByText('Choose a date and time in the future.')).toBeOnTheScreen();
    fireEvent.changeText(screen.getByTestId('trip-date'), '');
    await userEvent.press(screen.getByTestId('save-trip'));
    expect(await screen.findByText('Choose a date for this time.')).toBeOnTheScreen();
    expect(MockServerHooks.saved).toEqual([]);
  });
});
