import { describe, expect, it, vi } from 'vitest';
import { REFERENCE_PID_PARAMS } from '@trayectoria/sim-core';
import type { SimConfig } from '@trayectoria/robot-spec';

import { MAX_LINK_CHARS, SHARE_PARAM, decode, encode, shareLink } from './codec';

// F4-05 (#131, decisión 8): los valores dorados del ticket. El enlace del óvalo con el PID de
// referencia y semilla 1 es el caso que la spec fija, así que se comprueba tal cual.

/** La configuración dorada del ticket: óvalo, PID de referencia y semilla 1. */
const GOLDEN: SimConfig = {
  id: 'cfg-golden',
  name: 'Óvalo con el PID de referencia',
  track: { preset: 'oval' },
  controller: 'pid',
  params: { ...REFERENCE_PID_PARAMS },
  seed: 1,
};

/** Longitud máxima del texto del enlace dorado que pide el criterio de aceptación. */
const GOLDEN_MAX_LENGTH = 2000;

/** Segmentos de la pista sintética cuyo enlace sigue cabiendo (#182, decisión 3). */
const SHORT_TRACK_SEGMENTS = 30;

/** Segmentos de la pista sintética cuyo enlace ya no cabe: por encima de `MAX_LINK_CHARS`. */
const LONG_TRACK_SEGMENTS = 250;

/**
 * Una pista serializada de `count` segmentos de línea, con coordenadas que no se repiten: un
 * `deflate-raw` sobre números iguales comprimiría a casi nada y no mediría lo que interesa.
 */
function syntheticTrack(count: number): string {
  const segments = Array.from({ length: count }, (_unused, k) => ({
    type: 'line',
    from: [k * 0.137251, Math.sin(k) * 1.618034],
    to: [(k + 1) * 0.137251, Math.cos(k) * 1.414214],
  }));
  return JSON.stringify({ version: 1, lineWidth_m: 0.02, segments });
}

/** El texto de `config`, o el fallo si no cabe; falla el test si se esperaba que cupiera. */
async function encodedText(config: SimConfig): Promise<string> {
  const result = await encode(config);
  if (!result.ok) throw new Error(`encode falló: ${result.error}`);
  return result.value;
}

describe('codec (F4-05)', () => {
  it('la ida y vuelta devuelve la misma configuración', async () => {
    const result = await decode(await encodedText(GOLDEN));
    expect(result).toEqual({ ok: true, value: GOLDEN });
  });

  it('el enlace del óvalo con el PID de referencia cabe y solo usa base64url', async () => {
    const text = await encodedText(GOLDEN);
    expect(text.length).toBeLessThan(GOLDEN_MAX_LENGTH);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('una pista editada completa también da la vuelta', async () => {
    const track = JSON.stringify({
      version: 1,
      lineWidth_m: 0.02,
      segments: [{ kind: 'line', from: [0, 0], to: [1, 0] }],
    });
    const config: SimConfig = { ...GOLDEN, id: 'cfg-track', track, controller: 'p' };
    const result = await decode(await encodedText(config));
    expect(result).toEqual({ ok: true, value: config });
  });

  it('un texto que no es base64url es inválido', async () => {
    await expect(decode('***')).resolves.toEqual({ ok: false, error: 'invalid' });
  });

  it('base64url bien formado pero que no descomprime es inválido', async () => {
    await expect(decode('AAAA')).resolves.toEqual({ ok: false, error: 'invalid' });
  });

  it('un JSON que no cumple el esquema SimConfig es inválido', async () => {
    // Un objeto sin `controller` ni `params`: base64url correcto, deflate correcto, esquema no.
    const bad = await encodeRaw(JSON.stringify({ id: 'x', name: 'y' }));
    await expect(decode(bad)).resolves.toEqual({ ok: false, error: 'invalid' });
  });

  it('un texto que descomprime pero no es JSON es inválido', async () => {
    await expect(decode(await encodeRaw('no es json'))).resolves.toEqual({
      ok: false,
      error: 'invalid',
    });
  });

  it('el texto vacío es inválido', async () => {
    await expect(decode('')).resolves.toEqual({ ok: false, error: 'invalid' });
  });

  it('un texto más largo que el máximo del enlace es inválido sin descomprimir', async () => {
    const decompress = vi.spyOn(globalThis, 'DecompressionStream');
    const text = 'A'.repeat(MAX_LINK_CHARS + 1);
    expect(text.length).toBe(8001);
    await expect(decode(text)).resolves.toEqual({ ok: false, error: 'invalid' });
    expect(decompress).not.toHaveBeenCalled();
    decompress.mockRestore();
  });

  it('la cota del enlace es de 8 000 caracteres (#182, decisión 1)', () => {
    expect(MAX_LINK_CHARS).toBe(8000);
  });

  it(`una pista de ${String(SHORT_TRACK_SEGMENTS)} segmentos cabe en el enlace y da la vuelta`, async () => {
    const config: SimConfig = {
      ...GOLDEN,
      id: 'cfg-30',
      track: syntheticTrack(SHORT_TRACK_SEGMENTS),
    };
    const text = await encodedText(config);
    expect(text.length).toBeLessThanOrEqual(MAX_LINK_CHARS);
    await expect(decode(text)).resolves.toEqual({ ok: true, value: config });
  });

  it('una pista de muchos segmentos no cabe y `encode` devuelve `tooLong`', async () => {
    const config: SimConfig = {
      ...GOLDEN,
      id: 'cfg-largo',
      track: syntheticTrack(LONG_TRACK_SEGMENTS),
    };
    await expect(encode(config)).resolves.toEqual({ ok: false, error: 'tooLong' });
  });

  it('un payload que descomprime a más de 64 KiB es inválido', async () => {
    const oneMegabyteOfZeros = JSON.stringify({ padding: '0'.repeat(1024 * 1024) });
    const text = await encodeRaw(oneMegabyteOfZeros);
    await expect(decode(text)).resolves.toEqual({ ok: false, error: 'invalid' });
  });

  it('el enlace lleva el texto en el parámetro `c` de la página del simulador', async () => {
    const text = await encodedText(GOLDEN);
    expect(shareLink(text, 'https://trayectoria.test')).toBe(
      `https://trayectoria.test/simuladores/movil?${SHARE_PARAM}=${text}`,
    );
  });
});

/** Comprime y codifica un JSON cualquiera, para probar textos que el esquema rechaza. */
async function encodeRaw(json: string): Promise<string> {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(json));
      controller.close();
    },
  });
  const piped = source.pipeThrough(
    new CompressionStream('deflate-raw') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>,
  );
  const chunks: Uint8Array[] = [];
  const reader = piped.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  let binary = '';
  for (const chunk of chunks) for (const byte of chunk) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
