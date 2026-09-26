import { SimConfig } from '@trayectoria/robot-spec';
import type { Result } from '@trayectoria/sim-core';

export type { SimConfig } from '@trayectoria/robot-spec';

// F4-05 (#131, decisions 1 and 2): the simulator configuration travels in the URL, with no new
// dependencies and no server. The text is the `SimConfig` JSON compressed with `deflate-raw`
// —`CompressionStream` belongs to the browser and to Node, there is no library to add— and written in
// base64url, which is what a URL accepts without escaping anything.
//
// Decompression never trusts the text: any step that fails (malformed base64, stream
// that does not decompress, broken JSON, object that does not meet the schema) returns the same `invalid`, and
// the caller shows the warning and opens with the default values.

/**
 * A `SimConfig` validated with the robot-spec schema, or `null` if the data does not meet it. It is the
 * gate through which everything coming from outside passes: the link, local storage and the
 * `robots` row. `apps/web` does not depend on `@trayectoria/robot-spec` (docs/ARCHITECTURE.md §2), so
 * the validation reaches it through here, just like `parseStoredRobot` reaches it through widgets.
 */
export function parseSimConfig(value: unknown): SimConfig | null {
  const parsed = SimConfig.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Compression format of the link; native in the browser and in Node. */
const FORMAT = 'deflate-raw';

/** URL parameter that carries the configuration: `/simuladores/movil?c=<encode>`. */
export const SHARE_PARAM = 'c';

/** Path of the page the link opens. */
const SHARE_PATH = '/simuladores/movil';

/** What `decode` returns when the text does not produce a `SimConfig`. */
export type DecodeError = 'invalid';

/** What `encode` returns when the configuration does not fit in a link. */
export type EncodeError = 'tooLong';

// F4-05 (security): a short link can carry a `deflate-raw` that expands to tens of MB.
// `MAX_LINK_CHARS` rejects the text before touching `DecompressionStream`, and `MAX_DECODED_BYTES`
// cuts the running decompression if, even so, the stream keeps producing bytes.
//
// #182: the bound goes up from 2 000 to 8 000 characters. With 2 000 an edited track of more than a few
// dozen segments no longer fitted and the link came out broken without saying so; 8 000 is within the
// practical URL limit of browsers (docs/ARCHITECTURE.md §6) and leaves room for long tracks. The
// bound on decompressed bytes does not change: it is the one that protects against the decompression bomb.

/** Maximum characters of the link text; above it, `encode` fails and `decode` rejects. */
export const MAX_LINK_CHARS = 8_000;

const MAX_DECODED_BYTES = 65_536;

/** Thrown inside `through` when the decompressed stream exceeds `MAX_DECODED_BYTES`. */
class DecodedTooLargeError extends Error {}

/**
 * The bytes of `data` passed through `stream`, read in one go. The input is built as a
 * `ReadableStream` and not as a `Blob`: `Blob.stream()` does not exist in the tests' jsdom, and the
 * two native streams accept either one equally well.
 *
 * If the total exceeds `MAX_DECODED_BYTES` the reader is cancelled and `DecodedTooLargeError` is thrown:
 * a compressed link must not be able to expand without bound in the tab of whoever opens it.
 */
async function through(
  data: Uint8Array<ArrayBuffer>,
  stream: ReadableWritablePair<Uint8Array<ArrayBuffer>, BufferSource>,
): Promise<Uint8Array<ArrayBuffer>> {
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
  const piped = source.pipeThrough(stream);
  const chunks: Array<Uint8Array<ArrayBuffer>> = [];
  const reader = piped.getReader();
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_DECODED_BYTES) {
      await reader.cancel();
      throw new DecodedTooLargeError();
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/** Unpadded base64url: what a URL accepts without escaping (`+/` → `-_`, no `=`). */
function toBase64Url(bytes: Uint8Array<ArrayBuffer>): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The bytes of a base64url text, or `null` if it is not one. */
function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (text === '' || !/^[A-Za-z0-9_-]+$/.test(text)) return null;
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  try {
    const binary = atob(base64);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

/**
 * The configuration as link text: JSON → `deflate-raw` → base64url.
 *
 * #182 (decision 2): a configuration whose text exceeds `MAX_LINK_CHARS` returns `tooLong` instead
 * of a link that `decode` would reject on the other side. The caller warns and copies nothing: better
 * to give no link than to give one that does not open.
 */
export async function encode(config: SimConfig): Promise<Result<string, EncodeError>> {
  const bytes = await through(new TextEncoder().encode(JSON.stringify(config)), new CompressionStream(FORMAT));
  const text = toBase64Url(bytes);
  return text.length > MAX_LINK_CHARS ? { ok: false, error: 'tooLong' } : { ok: true, value: text };
}

/**
 * The configuration carried by `text`, validated with the robot-spec `SimConfig` schema. A text
 * that is not base64url, that does not decompress, that is not JSON or that does not meet the schema returns
 * `invalid`: for whoever opens the link they are the same case, a link that does not work.
 */
export async function decode(text: string): Promise<Result<SimConfig, DecodeError>> {
  if (text.length > MAX_LINK_CHARS) return { ok: false, error: 'invalid' };
  const bytes = fromBase64Url(text);
  if (bytes === null) return { ok: false, error: 'invalid' };
  let json: string;
  try {
    const plain = await through(bytes, new DecompressionStream(FORMAT));
    json = new TextDecoder().decode(plain);
  } catch {
    return { ok: false, error: 'invalid' };
  }
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, error: 'invalid' };
  }
  const config = parseSimConfig(data);
  return config === null ? { ok: false, error: 'invalid' } : { ok: true, value: config };
}

/** The link that reproduces the configuration, on the given origin. */
export function shareLink(text: string, origin: string): string {
  return `${origin}${SHARE_PATH}?${SHARE_PARAM}=${text}`;
}
