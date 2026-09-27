/**
 * The rejection of a write by a `CHECK` constraint (#202). PostgreSQL reports every check with
 * SQLSTATE `23514` and carries the constraint name in the message, so the name is what tells one
 * check from another on the same table (the size bounds of migration 0007, #210, share the code
 * with the checks of `kind` and `name`).
 */
const CHECK_VIOLATION = '23514';

/** The shape of a PostgREST error that this check reads. */
interface DbError {
  readonly code?: string;
  readonly message: string;
}

/** Whether `error` is the violation of the check constraint named `constraint`. */
export function isCheckViolation(error: DbError, constraint: string): boolean {
  return error.code === CHECK_VIOLATION && error.message.includes(constraint);
}

/**
 * The rejection of an insert by the row limit per owner of migration 0008 (#215): 20 robots,
 * 50 tracks, 5000 attempts. The database raises it as a `23514` named `<table>_owner_row_limit`;
 * the save points turn it into this error so the notice can say what the limit is.
 */
export class OwnerRowLimitError extends Error {
  override name = 'OwnerRowLimitError';
}
