/**
 * Seeded pseudo-random generator. Stateful by design (see docs/STANDARDS.md §2): every call
 * advances the internal 32-bit state, so two generators built from the same seed always yield
 * the same sequence. This is the only source of randomness allowed in `sim-core`.
 */
export interface SeededRng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max], both ends inclusive. */
  nextInt(min: number, max: number): number;
  /** Normal deviate with the given mean and standard deviation (Box–Muller). */
  nextGaussian(mean: number, sigma: number): number;
}

const TWO_POW_32 = 4294967296;

/**
 * Creates a mulberry32 generator. The seed is normalised to an unsigned 32-bit integer
 * (`seed >>> 0`), so `-1` and `4294967295` are the same seed and fractions are truncated.
 */
export function createRng(seed: number): SeededRng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / TWO_POW_32;
  };

  const nextInt = (min: number, max: number): number => {
    const lo = Math.ceil(Math.min(min, max));
    const hi = Math.floor(Math.max(min, max));
    return lo + Math.floor(next() * (hi - lo + 1));
  };

  const nextGaussian = (mean: number, sigma: number): number => {
    // 1 - u keeps the argument of log in (0, 1], avoiding log(0).
    const u1 = 1 - next();
    const u2 = next();
    const radius = Math.sqrt(-2 * Math.log(u1));
    return mean + sigma * radius * Math.cos(2 * Math.PI * u2);
  };

  return { next, nextInt, nextGaussian };
}
