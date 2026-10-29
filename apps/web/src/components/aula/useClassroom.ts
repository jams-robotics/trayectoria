import { getDbClient } from '@trayectoria/db';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ClassMessage } from '../../lib/aula/classChannel';
import {
  closeSession,
  decide,
  findSession,
  listParticipants,
  openSession,
  type OpenSession,
  type Participant,
} from '../../lib/aula/classSession';
import { listGroups, type Group } from '../../lib/aula/groups';
import type { RemoteBus } from '../../lib/aula/remoteControl';
import { createTeacherHub, type TeacherHub } from '../../lib/aula/teacherHub';

/** The teacher's PC asks who wants to join this often (join requests are not broadcast). */
const POLL_MS = 2000;

/** The groups the teacher owns; empty for a student, whose RLS shows none. */
export function useTeacherGroups(userId: string): Group[] {
  const [groups, setGroups] = useState<Group[]>([]);
  useEffect(() => {
    if (userId === '') return;
    listGroups(userId).then(setGroups, () => setGroups([]));
  }, [userId]);
  return groups;
}

/** Keeps the participants of the session fresh and the hub's topics in step with them. */
function useParticipants(session: OpenSession | null, hubRef: { current: TeacherHub | null }) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const refresh = useCallback(async (): Promise<void> => {
    if (session === null) return;
    const list = await listParticipants(session.id).catch(() => null);
    if (list === null) return;
    setParticipants(list);
    hubRef.current?.sync(list);
  }, [session, hubRef]);
  useEffect(() => {
    setParticipants([]);
    if (session === null) return undefined;
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [session, refresh]);
  return { participants, refresh };
}

/** The hub of the open session: it forwards the driver's messages to the arena and the panel. */
function useHub(session: OpenSession | null, bus: RemoteBus, onDrive: (m: ClassMessage) => void) {
  const hubRef = useRef<TeacherHub | null>(null);
  useEffect(() => {
    if (session === null) return undefined;
    const hub = createTeacherHub(getDbClient(), session.id, (message) => {
      if (message.kind === 'turn') return;
      onDrive(message);
      bus.emit(message);
    });
    hubRef.current = hub;
    return () => {
      hub.close();
      hubRef.current = null;
    };
  }, [session, bus, onDrive]);
  return hubRef;
}

export interface Classroom {
  readonly session: OpenSession | null;
  readonly participants: readonly Participant[];
  readonly activeId: string | null;
  readonly last: ClassMessage | null;
  readonly failed: boolean;
  start: (groupId: string) => void;
  close: () => void;
  approve: (userId: string) => void;
  kick: (userId: string) => void;
  setActive: (userId: string | null) => void;
}

export function useClassroom(userId: string, groupId: string, bus: RemoteBus): Classroom {
  const [session, setSession] = useState<OpenSession | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [last, setLast] = useState<ClassMessage | null>(null);
  const [failed, setFailed] = useState(false);
  const hubRef = useHub(session, bus, setLast);
  const { participants, refresh } = useParticipants(session, hubRef);
  useEffect(() => {
    setSession(null);
    if (groupId !== '') void findSession(groupId).then(setSession, () => setSession(null));
  }, [groupId]);
  const run = (task: Promise<unknown>): void =>
    void task.then(() => setFailed(false), () => setFailed(true));
  const setActive = (id: string | null): void => {
    setActiveId(id);
    hubRef.current?.setActive(id);
    if (id !== null) bus.emit({ kind: 'takeover' });
  };
  return {
    session,
    participants,
    activeId,
    last,
    failed,
    start: (id) => run(openSession(id, userId).then(setSession)),
    close: () => {
      setActive(null);
      if (session !== null) run(closeSession(session.id).then(() => setSession(null)));
    },
    approve: (id) => run(decide(session?.id ?? '', id, 'approved').then(refresh)),
    kick: (id) => {
      if (id === activeId) setActive(null);
      run(decide(session?.id ?? '', id, 'kicked').then(refresh));
    },
    setActive,
  };
}
