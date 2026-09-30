/**
 * Validation of the browser copy of the progress map. It only parses and serialises; the one
 * module that touches `localStorage` is `stores/progress.ts` (docs/STANDARDS.md §10).
 */
import { emptyProgress, mergeProgress } from './model';
import type { ProgressMap, TopicProgress } from './model';
import { MERGED_EXERCISE_MAP, ROUTES_VERSION, TOPIC_ID_MAP } from './routeMap';

/** Key of the browser copy of the progress map (F3-01 spec). */
export const PROGRESS_STORAGE_KEY = 'trayectoria.progress';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) return null;
  return value.every((item) => typeof item === 'string') ? value : null;
}

/** One stored topic, or `null` when any field is missing or of the wrong type. */
export function parseTopicProgress(input: unknown): TopicProgress | null {
  if (!isRecord(input)) return null;
  const { status, bestScore, attempts, completedAt } = input;
  const correctIds = stringArray(input.correctIds);
  const firstTryCorrectIds = stringArray(input.firstTryCorrectIds);
  if (status !== 'in_progress' && status !== 'completed') return null;
  if (typeof bestScore !== 'number' || !Number.isFinite(bestScore)) return null;
  if (typeof attempts !== 'number' || !Number.isInteger(attempts) || attempts < 0) return null;
  if (completedAt !== null && typeof completedAt !== 'string') return null;
  if (correctIds === null || firstTryCorrectIds === null) return null;
  return { ...emptyProgress(), status, bestScore, attempts, completedAt, correctIds, firstTryCorrectIds };
}

/**
 * The stored progress map. Anything that is not a valid map comes back empty, and a single
 * malformed topic is dropped without taking the rest of the map with it.
 */
export function parseProgressMap(input: unknown): ProgressMap {
  if (!isRecord(input)) return {};
  const entries = Object.entries(input).flatMap(([topicId, value]) => {
    const progress = parseTopicProgress(value);
    return progress === null ? [] : [[topicId, progress] as const];
  });
  return Object.fromEntries(entries);
}

/** The exercise ids of a merged topic under their new ids; removed exercises are dropped. */
function remapExercises(
  ids: readonly string[],
  exercises: Readonly<Record<string, string>>,
): readonly string[] {
  return [...new Set(ids.flatMap((id) => (exercises[id] === undefined ? [] : [exercises[id]])))];
}

/**
 * Converts a map keyed by the topic ids of the single route to the ids of the two routes (#574,
 * docs/ARCHITECTURE.md §5.4), with the rules of `0012_two_routes.sql`: every id goes through
 * `TOPIC_ID_MAP`, and topics that land on the same new id (Torque and Transmission) merge like a
 * local copy with a remote row (`mergeProgress`: `completed` wins, best score, attempts added up,
 * earliest completion). In those two, `correctIds` and `firstTryCorrectIds` go through
 * `MERGED_EXERCISE_MAP`, dropping the removed exercises. An id outside the table stays as it is.
 *
 * Several ids are old and new at once, so it must run once per copy: `routesVersion` says so.
 */
export function convertToTwoRoutes(map: ProgressMap): ProgressMap {
  const converted: Record<string, TopicProgress> = {};
  for (const [topicId, progress] of Object.entries(map)) {
    const nextId = TOPIC_ID_MAP[topicId] ?? topicId;
    const exercises = MERGED_EXERCISE_MAP[topicId];
    const moved: TopicProgress =
      exercises === undefined
        ? progress
        : {
            ...progress,
            correctIds: remapExercises(progress.correctIds, exercises),
            firstTryCorrectIds: remapExercises(progress.firstTryCorrectIds, exercises),
          };
    const existing = converted[nextId];
    converted[nextId] = existing === undefined ? moved : mergeProgress(existing, moved);
  }
  return converted;
}

/**
 * The browser copy, with the learner it belongs to. The owner is stored so that the cache of a
 * signed-in learner is never shown to the next person on the same browser, which a plain map
 * could not tell apart after a reload.
 */
export interface StoredProgress {
  /** Id of the learner the copy belongs to, or `null` for an anonymous one. */
  readonly owner: string | null;
  readonly topics: ProgressMap;
  /** `ROUTES_VERSION` once the topic ids are the ones of the two routes (§5.4). */
  readonly routesVersion: number;
}

/** Serialises the browser copy of one learner, always with the ids of the two routes. */
export function serialiseProgress(owner: string | null, topics: ProgressMap): string {
  const stored: StoredProgress = { owner, topics, routesVersion: ROUTES_VERSION };
  return JSON.stringify(stored);
}

/** What the browser copy holds for a learner, and whether it had to be converted first. */
export interface StoredProgressRead {
  readonly topics: ProgressMap;
  /** `true` when the copy predates the two routes: the store writes it back converted. */
  readonly converted: boolean;
}

const NOTHING_STORED: StoredProgressRead = { topics: {}, converted: false };

/** Converts `topics` when the copy has no `routesVersion` or an older one. */
function withRoutes(topics: ProgressMap, routesVersion: unknown): StoredProgressRead {
  if (typeof routesVersion === 'number' && routesVersion >= ROUTES_VERSION) {
    return { topics, converted: false };
  }
  return { topics: convertToTwoRoutes(topics), converted: true };
}

/**
 * Parses the raw JSON string of `localStorage`. Invalid JSON, an unknown shape or a copy that
 * belongs to another learner all read as an empty map. A copy of this learner written before the
 * two routes comes back converted (`convertToTwoRoutes`).
 */
export function readStoredProgress(raw: string | null, owner: string | null): StoredProgressRead {
  if (raw === null) return NOTHING_STORED;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NOTHING_STORED;
  }
  if (!isRecord(parsed)) return NOTHING_STORED;
  // `owner` and `topics` were added with the envelope; a copy without them is an anonymous one,
  // older than the two routes.
  if (!('topics' in parsed)) {
    return owner === null ? withRoutes(parseProgressMap(parsed), undefined) : NOTHING_STORED;
  }
  const storedOwner = parsed.owner;
  if (storedOwner !== null && typeof storedOwner !== 'string') return NOTHING_STORED;
  if (storedOwner !== owner) return NOTHING_STORED;
  return withRoutes(parseProgressMap(parsed.topics), parsed.routesVersion);
}

/** The map of `readStoredProgress`, for callers that do not write the copy back. */
export function readProgressJson(raw: string | null, owner: string | null): ProgressMap {
  return readStoredProgress(raw, owner).topics;
}
