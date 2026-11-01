import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';

import { MAX_MODEL_BYTES, autoScale, checkNameAndSize, validateModel } from './modelFile';

function binaryStl(triangles: number): Uint8Array {
  const bytes = new Uint8Array(84 + triangles * 50);
  new DataView(bytes.buffer).setUint32(80, triangles, true);
  return bytes;
}

function glb(length: number, version = 2): Uint8Array {
  const bytes = new Uint8Array(length);
  bytes.set([0x67, 0x6c, 0x54, 0x46]);
  const data = new DataView(bytes.buffer);
  data.setUint32(4, version, true);
  data.setUint32(8, length, true);
  return bytes;
}

const text = (value: string): Uint8Array => new TextEncoder().encode(value);

describe('validateModel', () => {
  it('accepts binary and ASCII STL and GLB', () => {
    expect(validateModel('a.STL', binaryStl(2))).toEqual({ ok: true, kind: 'stl' });
    expect(validateModel('a.stl', text('solid x\nfacet normal 0 0 1\nendsolid'))).toEqual({
      ok: true,
      kind: 'stl',
    });
    expect(validateModel('a.glb', glb(40))).toEqual({ ok: true, kind: 'glb' });
  });

  it('rejects other extensions, as STEP', () => {
    expect(validateModel('a.step', binaryStl(1))).toEqual({ ok: false, error: 'extension' });
    expect(checkNameAndSize('a.gltf', 10)).toEqual({ ok: false, error: 'extension' });
  });

  it('rejects empty and oversized files', () => {
    expect(checkNameAndSize('a.stl', 0)).toEqual({ ok: false, error: 'empty' });
    expect(checkNameAndSize('a.stl', MAX_MODEL_BYTES + 1)).toEqual({ ok: false, error: 'size' });
    expect(checkNameAndSize('a.stl', MAX_MODEL_BYTES)).toEqual({ ok: true, kind: 'stl' });
  });

  it('rejects a wrong magic header or a truncated file', () => {
    expect(validateModel('a.glb', binaryStl(1))).toEqual({ ok: false, error: 'header' });
    expect(validateModel('a.glb', glb(40, 1))).toEqual({ ok: false, error: 'header' });
    expect(validateModel('a.glb', glb(40).subarray(0, 30))).toEqual({ ok: false, error: 'header' });
    expect(validateModel('a.stl', binaryStl(3).subarray(0, 100))).toEqual({
      ok: false,
      error: 'header',
    });
    expect(validateModel('a.stl', text('hello world'))).toEqual({ ok: false, error: 'header' });
  });
});

describe('fit to the chassis', () => {
  it('scales the box to the tighter of length and width', () => {
    expect(autoScale(new Vector3(2, 1, 1), 0.2, 0.2)).toBeCloseTo(0.1);
    expect(autoScale(new Vector3(1, 2, 1), 0.2, 0.2)).toBeCloseTo(0.1);
    expect(autoScale(new Vector3(0, 0, 0), 0.2, 0.2)).toBeGreaterThan(0);
  });
});
