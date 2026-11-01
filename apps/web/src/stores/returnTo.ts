// Where to go after signing in (#685): a student who opens the class QR without a session loses
// the `#t=` fragment on the way to the login. It is kept here, in this tab only, and deleted when
// read; the token never goes in a query string, so it does not reach a log or a `Referer`.
const RETURN_TO_KEY = 'trayectoria:return-to';

// Tabs and line breaks are stripped by URL parsers, so a `/`, tab, `/host` would turn into `//host`.
const hasControlChar = (value: string): boolean => [...value].some((c) => c.charCodeAt(0) < 32);

/** An internal path only: starts with one `/` and is not protocol-relative (`//host`, `/` + backslash). */
export function isInternalPath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') && !hasControlChar(value);
}

export function rememberReturnTo(path: string): void {
  if (!isInternalPath(path)) return;
  try {
    sessionStorage.setItem(RETURN_TO_KEY, path);
  } catch {
    // Storage blocked: the student signs in and lands on the account page, as before.
  }
}

/** The remembered path, once; `fallback` when there is none or it is not internal. */
export function takeReturnTo(fallback: string): string {
  try {
    const value = sessionStorage.getItem(RETURN_TO_KEY);
    sessionStorage.removeItem(RETURN_TO_KEY);
    return value !== null && isInternalPath(value) ? value : fallback;
  } catch {
    return fallback;
  }
}
