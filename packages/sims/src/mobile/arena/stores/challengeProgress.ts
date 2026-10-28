import { CHALLENGES } from '../challenges';
import type { ChallengeId } from '../challenges';

// The challenges passed in this browser. Only the ids are kept: no account, no personal data.
// Nothing here throws; without storage the arena works, it just forgets on reload.

export const CHALLENGE_PROGRESS_KEY = 'trayectoria.arena.passed';

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

const KNOWN: ReadonlySet<string> = new Set(CHALLENGES.map((challenge) => challenge.id));

function isChallengeId(value: unknown): value is ChallengeId {
  return typeof value === 'string' && KNOWN.has(value);
}

/** The challenges passed before; unknown or malformed entries are dropped. */
export function loadPassed(): ReadonlySet<ChallengeId> {
  try {
    const raw = storage()?.getItem(CHALLENGE_PROGRESS_KEY) ?? null;
    const data: unknown = raw === null ? [] : JSON.parse(raw);
    return new Set(Array.isArray(data) ? data.filter(isChallengeId) : []);
  } catch {
    return new Set();
  }
}

export function savePassed(passed: ReadonlySet<ChallengeId>): void {
  try {
    storage()?.setItem(CHALLENGE_PROGRESS_KEY, JSON.stringify([...passed]));
  } catch {
    // A full or blocked storage only means the progress is not remembered.
  }
}
