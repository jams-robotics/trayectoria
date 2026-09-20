/**
 * Supabase side of the teacher's classroom (F3-02a): the teacher's own groups, their invite
 * codes and their members.
 *
 * RLS is the only access control (docs/ARCHITECTURE.md §5.2, supabase/migrations/0002_rls.sql):
 * every statement runs with the teacher's own session and the anon key, and the policies scope
 * `groups` to `owner_id = auth.uid()` and `group_members` to the groups they own. The `ownerId`
 * sent here always comes from that session, never from a caller-supplied id; a group that is not
 * theirs simply comes back as zero rows. No `service_role`, no migration, no policy change.
 */
import { getDbClient, type DbClient, type Tables } from '@trayectoria/db';

import { inviteCode, type Rng } from './inviteCode';
import type { ProgressRow } from './progressMatrix';

/** A group as the classroom list and detail show it. */
export interface Group {
  readonly id: string;
  readonly name: string;
  readonly inviteCode: string;
  readonly createdAt: string;
  /** Members of the group. */
  readonly memberCount: number;
}

/** One member of a group, with the display name of their profile. */
export interface Member {
  readonly userId: string;
  readonly displayName: string;
  readonly joinedAt: string;
}

/** Bounds of the group name, in characters (F3-02a). */
export const GROUP_NAME_MIN_LENGTH = 1;
export const GROUP_NAME_MAX_LENGTH = 60;

/** Postgres error code of a unique violation: the invite code was already taken. */
const UNIQUE_VIOLATION = '23505';

type GroupRow = Pick<Tables<'groups'>, 'id' | 'name' | 'invite_code' | 'created_at'>;

/**
 * The embed `profiles(display_name)` of PostgREST, which the generated types do not model; the
 * shape is declared here instead of regenerating `packages/db/src/types.ts`.
 */
interface MemberRow {
  readonly user_id: string;
  readonly joined_at: string;
  readonly profiles: { readonly display_name: string } | null;
}

/** What a PostgREST call resolves to, as this module reads it back. */
interface Result<Row> {
  readonly data: Row | null;
  readonly error: { readonly message: string; readonly code?: string } | null;
}

const GROUP_COLUMNS = 'id, name, invite_code, created_at';
const MEMBER_COLUMNS = 'user_id, joined_at, profiles(display_name)';

function toGroup(row: GroupRow, memberCount: number): Group {
  return {
    id: row.id,
    name: row.name,
    inviteCode: row.invite_code,
    createdAt: row.created_at,
    memberCount,
  };
}

/** Trims the name and checks its length; the empty string means it is not usable. */
export function normalizeGroupName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length >= GROUP_NAME_MIN_LENGTH && trimmed.length <= GROUP_NAME_MAX_LENGTH
    ? trimmed
    : '';
}

function fail(error: Result<unknown>['error'], fallback: string): never {
  throw new Error(error?.message ?? fallback);
}

/** Members per group id, from one `in` query over `group_members`. */
async function countMembers(
  groupIds: readonly string[],
  db: DbClient,
): Promise<Record<string, number>> {
  if (groupIds.length === 0) return {};
  const { data }: Result<{ group_id: string }[]> = await db
    .from('group_members')
    .select('group_id')
    .in('group_id', groupIds);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) counts[row.group_id] = (counts[row.group_id] ?? 0) + 1;
  return counts;
}

/**
 * The groups this teacher owns, newest first, with their member counts. The `owner_id` filter
 * mirrors the "groups: owner reads" policy, which already restricts the rows.
 */
export async function listGroups(ownerId: string, db: DbClient = getDbClient()): Promise<Group[]> {
  const { data, error }: Result<GroupRow[]> = await db
    .from('groups')
    .select(GROUP_COLUMNS)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  if (error !== null || data === null) fail(error, 'groups unavailable');
  const counts = await countMembers(
    data.map((row) => row.id),
    db,
  );
  return data.map((row) => toGroup(row, counts[row.id] ?? 0));
}

/** One group of this teacher, or `null` when the id is not theirs (RLS returns no row). */
export async function getGroup(
  ownerId: string,
  groupId: string,
  db: DbClient = getDbClient(),
): Promise<Group | null> {
  const { data }: Result<GroupRow> = await db
    .from('groups')
    .select(GROUP_COLUMNS)
    .eq('owner_id', ownerId)
    .eq('id', groupId)
    .maybeSingle();
  if (data === null || data === undefined) return null;
  const counts = await countMembers([groupId], db);
  return toGroup(data, counts[groupId] ?? 0);
}

/**
 * Creates a group with a code generated in the browser. The unique index on `invite_code` is
 * the arbiter: on a collision the insert is retried once with a fresh code.
 */
export async function createGroup(
  ownerId: string,
  name: string,
  db: DbClient = getDbClient(),
  rng?: Rng,
): Promise<Group> {
  const trimmedName = normalizeGroupName(name);
  if (trimmedName === '') throw new Error('invalid group name');
  const row = { owner_id: ownerId, name: trimmedName };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data, error }: Result<GroupRow> = await db
      .from('groups')
      .insert({ ...row, invite_code: inviteCode(rng).toUpperCase() })
      .select(GROUP_COLUMNS)
      .maybeSingle();
    if (error === null && data !== null && data !== undefined) return toGroup(data, 0);
    if (error?.code !== UNIQUE_VIOLATION) fail(error, 'group not created');
  }
  throw new Error('invite code collision');
}

/** Renames a group of this teacher. */
export async function renameGroup(
  ownerId: string,
  groupId: string,
  name: string,
  db: DbClient = getDbClient(),
): Promise<string> {
  const trimmedName = normalizeGroupName(name);
  if (trimmedName === '') throw new Error('invalid group name');
  const { error }: Result<unknown> = await db
    .from('groups')
    .update({ name: trimmedName })
    .eq('owner_id', ownerId)
    .eq('id', groupId);
  if (error !== null) fail(error, 'group not renamed');
  return trimmedName;
}

/** Replaces the invite code of a group with a new one, retried once on a unique collision. */
export async function regenerateInviteCode(
  ownerId: string,
  groupId: string,
  db: DbClient = getDbClient(),
  rng?: Rng,
): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const code = inviteCode(rng).toUpperCase();
    const { error }: Result<unknown> = await db
      .from('groups')
      .update({ invite_code: code })
      .eq('owner_id', ownerId)
      .eq('id', groupId);
    if (error === null) return code;
    if (error.code !== UNIQUE_VIOLATION) fail(error, 'code not regenerated');
  }
  throw new Error('invite code collision');
}

/** Deletes a group of this teacher; its memberships go with it (cascade of migration 0001). */
export async function deleteGroup(
  ownerId: string,
  groupId: string,
  db: DbClient = getDbClient(),
): Promise<void> {
  const { error }: Result<unknown> = await db
    .from('groups')
    .delete()
    .eq('owner_id', ownerId)
    .eq('id', groupId);
  if (error !== null) fail(error, 'group not deleted');
}

/**
 * Members of a group, with the `display_name` the "profiles: read own or taught" policy makes
 * visible to the owner of the group. A member whose profile is not readable keeps an empty name.
 */
export async function listMembers(
  groupId: string,
  db: DbClient = getDbClient(),
): Promise<Member[]> {
  const { data, error }: Result<MemberRow[]> = await db
    .from('group_members')
    .select(MEMBER_COLUMNS)
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true })
    .returns<MemberRow[]>();
  if (error !== null || data === null) fail(error, 'members unavailable');
  return data.map((row) => ({
    userId: row.user_id,
    displayName: row.profiles?.display_name ?? '',
    joinedAt: row.joined_at,
  }));
}

/** Removes one member from a group; the "group_members: owner deletes" policy scopes it. */
export async function removeMember(
  groupId: string,
  userId: string,
  db: DbClient = getDbClient(),
): Promise<void> {
  const { error }: Result<unknown> = await db
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error !== null) fail(error, 'member not removed');
}

/** Columns of `public.progress` the classroom table and the CSV need (F3-02b). */
const PROGRESS_COLUMNS = 'user_id, topic_id, status, best_score, attempts, completed_at';

/**
 * Progress of the given members in one query (F3-02b). The "progress: own or taught reads"
 * policy is what authorises it: with the teacher's own session the rows of their own students
 * come back and nothing else, so a user id that is not theirs simply yields no row
 * (`supabase/tests/progress_isolation.sql`). No `service_role`, no policy change.
 */
export async function listProgress(
  memberIds: readonly string[],
  db: DbClient = getDbClient(),
): Promise<ProgressRow[]> {
  if (memberIds.length === 0) return [];
  const { data, error }: Result<ProgressRow[]> = await db
    .from('progress')
    .select(PROGRESS_COLUMNS)
    .in('user_id', memberIds);
  if (error !== null || data === null) fail(error, 'progress unavailable');
  return data;
}
