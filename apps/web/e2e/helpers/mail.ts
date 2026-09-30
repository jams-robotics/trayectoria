import type { APIRequestContext, Page } from '@playwright/test';

/**
 * Reads the auth emails of the local stack (#521). `supabase start` runs Mailpit on the port of
 * `[local_smtp]` in supabase/config.toml and nothing leaves the machine; the `e2e` job of CI
 * starts the same stack. The reauthentication code and the `token_hash` of the email links (#518)
 * are read here.
 */
const MAIL_API = 'http://127.0.0.1:54324/api/v1';

/** The six-digit code of the reauthentication email (template `reauthentication`, `{{ .Token }}`). */
const CODE = /\b(\d{6})\b/;

const POLL_ATTEMPTS = 40;
const POLL_INTERVAL_MS = 500;

interface MessageSummary {
  readonly ID: string;
}

interface SearchResult {
  readonly messages: readonly MessageSummary[];
}

interface Message {
  readonly Text: string;
}

/** The link of the templates `confirmation`, `magic_link` and `recovery` (PKCE flow, #518). */
const LINK = /token_hash=([^&\s"]+)&(?:amp;)?type=(email|recovery)/;

/** The text of the newest email to `email`, or `''` when there is none yet. */
async function newestText(request: APIRequestContext, email: string): Promise<string> {
  const search = await request.get(`${MAIL_API}/search`, { params: { query: `to:${email}` } });
  const { messages } = (await search.json()) as SearchResult;
  const newest = messages[0];
  if (newest === undefined) return '';
  const message = (await (await request.get(`${MAIL_API}/message/${newest.ID}`)).json()) as Message;
  return message.Text;
}

/** The code of the newest email to `email`, or `''` when there is none yet. */
async function newestCode(request: APIRequestContext, email: string): Promise<string> {
  return CODE.exec(await newestText(request, email))?.[1] ?? '';
}

/**
 * Waits for an email with a link to the site and returns its query, `?token_hash=…&type=…`. The
 * host of the link is the `site_url` of the stack, so the tests open the query on their own host.
 */
export async function emailLinkQuery(request: APIRequestContext, email: string): Promise<string> {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    const link = LINK.exec(await newestText(request, email));
    if (link !== null) return `?token_hash=${link[1] ?? ''}&type=${link[2] ?? ''}`;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`no email with a link reached ${email}`);
}

/**
 * Waits for the reauthentication email of `email` and returns its code. `previous` is the code
 * of an earlier email of the same account, so a resend is told apart from the first one.
 */
export async function reauthenticationCode(
  request: APIRequestContext,
  email: string,
  previous = '',
): Promise<string> {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    const code = await newestCode(request, email);
    if (code !== '' && code !== previous) return code;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`no reauthentication email reached ${email}`);
}

/**
 * The code step of #521 on the page: asks for a code (`reauth-send`), reads it from the email and
 * types it in the field labelled `codeLabel`. Returns the code, to pass as `previous` on a resend.
 */
export async function typeEmailedCode(
  page: Page,
  email: string,
  codeLabel: string,
  previous = '',
): Promise<string> {
  await page.getByTestId('reauth-send').click();
  const code = await reauthenticationCode(page.request, email, previous);
  await page.getByLabel(codeLabel, { exact: true }).fill(code);
  return code;
}
