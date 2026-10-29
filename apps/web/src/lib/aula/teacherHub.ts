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
  /** Sends `message` to the phone whose turn it is, if any. */
  tellActive: (message: ClassMessage) => void;
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

function approvedOf(participants: readonly Participant[]): ReadonlySet<string> {
  return new Set(participants.filter((p) => p.status === 'approved').map((p) => p.userId));
}

interface HubState {
  readonly topics: Map<string, TopicHandle>;
  active: string | null;
  progress: ClassMessage | null;
}

/** Tells `userId` whether it drives; the driver also hears the last progress, in case it missed it. */
function tell(state: HubState, userId: string): void {
  const topic = state.topics.get(userId);
  topic?.send({ kind: 'turn', active: userId === state.active });
  if (userId === state.active && state.progress !== null) topic?.send(state.progress);
}

export function createTeacherHub(
  db: DbClient,
  sessionId: string,
  onMessage: (message: ClassMessage) => void,
): TeacherHub {
  const state: HubState = { topics: new Map(), active: null, progress: null };
  const { topics } = state;
  const listen = (userId: string): void => {
    const topic = openTopic(db, topicOf(sessionId, userId), (message) => {
      if (userId === state.active) onMessage(message);
    });
    topics.set(userId, topic);
  };
  return {
    sync(participants) {
      const approved = approvedOf(participants);
      dropUnapproved(topics, approved);
      if (state.active !== null && !approved.has(state.active)) state.active = null;
      // Every poll repeats the turn: a phone that reloaded or slept missed the first one.
      for (const userId of approved) {
        if (!topics.has(userId)) listen(userId);
        tell(state, userId);
      }
    },
    setActive(userId) {
      const previous = state.active;
      state.active = userId;
      if (previous !== null) tell(state, previous);
      if (userId !== null) tell(state, userId);
    },
    tellActive(message) {
      if (message.kind === 'progress') state.progress = message;
      if (state.active !== null) topics.get(state.active)?.send(message);
    },
    close() {
      for (const handle of topics.values()) handle.close();
      topics.clear();
    },
  };
}
