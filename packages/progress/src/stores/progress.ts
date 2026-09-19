/**
 * The progress store: the one atom every island reads, and the only module of
 * `@trayectoria/progress` that touches `localStorage` (docs/STANDARDS.md §10).
 *
 * Without a session the map lives only in this browser. With one, `localStorage` stays as the
 * cache and every change is also written to Supabase; a failed write is kept and retried with
 * the next one, so a network error never breaks the UI (same rule as `robotPersistence`).
 */
import { atom } from 'nanostores';

import { PROGRESS_STORAGE_KEY, readProgressJson, serialiseProgress } from '../local';
import { applyAttempt, completeProgress, emptyProgress, mergeProgress } from '../model';
import type { ExerciseAttempt, ProgressMap, TopicProgress } from '../model';
import { fetchProgress, insertAttempt, upsertProgress } from '../remote';

/**
 * Progress of every topic this learner has touched.
 *
 * It starts empty, never from `localStorage`: Astro renders islands on the server too, so a
 * stored map read before hydration would make the server markup and the first client render
 * differ (same reason as `$myRobot`). `hydrateProgress()` adopts the stored map afterwards.
 */
export const $progress = atom<ProgressMap>({});

let userId: string | null = null;
let hydrated = false;
/** Topics whose remote write failed; retried with the next write of the same session. */
let pendingTopics = new Set<string>();

function storage(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

/**
 * Adopts the map stored in this browser for the current learner. Idempotent per learner: it
 * reads storage once, and again after `configureProgressSession` changes who is signed in, so a
 * copy left by another learner is never adopted.
 */
export function hydrateProgress(): void {
  if (hydrated || typeof document === 'undefined') return;
  hydrated = true;
  const stored = readProgressJson(storage()?.getItem(PROGRESS_STORAGE_KEY) ?? null, userId);
  $progress.set(stored);
}

function write(map: ProgressMap): void {
  $progress.set(map);
  storage()?.setItem(PROGRESS_STORAGE_KEY, serialiseProgress(userId, map));
}

/** Progress of one topic, or `undefined` when nothing was ever recorded for it. */
export function getProgress(topicId: string): TopicProgress | undefined {
  return $progress.get()[topicId];
}

/**
 * Pushes the topics of `topicIds` to Supabase, together with every topic left pending by an
 * earlier failure. A failure is recorded and swallowed: the UI keeps the local state.
 */
async function push(topicIds: readonly string[]): Promise<void> {
  const owner = userId;
  if (owner === null) return;
  const map = $progress.get();
  const failed = new Set<string>();
  for (const topicId of new Set([...pendingTopics, ...topicIds])) {
    const progress = map[topicId];
    if (progress === undefined) continue;
    try {
      await upsertProgress(owner, topicId, progress);
    } catch {
      failed.add(topicId);
    }
  }
  pendingTopics = failed;
}

/**
 * Records one graded attempt: applies the pure rules, saves the map and, with a session, logs
 * the attempt and writes the topic row.
 */
export async function recordAttempt(
  attempt: ExerciseAttempt,
  requiredExerciseIds: readonly string[],
): Promise<void> {
  hydrateProgress();
  const map = $progress.get();
  const current = map[attempt.topicId] ?? emptyProgress();
  write({ ...map, [attempt.topicId]: applyAttempt(current, attempt, requiredExerciseIds) });
  const owner = userId;
  if (owner === null) return;
  try {
    await insertAttempt(owner, attempt);
  } catch {
    // The attempt log is append-only evidence; losing one row never blocks the topic row.
  }
  await push([attempt.topicId]);
}

/** Marks a topic completed by hand, for the sections that do not grade exercises. */
export async function markCompleted(topicId: string): Promise<void> {
  hydrateProgress();
  const map = $progress.get();
  write({ ...map, [topicId]: completeProgress(map[topicId] ?? emptyProgress()) });
  await push([topicId]);
}

/** The local map merged with the remote one: a topic on both sides follows `mergeProgress`. */
function merged(local: ProgressMap, remote: ProgressMap): ProgressMap {
  const topicIds = new Set([...Object.keys(local), ...Object.keys(remote)]);
  const entries = [...topicIds].flatMap((topicId) => {
    const here = local[topicId];
    const there = remote[topicId];
    if (here !== undefined && there !== undefined) {
      return [[topicId, mergeProgress(here, there)] as const];
    }
    const only = here ?? there;
    return only === undefined ? [] : [[topicId, only] as const];
  });
  return Object.fromEntries(entries);
}

/**
 * Attaches the store to a session, or detaches it. On attaching, the remote rows are read and
 * merged with the local ones (`completed` wins, the best score stays, attempts add up) and the
 * topics that only existed here are pushed once. On signing out the map is emptied, so a shared
 * browser never shows one learner's progress to the next.
 */
export async function configureProgressSession(nextUserId: string | null): Promise<void> {
  if (nextUserId === userId && hydrated) return;
  const previous = userId;
  pendingTopics = new Set();
  // The copy of this browser is read while the store still belongs to whoever owned it, so an
  // anonymous map is adopted before it changes hands and the copy of another learner is not.
  hydrateProgress();
  // Signing in takes the anonymous map along; switching from one account to another does not.
  const anonymous = previous === null ? $progress.get() : {};
  userId = nextUserId;
  if (nextUserId === null) {
    // Signing out drops the copy of the learner who just left; an anonymous visit that never had
    // a session keeps the local map of this browser.
    if (previous !== null) write({});
    return;
  }
  // This learner's own cache is shown at once, so the route index is not blank while the rows
  // are fetched; it is not merged with them, because it is a copy of those same rows and adding
  // its attempts to them would count every attempt twice on each reload.
  hydrated = false;
  hydrateProgress();
  const cached = $progress.get();
  const remote = await fetchProgress(nextUserId);
  // Only what was done anonymously in this browser is merged into the rows and uploaded once.
  const map = merged(anonymous, { ...cached, ...remote });
  write(map);
  const changed = Object.keys(anonymous);
  await push(changed);
}

/** Current session id, or `null`; `progressAdapter.userId()` reads it. */
export function currentUserId(): string | null {
  return userId;
}

/** The raw JSON of the browser copy; the tests of `src/` assert on it without touching storage. */
export function storedProgressJson(): string | null {
  return storage()?.getItem(PROGRESS_STORAGE_KEY) ?? null;
}

/** Writes a browser copy directly; for tests of hydration only. */
export function seedStoredProgressForTest(map: ProgressMap, owner: string | null = null): void {
  storage()?.setItem(PROGRESS_STORAGE_KEY, serialiseProgress(owner, map));
}

/**
 * Empties the store and the session; for tests only. With `clearStorage` set to `false` it only
 * drops the module state, which is what a page reload does.
 */
export function resetProgressForTest(clearStorage = true): void {
  userId = null;
  hydrated = false;
  pendingTopics = new Set();
  $progress.set({});
  if (clearStorage) storage()?.removeItem(PROGRESS_STORAGE_KEY);
}
