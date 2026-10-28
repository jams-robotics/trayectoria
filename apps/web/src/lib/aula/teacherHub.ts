/**
 * The PC end of a class session (#685): listens to the topic of every approved participant and
 * lets through only what the teacher's chosen driver sends. Everything else is dropped by sender,
 * which is what keeps one phone from flooding the arena. A participant who stops being approved
 * (kicked) has its topic closed: policies are cached until the JWT renews, so the PC, not the
 * policy, is what stops listening.
 */
import type { DbClient } from '@trayectoria/db';

import { openTopic, topicOf, type ClassMessage, type TopicHandle } from './classChannel';
import type { Participant } from './classSession';

export interface TeacherHub {
  /** Opens the topics of the approved participants and closes the rest. */
  sync: (participants: readonly Participant[]) => void;
  /** One driver at a time; `null` for nobody. The phones are told whether it is their turn. */
  setActive: (userId: string | null) => void;
  close: () => void;
}

/** Closes the topics of whoever is not approved any more. */
function dropUnapproved(topics: Map<string, TopicHandle>, approved: ReadonlySet<string>): void {
  for (const [userId, handle] of topics) {
    if (approved.has(userId)) continue;
    handle.close();
    topics.delete(userId);
  }
}

export function createTeacherHub(
  db: DbClient,
  sessionId: string,
  onMessage: (message: ClassMessage) => void,
): TeacherHub {
  const topics = new Map<string, TopicHandle>();
  let active: string | null = null;
  const tell = (userId: string): void =>
    topics.get(userId)?.send({ kind: 'turn', active: userId === active });
  const listen = (userId: string): void => {
    const topic = openTopic(db, topicOf(sessionId, userId), (message) => {
      if (userId === active) onMessage(message);
    });
    topics.set(userId, topic);
    tell(userId);
  };
  return {
    sync(participants) {
      const approved = new Set(
        participants.filter((p) => p.status === 'approved').map((p) => p.userId),
      );
      dropUnapproved(topics, approved);
      for (const userId of approved) if (!topics.has(userId)) listen(userId);
      if (active !== null && !approved.has(active)) active = null;
    },
    setActive(userId) {
      const previous = active;
      active = userId;
      if (previous !== null) tell(previous);
      if (userId !== null) tell(userId);
    },
    close() {
      for (const handle of topics.values()) handle.close();
      topics.clear();
    },
  };
}
