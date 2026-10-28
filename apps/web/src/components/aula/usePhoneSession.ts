import { useSession } from '@trayectoria/auth';
import { getDbClient } from '@trayectoria/db';
import { useCallback, useEffect, useRef, useState } from 'react';

import { openTopic, topicOf, type ClassMessage, type TopicHandle } from '../../lib/aula/classChannel';
import { askToJoin, myStatus, tokenFromHash, type JoinOffer } from '../../lib/aula/classSession';

/** How often a waiting phone asks whether the teacher decided. */
const POLL_MS = 2000;

export type PhonePhase =
  | 'checking'
  | 'noToken'
  | 'invalid'
  | 'offer'
  | 'waiting'
  | 'approved'
  | 'driving'
  | 'kicked'
  | 'ended';

export interface PhoneSession {
  readonly phase: PhonePhase;
  readonly teacherName: string;
  ask: () => void;
  send: (message: ClassMessage) => void;
}

/** Reads the fragment and asks the database who runs the session, without asking to join yet. */
function useOffer(userId: string): { offer: JoinOffer | null; phase: PhonePhase } {
  const [offer, setOffer] = useState<JoinOffer | null>(null);
  const [phase, setPhase] = useState<PhonePhase>('checking');
  useEffect(() => {
    if (userId === '') return;
    const token = tokenFromHash(window.location.hash);
    if (token === '') {
      setPhase('noToken');
      return;
    }
    askToJoin(token, false).then(
      (found) => {
        setOffer(found);
        setPhase(found === null ? 'invalid' : 'offer');
      },
      () => setPhase('invalid'),
    );
  }, [userId]);
  return { offer, phase };
}

/** After the request: the topic of this phone, and the status of its row every few seconds. */
function useRequest(
  sessionId: string | null,
  userId: string,
  onTurn: (active: boolean) => void,
  onStatus: (status: PhonePhase) => void,
): { send: (message: ClassMessage) => void } {
  const handle = useRef<TopicHandle | null>(null);
  useEffect(() => {
    if (sessionId === null) return undefined;
    const topic = openTopic(getDbClient(), topicOf(sessionId, userId), (message) => {
      if (message.kind === 'turn') onTurn(message.active);
    });
    handle.current = topic;
    const poll = (): void => {
      void myStatus(sessionId, userId).then((status) => {
        if (status === null) onStatus('ended');
        else if (status === 'kicked') onStatus('kicked');
        else onStatus(status === 'approved' ? 'approved' : 'waiting');
      });
    };
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      clearInterval(timer);
      topic.close();
      handle.current = null;
    };
  }, [sessionId, userId, onTurn, onStatus]);
  return { send: (message) => handle.current?.send(message) };
}

/** The phone's whole lifecycle: offer, request, wait for approval, wait for the turn, drive. */
export function usePhoneSession(): PhoneSession {
  const { session } = useSession();
  const userId = session?.user.id ?? '';
  const { offer, phase: first } = useOffer(userId);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<PhonePhase>('waiting');
  const [turn, setTurn] = useState(false);
  const request = useRequest(sessionId, userId, setTurn, setStatus);
  const ask = useCallback(() => {
    const token = tokenFromHash(window.location.hash);
    void askToJoin(token, true).then((joined) => setSessionId(joined?.sessionId ?? null));
  }, []);
  const decided = sessionId === null ? first : status;
  const phase = decided === 'approved' && turn ? 'driving' : decided;
  return { phase, teacherName: offer?.teacherName ?? '', ask, send: request.send };
}
