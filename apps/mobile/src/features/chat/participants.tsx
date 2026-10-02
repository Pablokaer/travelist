// Who is in a walk list's group chat (D-044): "3 people: Ana (organiser), You, Cid".
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/text';
import { useWalkParticipants, type ChatParticipant } from '@/features/chat/api';

/** One name as the list shows it. */
function participantLabel(p: ChatParticipant, t: (key: string, values?: object) => string) {
  const name = p.isSelf ? t('chat.you') : (p.name ?? t('reviews.anonymous'));
  return p.isOrganiser ? t('chat.organiserTag', { name }) : name;
}

/**
 * @example <ChatParticipants tripId={trip.id} />
 */
export function ChatParticipants({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const participants = useWalkParticipants(tripId);
  if (!participants.data?.length) return null;
  const names = participants.data.map((p) => participantLabel(p, t as never)).join(', ');
  return (
    <Text variant="caption" secondary testID="chat-participants">
      {t('chat.people', { count: participants.data.length, names })}
    </Text>
  );
}
