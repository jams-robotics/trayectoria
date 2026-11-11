/**
 * Hint computed from a wrong answer (v1.5): what the response looks like next to the expected
 * value, so the learner learns where to look. Pure: no i18n here, only the key and its params.
 */
export interface Hint {
  /** Key under `widgets.ExerciseWidget`. */
  key: 'hint' | 'hintSign' | 'hintBig' | 'hintSmall' | 'hintOrderBig' | 'hintOrderSmall';
  /** Factor text for `hintBig` and `hintSmall`. */
  factor?: string;
}

/** Unit-conversion factors the exercises of the course use, with the text they are shown as. */
const FACTORS: readonly (readonly [number, string])[] = [
  [60, '60'],
  [2 * Math.PI, '2π'],
  [1000, '1000'],
  [100, '100'],
];
/** How close the ratio response/expected must be to a factor, as a relative error. */
const FACTOR_TOLERANCE = 0.05;
/** The ratio is an order of magnitude off from this many powers of ten. */
const ORDER_DECADES = 1;

/** The hint for one wrong component; the generic one when nothing recognisable shows. */
export function hintFor(expected: number, response: number): Hint {
  if (expected === 0 || !Number.isFinite(response)) return { key: 'hint' };
  const ratio = response / expected;
  if (Math.abs(ratio + 1) < FACTOR_TOLERANCE) return { key: 'hintSign' };
  for (const [factor, text] of FACTORS) {
    if (Math.abs(ratio / factor - 1) < FACTOR_TOLERANCE) return { key: 'hintBig', factor: text };
    if (Math.abs(ratio * factor - 1) < FACTOR_TOLERANCE) return { key: 'hintSmall', factor: text };
  }
  const decades = Math.log10(Math.abs(ratio));
  if (decades >= ORDER_DECADES) return { key: 'hintOrderBig' };
  if (decades <= -ORDER_DECADES) return { key: 'hintOrderSmall' };
  return { key: 'hint' };
}
