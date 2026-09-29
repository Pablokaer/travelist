import { render, screen } from '@testing-library/react-native';

import TripScreen from '@/app/trip/[id]';
import type { TripDetail } from '@/features/trips/api';
import '@/lib/i18n';

/** The owner's trip and whether they are a moderator. */
class MockOwnTripServer {
  /** null: the trip is not the caller's (RLS returns no row). */
  static trip: TripDetail | null;
  static moderator = false;
}

jest.mock('expo-router', () => {
  const { Text: MockText } = jest.requireActual('react-native');
  const MockRedirect = ({ href }: { href: unknown }) => (
    <MockText testID="redirect">{JSON.stringify(href)}</MockText>
  );
  return {
    Stack: { Screen: () => null },
    useLocalSearchParams: () => ({ id: 't1' }),
    router: { push: jest.fn(), back: jest.fn() },
    Redirect: MockRedirect,
  };
});
jest.mock('@/features/trips/api', () => ({
  ...jest.requireActual('@/features/trips/api'),
  useTrip: () => ({ isPending: false, isError: false, data: MockOwnTripServer.trip }),
  useDeleteTrip: () => ({ isPending: false, mutate: jest.fn() }),
}));
jest.mock('@/features/trips/sharing-api', () => ({
  ...jest.requireActual('@/features/trips/sharing-api'),
  useSetTripVisibility: () => ({ isPending: false, error: null, mutate: jest.fn() }),
}));
jest.mock('@/features/trips/community-api', () => ({
  ...jest.requireActual('@/features/trips/community-api'),
  useIsModerator: () => ({ data: MockOwnTripServer.moderator }),
  useSetTripOfficial: () => ({ isPending: false, error: null, mutate: jest.fn() }),
}));
jest.mock('@/features/reviews/api', () => ({
  ...jest.requireActual('@/features/reviews/api'),
  useReviews: () => ({ data: [], isPending: false }),
  useRatingSummary: () => ({ data: { count: 1, average: 5 } }),
}));
jest.mock('@/features/profile/api', () => ({ useProfile: () => ({ data: undefined }) }));

const trip = (over: Partial<TripDetail> = {}): TripDetail => ({
  id: 't1',
  name: 'My canal day',
  citySlug: 'amsterdam',
  tripDate: null,
  distanceM: 3000,
  walkingSeconds: 2400,
  visitMinutes: 90,
  stopCount: 0,
  createdAt: '2026-09-01T10:00:00Z',
  visibility: 'public',
  isOfficial: false,
  geometry: null,
  isFallback: false,
  provider: null,
  stops: [],
  ...over,
});

beforeEach(() => {
  MockOwnTripServer.trip = trip();
  MockOwnTripServer.moderator = false;
});

test('the owner reads the reviews of their list but has no form to rate it', () => {
  render(<TripScreen />);
  expect(screen.getByText('Reviews')).toBeOnTheScreen();
  expect(screen.getByText('Travellers who open your list can rate it here.')).toBeOnTheScreen();
  expect(screen.queryByTestId('review-form')).toBeNull();
  expect(screen.queryByText('Moderation')).toBeNull();
});

test('a moderator can make their own public list official from its page', () => {
  MockOwnTripServer.moderator = true;
  render(<TripScreen />);
  expect(screen.getByRole('button', { name: 'Mark as official' })).toBeOnTheScreen();
});

test('someone else opening the edit address of a list gets the read-only view instead', () => {
  // The shared view shows a public list, asks for a password, or says a private one is not
  // available — never the owner's editing page (D-040).
  MockOwnTripServer.trip = null;
  render(<TripScreen />);
  expect(JSON.parse(screen.getByTestId('redirect').props.children)).toEqual({
    pathname: '/shared',
    params: { id: 't1' },
  });
  expect(screen.queryByRole('button', { name: 'Save visibility' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Delete trip' })).toBeNull();
});
