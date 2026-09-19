import { describe, expect, it } from 'vitest';
import { PRESET_LINE_WIDTH_M, oval, presets, serializeTrack, tightCurves } from '@trayectoria/sim-core';
import { fromJson, fromPreset, toJson } from './io';
import { addArc, addLine, emptyEditor } from './model';

describe('track editor io (F4-01a)', () => {
  it('round-trips a state through JSON', () => {
    const state = addArc(addLine(emptyEditor(), [0, 0], [0.2, 0]), [0.2, 0], [0.2, 0.2], 0.1, true);
    const parsed = fromJson(toJson(state));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.track).toEqual(state.track);
      expect(parsed.value.selected).toBeNull();
    }
  });

  it('serializes exactly like sim-core', () => {
    const state = addLine(emptyEditor(), [0, 0], [0.2, 0]);
    expect(toJson(state)).toBe(serializeTrack(state.track));
  });

  it('reports an error on JSON that is not a track', () => {
    const parsed = fromJson('{}');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toMatch(/version/);
    }
    expect(fromJson('not json').ok).toBe(false);
  });

  it('loads a preset by name with nothing selected', () => {
    const state = fromPreset('oval');
    expect(state.track).toEqual(oval);
    expect(state.track.lineWidth_m).toBe(PRESET_LINE_WIDTH_M);
    expect(state.selected).toBeNull();
    expect(fromPreset('tightCurves').track).toEqual(tightCurves);
    expect(Object.keys(presets)).toContain('sCurve');
  });
});
