/**
 * Invite codes of the teacher's classroom (F3-02a). The alphabet drops the characters that are
 * read wrong when a code is dictated or copied from a board: I, O, 0 and 1.
 */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Length of an invite code, in characters. */
export const INVITE_CODE_LENGTH = 8;

/** Source of randomness: one number in [0, 1) per character, like `Math.random`. */
export type Rng = () => number;

/**
 * Uniform numbers in [0, 1) from `crypto.getRandomValues`; the browser default of `inviteCode`.
 * 2^32 as the divisor keeps the result below 1 for every 32-bit value.
 */
export function cryptoRng(): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return (values[0] ?? 0) / 2 ** 32;
}

/**
 * Builds an invite code of `INVITE_CODE_LENGTH` upper-case characters of `INVITE_CODE_ALPHABET`.
 * `rng` is injectable so tests are deterministic; it must return numbers in [0, 1).
 */
export function inviteCode(rng: Rng = cryptoRng): string {
  let code = '';
  for (let index = 0; index < INVITE_CODE_LENGTH; index += 1) {
    const draw = rng();
    const position = Math.min(
      INVITE_CODE_ALPHABET.length - 1,
      Math.max(0, Math.floor(draw * INVITE_CODE_ALPHABET.length)),
    );
    code += INVITE_CODE_ALPHABET[position];
  }
  return code;
}
