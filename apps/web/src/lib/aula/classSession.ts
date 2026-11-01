/**
 * Supabase side of a class session (#685, migration 0014): the teacher opens one for a group,
 * approves or kicks the phones that ask to join, and closes it; a phone asks to join with the
 * token of the QR. RLS is the only access control: the teacher's reads and writes are
 * `teacher_id = auth.uid()`, and a phone reaches `session_participants` only through
 * `request_join_session`. No `service_role` anywhere.
 */
import { getDbClient, type DbClient } from '@trayectoria/db';

export type ParticipantStatus = 'pending' | 'approved' | 'kicked';

export interface OpenSession {
  readonly id: string;
  readonly token: string;
  readonly expiresAt: string;
}

export interface Participant {
  readonly userId: string;
  readonly name: string;
  readonly status: ParticipantStatus;
}

/** What a phone learns when its token is valid: the session and who runs it. */
export interface JoinOffer {
  readonly sessionId: string;
  readonly teacherName: string;
}

function isStatus(value: string): value is ParticipantStatus {
  return value === 'pending' || value === 'approved' || value === 'kicked';
}

/** The page a phone opens; the token is in the fragment, so it never reaches logs or `Referer`. */
export function joinUrl(origin: string, token: string): string {
  return `${origin}/aula/sesion#t=${token}`;
}

/** The token of `#t=<token>`, or `''` when the fragment does not carry one. */
export function tokenFromHash(hash: string): string {
  return new URLSearchParams(hash.replace(/^#/, '')).get('t') ?? '';
}

/** Opens the session of a group; a previous one (expired or not) is replaced, so its QR dies. */
export async function openSession(
  groupId: string,
  teacherId: string,
  db: DbClient = getDbClient(),
): Promise<OpenSession> {
  const removed = await db.from('class_sessions').delete().eq('group_id', groupId);
  if (removed.error !== null) throw new Error(removed.error.message);
  const { data, error } = await db
    .from('class_sessions')
    .insert({ group_id: groupId, teacher_id: teacherId })
    .select('id, join_token, expires_at')
    .single();
  if (error !== null) throw new Error(error.message);
  return { id: data.id, token: data.join_token, expiresAt: data.expires_at };
}

/** Closing is deleting: the participants go with the row and the topics stop working. */
export async function closeSession(sessionId: string, db: DbClient = getDbClient()): Promise<void> {
  const { error } = await db.from('class_sessions').delete().eq('id', sessionId);
  if (error !== null) throw new Error(error.message);
}

export async function listParticipants(
  sessionId: string,
  db: DbClient = getDbClient(),
): Promise<Participant[]> {
  const { data, error } = await db
    .from('session_participants')
    .select('user_id, status, profiles(display_name)')
    .eq('session_id', sessionId)
    .order('requested_at', { ascending: true });
  if (error !== null) throw new Error(error.message);
  return data.flatMap((row) =>
    isStatus(row.status)
      ? [{ userId: row.user_id, name: row.profiles?.display_name ?? '', status: row.status }]
      : [],
  );
}

/** Approves (`approved`) or kicks (`kicked`) a participant; a kicked one cannot ask again. */
export async function decide(
  sessionId: string,
  userId: string,
  status: 'approved' | 'kicked',
  db: DbClient = getDbClient(),
): Promise<void> {
  const { error } = await db
    .from('session_participants')
    .update({ status })
    .eq('session_id', sessionId)
    .eq('user_id', userId);
  if (error !== null) throw new Error(error.message);
}

/**
 * Asks `request_join_session` about a token. Without `confirm` it only validates and answers who
 * the teacher is; with it, it also records the request. Every refusal is the same `null`.
 */
export async function askToJoin(
  token: string,
  confirm: boolean,
  db: DbClient = getDbClient(),
): Promise<JoinOffer | null> {
  const { data, error } = await db.rpc('request_join_session', {
    session_token: token,
    confirm,
  });
  const row = error === null ? data[0] : undefined;
  return row === undefined ? null : { sessionId: row.session_id, teacherName: row.teacher_name };
}

/** The caller's own status in a session, or `null` when the session is gone. */
export async function myStatus(
  sessionId: string,
  userId: string,
  db: DbClient = getDbClient(),
): Promise<ParticipantStatus | null> {
  const { data } = await db
    .from('session_participants')
    .select('status')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();
  return data !== null && isStatus(data.status) ? data.status : null;
}

/** The live session of a group, if the teacher already opened one (the page was reloaded). */
export async function findSession(
  groupId: string,
  db: DbClient = getDbClient(),
): Promise<OpenSession | null> {
  const { data } = await db
    .from('class_sessions')
    .select('id, join_token, expires_at')
    .eq('group_id', groupId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  return data === null ? null : { id: data.id, token: data.join_token, expiresAt: data.expires_at };
}
