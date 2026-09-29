/**
 * Server check of the reauthentication code (#521). `reauthenticate()` of `@trayectoria/auth`
 * emails the signed-in user a six-digit code; `verify_reauthentication` (migration 0011) answers
 * whether it is the pending code of `auth.uid()` and burns it when it is not, so it cannot be
 * guessed in a loop. It runs with the learner's own session and the anon key, like every call.
 */
import { getDbClient, type DbClient } from '@trayectoria/db';

/** The shape of the code the email carries (`otp_length = 6` in supabase/config.toml). */
export const REAUTH_CODE_FORMAT = /^\d{6}$/;

/**
 * The code was wrong or expired: nothing was changed and the pending code is burnt, so the
 * learner has to ask for a new one. The UI turns this into `auth.reauth.invalid`.
 */
export class ReauthenticationError extends Error {
  constructor() {
    super('reauthentication code not valid');
    this.name = 'ReauthenticationError';
  }
}

/** Whether `nonce` is the caller's pending code. Rejects only when the call itself fails. */
export async function verifyReauthentication(
  nonce: string,
  db: DbClient = getDbClient(),
): Promise<boolean> {
  const { data, error } = await db.rpc('verify_reauthentication', { nonce });
  if (error !== null) throw new Error(error.message);
  return data === true;
}
