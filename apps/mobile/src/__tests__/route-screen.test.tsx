import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { PlanLimitError } from '@/features/subscription/api';
import { freeSubscription, premiumSubscription } from '@/testing/subscription';
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
  static optimized: unknown[] = [];
  static subscription: unknown = jest.requireActual('@/testing/subscription').freeSubscription();
  static saveError: Error | null = null;
  static save = () => ({
    mutate: (inputs: unknown) => MockServerHooks.saved.push(inputs),
    isPending: false,
    error: MockServerHooks.saveError,
  });
}

jest.mock('@/features/destinations/api', () => ({
  ...jest.requireActual('@/features/destinations/api'),
  useCities: () => ({ data: MockServerHooks.cities }),
}));
jest.mock('@/features/profile/api', () => ({ useProfile: () => MockServerHooks.query() }));
jest.mock('@/features/subscription/api', () => ({
  ...jest.requireActual('@/features/subscription/api'),
  useMySubscription: () => ({ data: MockServerHooks.subscription }),
}));
jest.mock('@/features/trips/api', () => ({ useSaveTrips: () => MockServerHooks.save() }));
jest.mock('@/features/route/api', () => ({
  ...jest.requireActual('@/features/route/api'),
  useOptimizeRoutes: () => ({
    mutate: (input: unknown) => MockServerHooks.optimized.push(input),
    isPending: false,
    error: null,
  }),
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
  MockServerHooks.optimized = [];
  MockServerHooks.subscription = jest.requireActual('@/testing/subscription').freeSubscription();
  MockServerHooks.saveError = null;
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

describe('the walking path follows the order shown (D-046)', () => {
  test('in automatic order the server may reorder the stops for the shortest walk', async () => {
    render(<RouteScreen />);
    await userEvent.press(screen.getByTestId('optimize'));
    expect(MockServerHooks.optimized).toEqual([expect.objectContaining({ keepOrder: false })]);
  });

  test('an order set by hand is kept: only the street path is asked for', async () => {
    act(() => useRouteStore.getState().move('s2', -1));
    render(<RouteScreen />);
    await userEvent.press(screen.getByTestId('optimize'));
    expect(MockServerHooks.optimized).toEqual([expect.objectContaining({ keepOrder: true })]);
  });
});

describe('saving within the plan (D-047)', () => {
  test('Free with 5 lists cannot save a sixth: the limit is explained, nothing is sent', async () => {
    MockServerHooks.subscription = freeSubscription(5);
    render(<RouteScreen />);
    await userEvent.press(screen.getByTestId('save-trip'));
    expect(screen.getByText("You've reached the Free plan limit of 5 lists.")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Upgrade to Premium' })).toBeOnTheScreen();
    expect(MockServerHooks.saved).toEqual([]);
  });

  test('Free cannot save a list of more than 5 places (e.g. kept from before)', async () => {
    ['s3', 's4', 's5'].forEach((id, k) => useRouteStore.getState().add(place(id, k + 3)));
    render(<RouteScreen />);
    await userEvent.press(screen.getByTestId('save-trip'));
    expect(screen.getByText('Free accounts can add up to 5 places per list.')).toBeOnTheScreen();
    expect(MockServerHooks.saved).toEqual([]);
  });

  test('Premium saves beyond the Free limits', async () => {
    MockServerHooks.subscription = premiumSubscription(9);
    ['s3', 's4', 's5'].forEach((id, k) => useRouteStore.getState().add(place(id, k + 3)));
    render(<RouteScreen />);
    await userEvent.press(screen.getByTestId('save-trip'));
    expect(MockServerHooks.saved).toHaveLength(1);
  });

  test('a limit enforced by the server is explained the same way', () => {
    MockServerHooks.saveError = new PlanLimitError('lists', 'plan limit');
    render(<RouteScreen />);
    expect(screen.getByText("You've reached the Free plan limit of 5 lists.")).toBeOnTheScreen();
  });
});
