import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';

import WalkChatScreen from '@/app/walk-chat';
import { messageFromRow, type ChatMessage } from '@/features/chat/api';
import { MeetupBanner } from '@/features/trips/meetup-banner';
import type { SharedTripView } from '@/features/trips/sharing-api';
import { createInsertSubscriber, type RealtimeClient } from '@/lib/realtime';
import '@/lib/i18n';

/** What the chat hooks return, what was sent and which chats were followed live. */
class MockChatServer {
  static messages: ChatMessage[] = [];
  static sent: string[] = [];
  static followed: string[] = [];
  static toggle: { isPending: boolean; error: Error | null; mutate: jest.Mock } = {
    isPending: false,
    error: null,
    mutate: jest.fn(),
  };
  static shared: SharedTripView = { status: 'not_found' };
  static participants: {
    name: string | null;
    avatarUrl: null;
    isOrganiser: boolean;
    isSelf: boolean;
  }[] = [];

  static reset() {
    MockChatServer.messages = [];
    MockChatServer.sent = [];
    MockChatServer.followed = [];
    MockChatServer.shared = { status: 'not_found' };
    MockChatServer.participants = [];
    MockChatServer.toggle = { isPending: false, error: null, mutate: jest.fn() };
  }
}

/** Stand-in for the Supabase Realtime client: records channels and replays inserts. */
class FakeRealtimeClient implements RealtimeClient {
  subscriptions: { channel: string; table: string; filter: string; onInsert: () => void }[] = [];
  removed: string[] = [];
  /** Confirms each subscription, as the server does once it is listening. */
  ready: (() => void)[] = [];

  channel(name: string) {
    const sub = { channel: name, table: '', filter: '', onInsert: () => undefined };
    const api = {
      on: (_event: string, opts: { table: string; filter: string }, callback: () => void) => {
        Object.assign(sub, { table: opts.table, filter: opts.filter, onInsert: callback });
        return api;
      },
      subscribe: (onStatus?: (status: string) => void) => {
        this.subscriptions.push(sub);
        this.ready.push(() => onStatus?.('SUBSCRIBED'));
        return api;
      },
      name,
    };
    return api as never;
  }

  removeChannel(channel: { name: string }) {
    this.removed.push(channel.name);
    return Promise.resolve('ok' as const);
  }
}

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: 't1' }),
  router: { push: jest.fn(), back: jest.fn() },
}));
jest.mock('@/features/chat/api', () => ({
  ...jest.requireActual('@/features/chat/api'),
  useWalkMessages: () => ({ isPending: false, isError: false, data: MockChatServer.messages }),
  useSendWalkMessage: () => ({
    isPending: false,
    error: null,
    mutate: (body: string, opts?: { onSuccess?: () => void }) => {
      MockChatServer.sent.push(body);
      opts?.onSuccess?.();
    },
  }),
  useWalkChatLive: (tripId: string) => MockChatServer.followed.push(tripId),
  useWalkParticipants: () => ({ data: MockChatServer.participants }),
}));
jest.mock('@/features/trips/sharing-api', () => ({
  ...jest.requireActual('@/features/trips/sharing-api'),
  useSharedTrip: () => ({ isPending: false, isError: false, data: MockChatServer.shared }),
}));
jest.mock('@/features/trips/community-api', () => ({
  ...jest.requireActual('@/features/trips/community-api'),
  useToggleAttendance: () => MockChatServer.toggle,
}));
jest.mock('@/features/destinations/api', () => ({
  ...jest.requireActual('@/features/destinations/api'),
  useCities: () => ({ data: [] }),
}));
jest.mock('@/lib/use-now', () => ({ useNow: () => new Date('2026-10-01T10:00:00Z') }));

const message = (over: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'm1',
  body: 'See you at the square!',
  createdAt: '2026-10-01T09:00:00Z',
  authorName: 'Ben',
  authorAvatarUrl: null,
  isOwn: false,
  authorPublicId: 'pub-ben',
  // No nickname: these tests keep the name / "You" labels (nicknames: nicknames.test.tsx).
  authorNickname: null,
  ...over,
});

/** A shared trip answer; `role` makes the caller the organiser, someone going or a visitor. */
function sharedTrip(
  role: 'organiser' | 'going' | 'visitor',
  over: Record<string, unknown> = {},
): SharedTripView {
  return {
    status: 'ok',
    trip: {
      id: 't1',
      name: 'Sunrise walk',
      citySlug: 'lisbon',
      tripDate: null,
      distanceM: null,
      walkingSeconds: null,
      visitMinutes: null,
      createdAt: '2026-09-29T10:00:00Z',
      stopCount: 0,
      visibility: 'public',
      isOfficial: false,
      startsAt: '2026-10-04T09:00:00Z',
      geometry: null,
      isFallback: false,
      provider: null,
      stops: [],
      isOwner: role === 'organiser',
      authorName: 'Ana',
      rating: { count: 0, average: null },
      isSaved: false,
      attendeeCount: 1,
      isAttending: role === 'going',
      ...over,
    },
  } as SharedTripView;
}

beforeEach(() => MockChatServer.reset());

describe('chat rows (D-043)', () => {
  test('a message row keeps its text, time, author and ownership', () => {
    expect(
      messageFromRow({
        id: 'm1',
        body: 'Hi',
        created_at: '2026-10-01T09:00:00Z',
        author_name: null,
        author_avatar_path: null,
        is_own: true,
      }),
    ).toEqual({
      id: 'm1',
      body: 'Hi',
      createdAt: '2026-10-01T09:00:00Z',
      authorName: null,
      authorAvatarUrl: null,
      authorPublicId: null,
      authorNickname: null,
      isOwn: true,
    });
  });
});

describe('createInsertSubscriber', () => {
  test('follows the inserts of one chat and stops when asked', () => {
    const client = new FakeRealtimeClient();
    const onInsert = jest.fn();
    const stop = createInsertSubscriber(client)(
      'walk-chat:t1',
      'walk_messages',
      'trip_id=eq.t1',
      onInsert,
    );
    expect(client.subscriptions).toMatchObject([
      { channel: 'walk-chat:t1', table: 'walk_messages', filter: 'trip_id=eq.t1' },
    ]);
    client.subscriptions[0]!.onInsert();
    expect(onInsert).toHaveBeenCalledTimes(1);
    // Once listening, it refreshes too: a message posted before that moment is not missed.
    client.ready[0]!();
    expect(onInsert).toHaveBeenCalledTimes(2);
    stop();
    expect(client.removed).toEqual(['walk-chat:t1']);
  });
});

describe('WalkChatScreen', () => {
  test('people going read the group messages, oldest first, and follow them live', () => {
    MockChatServer.shared = sharedTrip('going');
    MockChatServer.messages = [
      message({ id: 'a', body: 'Morning all', authorName: 'Ana' }),
      message({ id: 'b', body: 'On my way', isOwn: true }),
    ];
    render(<WalkChatScreen />);
    expect(screen.getByText('Sunrise walk')).toBeOnTheScreen();
    const texts = screen.getAllByTestId(/^chat-message-/).map((m) => m.props.testID);
    expect(texts).toEqual(['chat-message-a', 'chat-message-b']);
    expect(screen.getByText(/^Ana · /)).toBeOnTheScreen();
    expect(screen.getByText(/^You · /)).toBeOnTheScreen();
    expect(MockChatServer.followed).toContain('t1');
  });

  test('a message is sent trimmed and the field is cleared', async () => {
    MockChatServer.shared = sharedTrip('organiser');
    render(<WalkChatScreen />);
    expect(screen.getByText('No messages yet. Say hello!')).toBeOnTheScreen();
    fireEvent.changeText(screen.getByTestId('chat-input'), '  Meet at the fountain  ');
    await userEvent.press(screen.getByRole('button', { name: 'Send' }));
    expect(MockChatServer.sent).toEqual(['Meet at the fountain']);
    expect(screen.getByTestId('chat-input').props.value).toBe('');
  });

  test('an empty message is not sent', async () => {
    MockChatServer.shared = sharedTrip('organiser');
    render(<WalkChatScreen />);
    fireEvent.changeText(screen.getByTestId('chat-input'), '   ');
    await userEvent.press(screen.getByRole('button', { name: 'Send' }));
    expect(MockChatServer.sent).toEqual([]);
  });

  test('someone not going is invited to join instead of reading the chat', () => {
    MockChatServer.shared = sharedTrip('visitor');
    render(<WalkChatScreen />);
    expect(screen.getByText('Only people going can chat')).toBeOnTheScreen();
    expect(screen.queryByTestId('chat-input')).toBeNull();
    expect(MockChatServer.followed).toEqual([]);
  });

  test('a private or missing list has no chat', () => {
    render(<WalkChatScreen />);
    expect(screen.getByText('Walk list not available')).toBeOnTheScreen();
  });
});

describe('the meetup banner leads to the chat', () => {
  test('people going and the organiser open the group chat', () => {
    const shared = sharedTrip('going');
    render(<MeetupBanner trip={shared.status === 'ok' ? shared.trip : (null as never)} canJoin />);
    expect(screen.getByRole('button', { name: 'Open group chat' })).toBeOnTheScreen();
  });

  test('others are told that going opens the chat, or that they can just save the list', () => {
    const shared = sharedTrip('visitor');
    render(<MeetupBanner trip={shared.status === 'ok' ? shared.trip : (null as never)} canJoin />);
    expect(screen.queryByRole('button', { name: 'Open group chat' })).toBeNull();
    expect(
      screen.getByText('Going adds you to the group chat. Rather not? Just save the list.'),
    ).toBeOnTheScreen();
  });
});

describe('participation and chat as one flow (D-044)', () => {
  const bannerTrip = (shared: SharedTripView) =>
    shared.status === 'ok' ? shared.trip : (null as never);

  test('the chat shows who is in it: the organiser first, then everyone going', () => {
    MockChatServer.shared = sharedTrip('going');
    MockChatServer.participants = [
      { name: 'Ana', avatarUrl: null, isOrganiser: true, isSelf: false },
      { name: 'Ben', avatarUrl: null, isOrganiser: false, isSelf: true },
      { name: 'Cid', avatarUrl: null, isOrganiser: false, isSelf: false },
    ];
    render(<WalkChatScreen />);
    expect(screen.getByTestId('chat-participants')).toHaveTextContent(
      '3 people: Ana (organiser), You, Cid',
    );
  });

  test('the chat moves above the keyboard on phones', () => {
    MockChatServer.shared = sharedTrip('going');
    render(<WalkChatScreen />);
    expect(screen.getByTestId('chat-keyboard')).toBeOnTheScreen();
  });

  test('a public list without a date or time can be joined too', async () => {
    const shared = sharedTrip('visitor', { startsAt: null, attendeeCount: 0 });
    render(<MeetupBanner trip={bannerTrip(shared)} canJoin />);
    expect(screen.getByTestId('meetup-banner')).toHaveTextContent(/0 going/);
    expect(screen.queryByText(/Starts in/)).toBeNull();
    await userEvent.press(screen.getByRole('button', { name: "I'm going" }));
    expect(MockChatServer.toggle.mutate).toHaveBeenCalledWith({ id: 't1', attending: true });
  });

  test('joining after the meetup started is still possible (its chat stays open)', () => {
    const shared = sharedTrip('visitor', { startsAt: '2026-09-30T09:00:00Z' });
    render(<MeetupBanner trip={bannerTrip(shared)} canJoin />);
    expect(screen.getByTestId('meetup-banner')).toHaveTextContent(/Started/);
    expect(screen.getByRole('button', { name: "I'm going" })).toBeOnTheScreen();
  });

  test('a failed join says so and does not claim the user is going', () => {
    MockChatServer.toggle = {
      isPending: false,
      error: new Error('Failed to fetch'),
      mutate: jest.fn(),
    };
    const shared = sharedTrip('visitor');
    render(<MeetupBanner trip={bannerTrip(shared)} canJoin />);
    expect(screen.getByText("We couldn't update your participation. Try again.")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: "I'm going" })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Open group chat' })).toBeNull();
  });

  test('private or protected lists have no participation card', () => {
    const shared = sharedTrip('visitor', { visibility: 'password' });
    render(<MeetupBanner trip={bannerTrip(shared)} canJoin />);
    expect(screen.queryByTestId('meetup-banner')).toBeNull();
  });
});

test("pressing a chat author's name opens their public profile (D-045)", async () => {
  MockChatServer.shared = sharedTrip('going');
  MockChatServer.messages = [message({ id: 'a', authorName: 'Ana', authorPublicId: 'pub-ana' })];
  render(<WalkChatScreen />);
  await userEvent.press(screen.getByRole('link', { name: 'Ana' }));
  expect(jest.requireMock('expo-router').router.push).toHaveBeenCalledWith({
    pathname: '/traveller',
    params: { id: 'pub-ana' },
  });
});
