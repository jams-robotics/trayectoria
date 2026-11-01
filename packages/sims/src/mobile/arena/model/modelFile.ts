import type { Vector3 } from 'three';

// Validation of a model file before anything parses it, and the automatic fit to the chassis.
// Pure: no DOM, no three loaders. Nothing is executed: STL and GLB are plain data.

export const MAX_MODEL_BYTES = 10 * 1024 * 1024;

export type ModelKind = 'stl' | 'glb';

export type ModelCheckError = 'extension' | 'size' | 'empty' | 'header';

export type ModelCheck =
  | { readonly ok: true; readonly kind: ModelKind }
  | { readonly ok: false; readonly error: ModelCheckError };

const STL_HEADER = 80;
const STL_TRIANGLE = 50;

function ascii(bytes: Uint8Array, from: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(from, from + length));
}

function kindOf(name: string): ModelKind | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.stl')) return 'stl';
  if (lower.endsWith('.glb')) return 'glb';
  return null;
}

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** A GLB starts with `glTF`, version 2, and declares its own length. */
function isGlb(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 20 || ascii(bytes, 0, 4) !== 'glTF') return false;
  const data = view(bytes);
  return data.getUint32(4, true) === 2 && data.getUint32(8, true) === bytes.byteLength;
}

/** Binary STL: the triangle count in the header must match the size; ASCII STL: `solid`+`facet`. */
function isStl(bytes: Uint8Array): boolean {
  if (bytes.byteLength >= STL_HEADER + 4) {
    const count = view(bytes).getUint32(STL_HEADER, true);
    if (STL_HEADER + 4 + count * STL_TRIANGLE === bytes.byteLength) return count > 0;
  }
  const text = ascii(bytes, 0, Math.min(bytes.byteLength, 1024)).trimStart();
  return text.startsWith('solid') && text.includes('facet');
}

/** Name and size only, so an oversized file is refused before it is read. */
export function checkNameAndSize(name: string, size: number): ModelCheck {
  const kind = kindOf(name);
  if (kind === null) return { ok: false, error: 'extension' };
  if (size <= 0) return { ok: false, error: 'empty' };
  if (size > MAX_MODEL_BYTES) return { ok: false, error: 'size' };
  return { ok: true, kind };
}

/** Extension, size and magic header of the whole file. */
export function validateModel(name: string, bytes: Uint8Array): ModelCheck {
  const named = checkNameAndSize(name, bytes.byteLength);
  if (!named.ok) return named;
  const good = named.kind === 'glb' ? isGlb(bytes) : isStl(bytes);
  return good ? named : { ok: false, error: 'header' };
}

/** Uniform scale that makes the box fit the chassis: forward in x, side to side in y. */
export function autoScale(size: Vector3, length_m: number, width_m: number): number {
  const fit = Math.min(length_m / Math.max(size.x, 1e-9), width_m / Math.max(size.y, 1e-9));
  return Number.isFinite(fit) && fit > 0 ? fit : 1;
}
