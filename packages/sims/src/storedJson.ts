/**
 * Size bound of the `jsonb` columns the client writes (docs/ARCHITECTURE.md §5.1, #204, #210):
 * `tracks.track` and `robots.spec` have `check (pg_column_size(...) < 65536)`. The client checks
 * the same bound before saving and warns the user instead of letting the database reject the
 * write. The database stores `jsonb` in its own binary form, so this is the size of the text,
 * not of the column: the save points also map the `23514` of the check to the same warning.
 */

/** 64 KiB: the same bound docs/ARCHITECTURE.md §6 applies to the shared link. */
export const MAX_STORED_JSON_BYTES = 65_536;

/** Whether the UTF-8 bytes of the `JSON.stringify` text of `value` stay under the bound. */
export function fitsStoredJson(value: unknown): boolean {
  const bytes = new TextEncoder().encode(JSON.stringify(value)).length;
  return bytes < MAX_STORED_JSON_BYTES;
}
