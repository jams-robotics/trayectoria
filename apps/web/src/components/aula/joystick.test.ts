import { describe, expect, test } from 'vitest';

import { axesOf, clampToPad } from './joystick';

describe('axesOf', () => {
  test('a knob near the centre does not drive', () => {
    expect(axesOf(10, -10, 100)).toEqual({ steer: 0, go: 0 });
  });

  test('up drives forward, down backwards, left turns left', () => {
    expect(axesOf(0, -80, 100)).toEqual({ steer: 0, go: 1 });
    expect(axesOf(0, 80, 100)).toEqual({ steer: 0, go: -1 });
    expect(axesOf(-80, 0, 100)).toEqual({ steer: 1, go: 0 });
    expect(axesOf(60, -60, 100)).toEqual({ steer: -1, go: 1 });
  });
});

describe('clampToPad', () => {
  test('keeps the knob inside the ring', () => {
    expect(clampToPad(30, 40, 100)).toEqual({ x: 30, y: 40 });
    expect(clampToPad(300, 400, 100)).toEqual({ x: 60, y: 80 });
  });
});
