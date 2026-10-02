// A thin, project-owned interface over Supabase Realtime (D-043): follow the inserts of one table,
// filtered, and stop following. Realtime applies the table's select policy to each subscriber.
import { supabase } from '@/lib/supabase';

type Channel = {
  on: (
    event: 'postgres_changes',
    options: { event: 'INSERT'; schema: string; table: string; filter: string },
    callback: () => void,
  ) => Channel;
  subscribe: (onStatus?: (status: string) => void) => Channel;
};

/** What we need of the Supabase client, so tests can pass a fake. */
export type RealtimeClient = {
  channel: (name: string) => Channel;
  removeChannel: (channel: never) => Promise<unknown>;
};

/**
 * Starts following inserts; returns the function that stops. `onInsert` also runs once the
 * server confirms it is listening, so a row inserted between the first read and that moment
 * is not missed.
 */
export type InsertSubscriber = (
  channelName: string,
  table: string,
  filter: string,
  onInsert: () => void,
) => () => void;

/**
 * @example const follow = createInsertSubscriber(supabase);
 *          const stop = follow('walk-chat:t1', 'walk_messages', 'trip_id=eq.t1', refetch);
 */
export function createInsertSubscriber(client: RealtimeClient): InsertSubscriber {
  return (channelName, table, filter, onInsert) => {
    const channel = client
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter }, onInsert)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') onInsert();
      });
    return () => void client.removeChannel(channel as never);
  };
}

/** The app's subscriber, on the shared Supabase client. */
export const subscribeToInserts = createInsertSubscriber(supabase as unknown as RealtimeClient);
