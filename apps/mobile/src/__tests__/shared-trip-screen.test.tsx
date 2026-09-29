import { render, screen, userEvent } from '@testing-library/react-native';

import SharedTripScreen from '@/app/shared';
import type { SharedTripView } from '@/features/trips/sharing-api';
import '@/lib/i18n';

/** What `shared_trip` answers for each password the visitor tries (null = none yet). */
class MockSharedTripServer {
  static answers = new Map<string | null, SharedTripView>();
  static asked: (string | null)[] = [];
  static pushed: unknown[] = [];

  static reset() {
    MockSharedTripServer.answers = new Map();
    MockSharedTripServer.asked = [];
    MockSharedTripServer.pushed = [];
  }
}

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: 't1' }),
  router: { push: (to: unknown) => MockSharedTripServer.pushed.push(to) },
}));
jest.mock('@/features/trips/sharing-api', () => ({
  ...jest.requireActual('@/features/trips/sharing-api'),
  useSharedTrip: (_id: string, password: string | null) => {
    MockSharedTripServer.asked.push(password);
    return { isPending: false, isError: false, data: MockSharedTripServer.answers.get(password) };
  },
}));
jest.mock('@/features/auth/auth-provider', () => ({ useAuth: () => ({ session: null }) }));
jest.mock('@/features/profile/api', () => ({ useProfile: () => ({ data: undefined }) }));

const trip = (isOwner: boolean): SharedTripView => ({
  status: 'ok',
  trip: {
    id: 't1',
    name: 'Belém by the river',
    citySlug: 'lisbon',
    tripDate: null,
    distanceM: 1200,
    walkingSeconds: 900,
    visitMinutes: 20,
    createdAt: '2026-09-29T10:00:00Z',
    stopCount: 1,
    visibility: 'password',
    geometry: null,
    isFallback: false,
    provider: null,
    isOwner,
    stops: [
      {
        id: 'a1',
        citySlug: 'lisbon',
        nameEn: 'Belém Tower',
        namePt: null,
        category: 'monument',
        lat: 38.69,
        lng: -9.21,
        popularity: 90,
        avgVisitMinutes: 20,
        imageUrl: null,
        isUnesco: true,
      },
    ],
  },
});

beforeEach(() => MockSharedTripServer.reset());

test('a private or missing list says it is not available', () => {
  MockSharedTripServer.answers.set(null, { status: 'not_found' });
  render(<SharedTripScreen />);
  expect(screen.getByText('Walk list not available')).toBeOnTheScreen();
  expect(screen.getByText('This list is private or no longer exists.')).toBeOnTheScreen();
});

test('a public list shows its stops to a signed-out visitor, with a way to plan their own', () => {
  MockSharedTripServer.answers.set(null, trip(false));
  render(<SharedTripScreen />);
  expect(screen.getByText('Belém by the river')).toBeOnTheScreen();
  expect(screen.getByText('Belém Tower')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Plan your own walks' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Edit list' })).toBeNull();
});

test('a protected list asks for the password, refuses a wrong one and opens with the right one', async () => {
  MockSharedTripServer.answers.set(null, { status: 'password_required' });
  MockSharedTripServer.answers.set('nope', { status: 'wrong_password' });
  MockSharedTripServer.answers.set('lisbon24', trip(false));
  render(<SharedTripScreen />);
  expect(screen.getByText('This walk list is protected')).toBeOnTheScreen();

  await userEvent.type(screen.getByLabelText('Password'), 'nope');
  await userEvent.press(screen.getByRole('button', { name: 'Open list' }));
  expect(await screen.findByText('Wrong password. Try again.')).toBeOnTheScreen();

  await userEvent.clear(screen.getByLabelText('Password'));
  await userEvent.type(screen.getByLabelText('Password'), 'lisbon24');
  await userEvent.press(screen.getByRole('button', { name: 'Open list' }));
  expect(await screen.findByText('Belém by the river')).toBeOnTheScreen();
  expect(MockSharedTripServer.asked).toContain('lisbon24');
});

test('the owner sees their list as others do, with a way back to editing it', async () => {
  MockSharedTripServer.answers.set(null, trip(true));
  render(<SharedTripScreen />);
  expect(screen.getByText('This is your list, as others see it.')).toBeOnTheScreen();
  await userEvent.press(screen.getByRole('button', { name: 'Edit list' }));
  expect(MockSharedTripServer.pushed).toEqual([{ pathname: '/trip/[id]', params: { id: 't1' } }]);
});
