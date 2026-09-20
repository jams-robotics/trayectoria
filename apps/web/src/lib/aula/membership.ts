/**
 * Supabase side of the student's membership (F3-03): joining a group with an invite code,
 * listing the groups they belong to, leaving one and deleting the account.
 *
 * RLS is the only access control (docs/ARCHITECTURE.md §5.2). Joining goes through the
 * `security definer` function `join_group` (migration 0003), the one path into `group_members`;
 * the names come from the `groups_visible` view, which never exposes `invite_code`; leaving uses
 * the "group_members: member leaves" policy and deleting the account the `delete_account`
 * function, both of migration 0005. No `service_role` anywhere.
 */
import { getDbClient, type DbClient } from '@trayectoria/db';

/** One group the student belongs to, as "Mis grupos" shows it. Never carries the invite code. */
export interface MyGroup {
  readonly id: string;
  readonly name: string;
}

/** What a PostgREST call resolves to, as this module reads it back. */
interface Result<Row> {
  readonly data: Row | null;
  readonly error: { readonly message: string } | null;
}

/**
 * The embed `groups_visible(name)` of PostgREST, which the generated types do not model; the
 * shape is declared here instead of hand-editing `packages/db/src/types.ts`.
 */
interface MembershipRow {
  readonly group_id: string;
  readonly groups_visible: { readonly name: string } | null;
}

const MY_GROUP_COLUMNS = 'group_id, groups_visible(name)';

/**
 * The code as the database stores it: upper case, with spaces and the separators people type
 * when reading a code aloud (`-`, `.`, `_`) removed. `' ab3 4xyz9 '` → `AB34XYZ9`.
 */
export function normalizeCode(code: string): string {
  return code.replace(/[\s\-._]/g, '').toUpperCase();
}

/**
 * Joins the group of `code` through `join_group`. Every failure — unknown code, own group,
 * already a member — is the same rejection here, so the caller cannot tell them apart and the
 * UI shows the single `aula.join.invalid` message.
 */
export async function joinGroup(db: DbClient, code: string): Promise<void> {
  const inviteCode = normalizeCode(code);
  if (inviteCode === '') throw new Error('invalid invite code');
  const { error } = await db.rpc('join_group', { invite_code: inviteCode });
  if (error !== null) throw new Error('invalid invite code');
}

/** The groups this student belongs to, with the names of `groups_visible`. */
export async function listMyGroups(
  userId: string,
  db: DbClient = getDbClient(),
): Promise<MyGroup[]> {
  const { data, error }: Result<MembershipRow[]> = await db
    .from('group_members')
    .select(MY_GROUP_COLUMNS)
    .eq('user_id', userId)
    .order('joined_at', { ascending: true })
    .returns<MembershipRow[]>();
  if (error !== null || data === null) throw new Error(error?.message ?? 'groups unavailable');
  return data.map((row) => ({ id: row.group_id, name: row.groups_visible?.name ?? '' }));
}

/** Leaves a group: the caller deletes their own membership ("group_members: member leaves"). */
export async function leaveGroup(
  groupId: string,
  userId: string,
  db: DbClient = getDbClient(),
): Promise<void> {
  const { error }: Result<unknown> = await db
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error !== null) throw new Error(error.message);
}

/**
 * Deletes the caller's account. `delete_account` takes no arguments: it acts on `auth.uid()`,
 * removes the caller's `urdf` objects and the auth user, and the cascades of migration 0001 take
 * the profile, memberships, robots, progress and attempts with it.
 */
export async function deleteAccount(db: DbClient = getDbClient()): Promise<void> {
  const { error } = await db.rpc('delete_account');
  if (error !== null) throw new Error(error.message);
}
