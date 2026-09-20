import { SimConfig } from '@trayectoria/robot-spec';
import type { Result } from '@trayectoria/sim-core';

export type { SimConfig } from '@trayectoria/robot-spec';

// F4-05 (#131, decisiones 1 y 2): la configuración del simulador viaja en la URL, sin dependencias
// nuevas y sin servidor. El texto es el JSON de `SimConfig` comprimido con `deflate-raw`
// —`CompressionStream` es del navegador y de Node, no hay librería que añadir— y escrito en
// base64url, que es lo que una URL admite sin escapar nada.
//
// La descompresión nunca confía en el texto: cualquier paso que falle (base64 mal formado, flujo
// que no descomprime, JSON roto, objeto que no cumple el esquema) devuelve el mismo `invalid`, y
// quien llama muestra el aviso y abre con los valores por defecto.

/**
 * Una `SimConfig` validada con el esquema de robot-spec, o `null` si el dato no lo cumple. Es la
 * puerta por la que pasa todo lo que viene de fuera: el enlace, el almacenamiento local y la fila
 * de `robots`. `apps/web` no depende de `@trayectoria/robot-spec` (docs/ARCHITECTURE.md §2), así
 * que la validación le llega por aquí, igual que `parseStoredRobot` le llega por widgets.
 */
export function parseSimConfig(value: unknown): SimConfig | null {
  const parsed = SimConfig.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Formato de compresión del enlace; nativo en el navegador y en Node. */
const FORMAT = 'deflate-raw';

/** Parámetro de la URL que lleva la configuración: `/simuladores/movil?c=<encode>`. */
export const SHARE_PARAM = 'c';

/** Ruta de la página que el enlace abre. */
const SHARE_PATH = '/simuladores/movil';

/** Lo que `decode` devuelve cuando el texto no produce una `SimConfig`. */
export type DecodeError = 'invalid';

/** Lo que `encode` devuelve cuando la configuración no cabe en un enlace. */
export type EncodeError = 'tooLong';

// F4-05 (seguridad): un enlace corto puede llevar un `deflate-raw` que expande a decenas de MB.
// `MAX_LINK_CHARS` rechaza el texto antes de tocar `DecompressionStream`, y `MAX_DECODED_BYTES`
// corta la descompresión en marcha si, aun así, el flujo sigue produciendo bytes.
//
// #182: la cota sube de 2 000 a 8 000 caracteres. Con 2 000 una pista editada de más de unas
// decenas de segmentos ya no cabía y el enlace salía roto sin decirlo; 8 000 entra en el límite
// práctico de URL de los navegadores (docs/ARCHITECTURE.md §6) y deja sitio a pistas largas. La
// cota de bytes descomprimidos no cambia: es la que protege de la bomba de descompresión.

/** Máximo de caracteres del texto del enlace; por encima, `encode` falla y `decode` rechaza. */
export const MAX_LINK_CHARS = 8_000;

const MAX_DECODED_BYTES = 65_536;

/** Se lanza dentro de `through` cuando el flujo descomprimido supera `MAX_DECODED_BYTES`. */
class DecodedTooLargeError extends Error {}

/**
 * Los bytes de `data` pasados por `stream`, leídos de una vez. La entrada se arma como
 * `ReadableStream` y no como `Blob`: `Blob.stream()` no existe en el jsdom de los tests, y los
 * dos flujos nativos aceptan igual de bien uno que otro.
 *
 * Si el total supera `MAX_DECODED_BYTES` se cancela el lector y se lanza `DecodedTooLargeError`:
 * un enlace comprimido no debe poder expandirse sin cota en la pestaña de quien lo abre.
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

/** Base64url sin relleno: lo que una URL acepta sin escapar (`+/` → `-_`, sin `=`). */
function toBase64Url(bytes: Uint8Array<ArrayBuffer>): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Los bytes de un texto base64url, o `null` si no lo es. */
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
 * La configuración como texto del enlace: JSON → `deflate-raw` → base64url.
 *
 * #182 (decisión 2): una configuración cuyo texto pase de `MAX_LINK_CHARS` devuelve `tooLong` en
 * lugar de un enlace que `decode` rechazaría al otro lado. Quien llama avisa y no copia nada: más
 * vale no dar enlace que dar uno que no abre.
 */
export async function encode(config: SimConfig): Promise<Result<string, EncodeError>> {
  const bytes = await through(new TextEncoder().encode(JSON.stringify(config)), new CompressionStream(FORMAT));
  const text = toBase64Url(bytes);
  return text.length > MAX_LINK_CHARS ? { ok: false, error: 'tooLong' } : { ok: true, value: text };
}

/**
 * La configuración que lleva `text`, validada con el esquema `SimConfig` de robot-spec. Un texto
 * que no es base64url, que no descomprime, que no es JSON o que no cumple el esquema devuelve
 * `invalid`: para quien abre el enlace son el mismo caso, un enlace que no sirve.
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

/** El enlace que reproduce la configuración, sobre el origen que se le dé. */
export function shareLink(text: string, origin: string): string {
  return `${origin}${SHARE_PATH}?${SHARE_PARAM}=${text}`;
}
