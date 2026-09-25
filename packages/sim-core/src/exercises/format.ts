const DEFAULT_SIG_FIGS = 3;
/** Below this magnitude `toPrecision` switches to exponential notation anyway. */
const MIN_PLAIN_MAGNITUDE = 1e-3;
/** At or above this magnitude the plain form would need too many padding zeros to stay readable. */
const MAX_PLAIN_MAGNITUDE = 1e6;
/**
 * Below this magnitude a value is floating-point noise around zero (a landing height of
 * -2.22e-16 m, #350), so it is shown as zero instead of in exponential notation.
 */
const NOISE_MAGNITUDE = 1e-12;

/**
 * Formats a number with a fixed count of significant figures and appends the unit.
 *
 * Trailing zeros are kept, so `format(0.67, 'm/s')` is `"0.670 m/s"`. Plain decimal notation is
 * used for `1e-3 <= |x| < 1e6` (and for zero); outside that range the result is exponential.
 * Values with `|x| < 1e-12` are rounding noise and print as zero, never as `-0.00`.
 * The unit is separated by a single space, or omitted entirely when it is empty.
 */
export function format(x: number, unit: string, sigFigs: number = DEFAULT_SIG_FIGS): string {
  if (!Number.isFinite(x)) {
    throw new RangeError(`format: x must be a finite number, received ${String(x)}`);
  }
  if (!Number.isInteger(sigFigs) || sigFigs < 1 || sigFigs > 21) {
    throw new RangeError(`format: sigFigs must be an integer in [1, 21], received ${sigFigs}`);
  }

  const magnitude = Math.abs(x);
  // `0` also replaces `-0`, whose `toFixed` would otherwise depend on the sign of zero.
  const value = magnitude < NOISE_MAGNITUDE ? 0 : x;
  const usePlain = value === 0 || (magnitude >= MIN_PLAIN_MAGNITUDE && magnitude < MAX_PLAIN_MAGNITUDE);
  const number = usePlain ? toPlain(value, sigFigs) : toExponential(value, sigFigs);

  return unit === '' ? number : `${number} ${unit}`;
}

/** Decimal notation with exactly `sigFigs` significant figures, padding zeros included. */
function toPlain(x: number, sigFigs: number): string {
  // Exponent of the leading digit: 0 for 1.23, -1 for 0.123, 2 for 123.
  const exponent = x === 0 ? 0 : Math.floor(Math.log10(Math.abs(x)));
  const decimals = sigFigs - 1 - exponent;

  if (decimals <= 0) {
    // Round away the digits beyond the significant ones instead of printing them.
    const step = 10 ** -decimals;
    return String(Math.round(x / step) * step);
  }
  const fixed = x.toFixed(decimals);
  // Rounding can carry into a new leading digit (9.99 -> 10.0 with 2 figures); redo it once.
  const carriedExponent = Math.floor(Math.log10(Math.abs(Number(fixed))));
  if (Number(fixed) !== 0 && carriedExponent !== exponent) {
    return toPlain(Number(fixed), sigFigs);
  }
  return fixed;
}

/** Exponential notation with `sigFigs` significant figures and no zero padding in the exponent. */
function toExponential(x: number, sigFigs: number): string {
  const [mantissa = '', exponent = '0'] = x.toExponential(sigFigs - 1).split('e');
  const sign = exponent.startsWith('-') ? '-' : '+';
  return `${mantissa}e${sign}${Math.abs(Number(exponent))}`;
}
