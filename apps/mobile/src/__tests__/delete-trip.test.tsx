import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { tripKeys, useDeleteTrip } from '@/features/trips/api';
import { supabase } from '@/lib/supabase';

/** Fake `delete_trip`: succeeds, or refuses like the Free plan (WF003). */
class FakeDeleteRpc {
  static refuse = false;
  static calls: unknown[] = [];
  static call = async (fn: string, args: unknown) => {
    FakeDeleteRpc.calls.push({ fn, args });
    return FakeDeleteRpc.refuse
      ? { data: null, error: { code: 'WF003', message: 'plan limit: delete' } }
      : { data: null, error: null };
  };
}

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn() },
  unwrap: (r: { data: unknown }) => r.data,
  check: () => undefined,
}));

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidated: unknown[] = [];
  const original = client.invalidateQueries.bind(client);
  client.invalidateQueries = ((filters?: Parameters<typeof original>[0]) => {
    invalidated.push({ key: filters?.queryKey, exact: filters?.exact ?? false });
    return original(filters);
  }) as typeof client.invalidateQueries;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper, invalidated };
}

beforeEach(() => {
  FakeDeleteRpc.refuse = false;
  FakeDeleteRpc.calls = [];
  jest.mocked(supabase.rpc).mockImplementation(FakeDeleteRpc.call as never);
});

test('deleting goes through delete_trip and refreshes the list, not the deleted page', async () => {
  const { wrapper, invalidated } = setup();
  const { result } = renderHook(() => useDeleteTrip(), { wrapper });
  await act(async () => result.current.mutate('t1'));
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(FakeDeleteRpc.calls).toEqual([{ fn: 'delete_trip', args: { p_trip_id: 't1' } }]);
  // Re-reading the deleted list's page would redirect it to "not available" (D-040) before the
  // screen goes back; only My Trips (exact key) and the plan usage are refreshed.
  expect(invalidated).toContainEqual({ key: tripKeys.all, exact: true });
  expect(invalidated).not.toContainEqual({ key: tripKeys.all, exact: false });
});

test('a plan refusal is a PlanLimitError (D-047)', async () => {
  FakeDeleteRpc.refuse = true;
  const { wrapper } = setup();
  const { result } = renderHook(() => useDeleteTrip(), { wrapper });
  await act(async () => result.current.mutate('t1'));
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect((result.current.error as { limit?: string }).limit).toBe('delete');
});
