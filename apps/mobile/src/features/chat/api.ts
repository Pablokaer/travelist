// Walk list group chat (D-043): the organiser and everyone going share one chat per list. Read
// with `list_walk_messages` (author names and photos), written as plain inserts (RLS: members
// only), delivered live through Realtime inserts.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { avatarUrl } from '@/features/profile/avatar-api';
import { subscribeToInserts, type InsertSubscriber } from '@/lib/realtime';
import { check, supabase, unwrap } from '@/lib/supabase';

/** Newest messages loaded when a chat opens. */
export const CHAT_PAGE_SIZE = 100;
/**
 * While a chat is open it is re-read this often (D-044). Realtime delivers messages at most once:
 * an event can be lost (the service starting or reconnecting, a device asleep), and without
 * this the message would not show until someone wrote again.
 */
export const CHAT_RECONCILE_MS = 10_000;
/** Longest message, in characters (mirrored by a DB check). */
export const CHAT_MESSAGE_MAX = 1000;

export type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  authorName: string | null;
  authorAvatarUrl: string | null;
  /** Opens the author's public profile (D-045). */
  authorPublicId: string | null;
  /** Shown as @nickname on every message, own ones included (D-048). */
  authorNickname: string | null;
  isOwn: boolean;
};

type MessageRow = {
  id: string;
  body: string;
  created_at: string;
  author_name: string | null;
  author_avatar_path: string | null;
  is_own: boolean;
  author_public_id?: string | null;
  author_nickname?: string | null;
};

export const chatKeys = { messages: (tripId: string) => ['walkChat', tripId] as const };

/**
 * @example messageFromRow(row).authorName // 'Ben'
 */
export function messageFromRow(r: MessageRow): ChatMessage {
  return {
    id: r.id,
    body: r.body,
    createdAt: r.created_at,
    authorName: r.author_name,
    authorAvatarUrl: avatarUrl(r.author_avatar_path),
    authorPublicId: r.author_public_id ?? null,
    authorNickname: r.author_nickname ?? null,
    isOwn: r.is_own,
  };
}

/**
 * The chat query: the newest messages, oldest first (reading order), always re-read when the
 * chat opens or regains focus, and every `CHAT_RECONCILE_MS` while it is open.
 * @example useQuery(walkMessagesQuery(trip.id))
 */
export function walkMessagesQuery(tripId: string) {
  return {
    queryKey: chatKeys.messages(tripId),
    queryFn: async (): Promise<ChatMessage[]> => {
      const rows = unwrap(
        await supabase.rpc('list_walk_messages', { p_trip_id: tripId, p_limit: CHAT_PAGE_SIZE }),
      );
      return (rows as MessageRow[]).map(messageFromRow).reverse();
    },
    staleTime: 0,
    refetchInterval: CHAT_RECONCILE_MS,
    refetchOnWindowFocus: 'always' as const,
  };
}

/** The chat's newest messages, kept in step with the server (see `walkMessagesQuery`). */
export function useWalkMessages(tripId: string) {
  return useQuery(walkMessagesQuery(tripId));
}

export type ChatParticipant = {
  name: string | null;
  avatarUrl: string | null;
  isOrganiser: boolean;
  isSelf: boolean;
};

type ParticipantRow = {
  name: string | null;
  avatar_path: string | null;
  is_organiser: boolean;
  is_self: boolean;
};

/** Who is in the chat: the organiser first, then participants in the order they joined. */
export function useWalkParticipants(tripId: string) {
  return useQuery({
    queryKey: [...chatKeys.messages(tripId), 'participants'] as const,
    refetchInterval: CHAT_RECONCILE_MS,
    queryFn: async (): Promise<ChatParticipant[]> => {
      const rows = unwrap(await supabase.rpc('list_walk_participants', { p_trip_id: tripId }));
      return (rows as ParticipantRow[]).map((r) => ({
        name: r.name,
        avatarUrl: avatarUrl(r.avatar_path),
        isOrganiser: r.is_organiser,
        isSelf: r.is_self,
      }));
    },
  });
}

/**
 * Sends a message (trimmed; the caller checks it is not empty).
 * @example send.mutate('See you at 10', { onSuccess: clearField })
 */
export function useSendWalkMessage(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      check(await supabase.from('walk_messages').insert({ trip_id: tripId, body: body.trim() }));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKeys.messages(tripId) }),
  });
}

/**
 * Refetches the chat whenever anyone posts in it, while the screen is open.
 * @example useWalkChatLive(trip.id)
 */
export function useWalkChatLive(tripId: string, subscribe: InsertSubscriber = subscribeToInserts) {
  const queryClient = useQueryClient();
  useEffect(
    () =>
      subscribe(`walk-chat:${tripId}`, 'walk_messages', `trip_id=eq.${tripId}`, () => {
        void queryClient.invalidateQueries({ queryKey: chatKeys.messages(tripId) });
      }),
    [tripId, subscribe, queryClient],
  );
}
