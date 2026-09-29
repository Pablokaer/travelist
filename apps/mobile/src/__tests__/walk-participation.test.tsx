import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { CHAT_RECONCILE_MS, walkMessagesQuery } from '@/features/chat/api';
import { useToggleAttendance } from '@/features/trips/community-api';
import { supabase } from '@/lib/supabase';

/** Fake `set_walk_attendance`: answers like the database, or fails like a lost network. */
class FakeAttendanceRpc {
  static calls: { fn: string; args: unknown }[] = [];
  static failWith: string | null = null;

  static reset() {
    FakeAttendanceRpc.calls = [];
    FakeAttendanceRpc.failWith = null;
  }

  static call = async (fn: string, args: { p_attending: boolean }) => {
    FakeAttendanceRpc.calls.push({ fn, args });
    if (FakeAttendanceRpc.failWith)
      return { data: null, error: { message: FakeAttendanceRpc.failWith } };
    return { data: { is_attending: args.p_attending, attendee_count: 1 }, error: null };
  };
}

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn() },
  unwrap: (r: { data: unknown; error: { message: string } | null }) => {
    if (r.error) throw new Error(r.error.message);
    return r.data;
  },
  check: (r: { error: { message: string } | null }) => {
    if (r.error) throw new Error(r.error.message);
  },
}));

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidated: unknown[] = [];
  const original = client.invalidateQueries.bind(client);
  client.invalidateQueries = ((filters?: Parameters<typeof original>[0]) => {
    invalidated.push(filters?.queryKey);
    return original(filters);
  }) as typeof client.invalidateQueries;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper, invalidated };
}

beforeEach(() => {
  FakeAttendanceRpc.reset();
  jest.mocked(supabase.rpc).mockImplementation(FakeAttendanceRpc.call as never);
});

describe('joining a walk list (D-044)', () => {
  test('goes through the idempotent RPC and then refreshes what the screens show', async () => {
    const { wrapper, invalidated } = setup();
    const { result } = renderHook(() => useToggleAttendance(), { wrapper });
    await act(async () => result.current.mutate({ id: 't1', attending: true }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(FakeAttendanceRpc.calls).toEqual([
      { fn: 'set_walk_attendance', args: { p_trip_id: 't1', p_attending: true } },
    ]);
    expect(invalidated).toEqual(expect.arrayContaining([['walklists'], ['sharedTrip']]));
  });

  test('a failure is reported and the screens are refreshed from the server, not left guessing', async () => {
    FakeAttendanceRpc.failWith = 'Failed to fetch';
    const { wrapper, invalidated } = setup();
    const { result } = renderHook(() => useToggleAttendance(), { wrapper });
    await act(async () => result.current.mutate({ id: 't1', attending: true }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Failed to fetch');
    expect(invalidated).toEqual(expect.arrayContaining([['sharedTrip']]));
  });
});

describe('the chat reconciles with the server (D-044)', () => {
  test('while open it re-reads the history regularly and on focus, so a missed live event still shows', () => {
    const options = walkMessagesQuery('t1');
    expect(options.queryKey).toEqual(['walkChat', 't1']);
    expect(options.refetchInterval).toBe(CHAT_RECONCILE_MS);
    expect(CHAT_RECONCILE_MS).toBe(10_000);
    expect(options.refetchOnWindowFocus).toBe('always');
    expect(options.staleTime).toBe(0);
  });
});
