/**
 * Seeds for an exercise instance (#94, decision 2).
 *
 * With a session the seed is derived from the user, the topic, the exercise and the round, so a
 * learner always finds the same numbers until they ask for new ones. Without a session there is
 * nothing to derive it from, so a fresh seed is drawn per mount.
 */

const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;
const TWO_POW_32 = 4294967296;

/** FNV-1a over the UTF-16 code units of `text`, as an unsigned 32-bit integer. */
function fnv1a(text: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), FNV_PRIME);
  }
  return hash >>> 0;
}

/**
 * Deterministic seed of one instance of an exercise: the same tuple always gives the same
 * numbers, and `round` (0 on first render, +1 per «Nuevos valores») changes them.
 */
export function seedFor(
  userId: string,
  topicId: string,
  exerciseId: string,
  round: number,
): number {
  return fnv1a(`${userId}:${topicId}:${exerciseId}:${String(round)}`);
}

/**
 * Seed for a learner with no session: nothing identifies them, so the instance is drawn at
 * random. `source` is injectable so tests and stories stay deterministic.
 */
export function randomSeed(source: () => number = Math.random): number {
  return Math.floor(source() * TWO_POW_32) >>> 0;
}
