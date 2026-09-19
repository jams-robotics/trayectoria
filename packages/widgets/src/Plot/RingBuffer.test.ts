import { describe, expect, it } from 'vitest';

import { RingBuffer } from './RingBuffer';

/** Convenience: the arrays of `toArrays` as plain arrays, easier to assert against. */
function arrays(buffer: RingBuffer, sinceTime_s?: number): number[][] {
  return buffer.toArrays(sinceTime_s).map((row) => Array.from(row));
}

describe('RingBuffer', () => {
  it('overwrites circularly once it is full (valor dorado del ticket F2-01b)', () => {
    const buffer = new RingBuffer(4);
    for (const t_s of [0, 1, 2, 3, 4]) buffer.push(t_s, [t_s * 10]);

    const [times_s, values] = arrays(buffer);
    expect(times_s).toEqual([1, 2, 3, 4]);
    expect(values).toEqual([10, 20, 30, 40]);
    expect(buffer.length).toBe(4);
  });

  it('keeps every sample while it is not full', () => {
    const buffer = new RingBuffer(4);
    buffer.push(0, [5]);
    buffer.push(0.5, [6]);

    expect(arrays(buffer)).toEqual([
      [0, 0.5],
      [5, 6],
    ]);
    expect(buffer.length).toBe(2);
    expect(buffer.capacity).toBe(4);
  });

  it('holds one column per series', () => {
    const buffer = new RingBuffer(3, 2);
    buffer.push(0, [1, -1]);
    buffer.push(1, [2, -2]);

    expect(buffer.seriesCount).toBe(2);
    expect(arrays(buffer)).toEqual([
      [0, 1],
      [1, 2],
      [-1, -2],
    ]);
  });

  it('trims to the sliding window with sinceTime_s', () => {
    const buffer = new RingBuffer(10);
    for (const t_s of [0, 1, 2, 3, 4, 5]) buffer.push(t_s, [t_s]);

    expect(arrays(buffer, 3)).toEqual([
      [3, 4, 5],
      [3, 4, 5],
    ]);
    // The bound is inclusive and lands between samples without dropping the newer ones.
    expect(arrays(buffer, 2.5)).toEqual([
      [3, 4, 5],
      [3, 4, 5],
    ]);
    // A window older than every sample keeps them all; a newer one empties the arrays.
    expect(arrays(buffer, -1)[0]).toHaveLength(6);
    expect(arrays(buffer, 99)).toEqual([[], []]);
  });

  it('trims the window after wrapping around', () => {
    const buffer = new RingBuffer(3);
    for (const t_s of [0, 1, 2, 3, 4]) buffer.push(t_s, [t_s]);

    expect(arrays(buffer, 3)).toEqual([
      [3, 4],
      [3, 4],
    ]);
  });

  it('bumps the revision on every mutation so consumers can skip redraws', () => {
    const buffer = new RingBuffer(2);
    const initial = buffer.revision;
    buffer.push(0, [1]);
    expect(buffer.revision).toBe(initial + 1);
    buffer.clear();
    expect(buffer.revision).toBe(initial + 2);
    expect(buffer.length).toBe(0);
    expect(arrays(buffer)).toEqual([[], []]);
  });

  it('starts over after clear without leaking the old samples', () => {
    const buffer = new RingBuffer(3);
    for (const t_s of [0, 1, 2, 3]) buffer.push(t_s, [t_s]);
    buffer.clear();
    buffer.push(10, [10]);

    expect(arrays(buffer)).toEqual([[10], [10]]);
  });

  it('rejects an invalid capacity or series count', () => {
    expect(() => new RingBuffer(0)).toThrow(RangeError);
    expect(() => new RingBuffer(2.5)).toThrow(RangeError);
    expect(() => new RingBuffer(4, 0)).toThrow(RangeError);
    expect(() => new RingBuffer(4, 1.5)).toThrow(RangeError);
  });

  it('rejects a sample whose width does not match the series count', () => {
    const buffer = new RingBuffer(4, 2);
    expect(() => {
      buffer.push(0, [1]);
    }).toThrow(RangeError);
  });
});
