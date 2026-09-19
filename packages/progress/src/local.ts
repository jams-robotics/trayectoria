/**
 * Validation of the browser copy of the progress map. It only parses and serialises; the one
 * module that touches `localStorage` is `stores/progress.ts` (docs/STANDARDS.md §10).
 */
import { emptyProgress } from './model';
import type { ProgressMap, TopicProgress } from './model';

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

/**
 * The browser copy, with the learner it belongs to. The owner is stored so that the cache of a
 * signed-in learner is never shown to the next person on the same browser, which a plain map
 * could not tell apart after a reload.
 */
export interface StoredProgress {
  /** Id of the learner the copy belongs to, or `null` for an anonymous one. */
  readonly owner: string | null;
  readonly topics: ProgressMap;
}

/** Serialises the browser copy of one learner. */
export function serialiseProgress(owner: string | null, topics: ProgressMap): string {
  return JSON.stringify({ owner, topics });
}

/**
 * Parses the raw JSON string of `localStorage`. Invalid JSON, an unknown shape or a copy that
 * belongs to another learner all read as an empty map.
 */
export function readProgressJson(raw: string | null, owner: string | null): ProgressMap {
  if (raw === null) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!isRecord(parsed)) return {};
  // `owner` and `topics` were added with the envelope; a copy without them is an anonymous one.
  if (!('topics' in parsed)) return owner === null ? parseProgressMap(parsed) : {};
  const storedOwner = parsed.owner;
  if (storedOwner !== null && typeof storedOwner !== 'string') return {};
  return storedOwner === owner ? parseProgressMap(parsed.topics) : {};
}
