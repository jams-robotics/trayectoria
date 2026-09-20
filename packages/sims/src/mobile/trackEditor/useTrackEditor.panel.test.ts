import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { useTrackEditor } from './useTrackEditor';

// F4-01b: el panel numérico, los presets y la serialización del hook. Va aparte de
// useTrackEditor.test.ts, que cubre el dibujo con el puntero, para no pasar de 300 líneas por
// archivo (docs/STANDARDS.md §4).
describe('useTrackEditor: panel, presets y archivos (F4-01b)', () => {
  test('setRadius of the panel changes the radius of the selected arc', () => {
    const { result } = renderHook(() => useTrackEditor());
    act(() => {
      result.current.setTool('arc');
    });
    act(() => {
      result.current.pointerDown([0, 0]);
    });
    act(() => {
      result.current.pointerMove([0.1, 0.05]);
    });
    act(() => {
      result.current.pointerUp([0.2, 0]);
    });
    act(() => {
      result.current.setRadius(0.3);
    });
    const segment = result.current.state.track.segments[0];
    if (segment?.type !== 'arc') throw new Error('expected an arc');
    expect(segment.radius_m).toBeCloseTo(0.3, 12);
  });

  test('moveEndpoint of the panel moves one end of the selected segment', () => {
    const { result } = renderHook(() => useTrackEditor());
    act(() => {
      result.current.setTool('line');
    });
    act(() => {
      result.current.pointerDown([0, 0]);
    });
    act(() => {
      result.current.pointerUp([0.3, 0]);
    });
    act(() => {
      result.current.moveEndpoint('to', [0.4, 0.1]);
    });
    expect(result.current.state.track.segments[0]).toEqual({
      type: 'line',
      from: [0, 0],
      to: [0.4, 0.1],
    });
  });

  test('setCcw flips the sweep of the selected arc keeping its radius', () => {
    const { result } = renderHook(() => useTrackEditor());
    act(() => {
      result.current.setTool('arc');
    });
    act(() => {
      result.current.pointerDown([0, 0]);
    });
    act(() => {
      result.current.pointerMove([0.1, 0.05]);
    });
    act(() => {
      result.current.pointerUp([0.2, 0]);
    });
    act(() => {
      result.current.setCcw(false);
    });
    const segment = result.current.state.track.segments[0];
    if (segment?.type !== 'arc') throw new Error('expected an arc');
    expect(segment.ccw).toBe(false);
    expect(segment.radius_m).toBeCloseTo(0.125, 12);
  });

  test('the panel operations are no-ops with nothing selected', () => {
    const { result } = renderHook(() => useTrackEditor());
    act(() => {
      result.current.setRadius(0.3);
    });
    act(() => {
      result.current.setCcw(true);
    });
    act(() => {
      result.current.moveEndpoint('to', [1, 1]);
    });
    expect(result.current.state.track.segments).toEqual([]);
    expect(result.current.canUndo).toBe(false);
  });

  test('setLineWidth changes the global line width', () => {
    const { result } = renderHook(() => useTrackEditor());
    act(() => {
      result.current.setLineWidth(0.03);
    });
    expect(result.current.state.track.lineWidth_m).toBe(0.03);
  });

  test('a preset replaces the track and clears the unsaved flag', () => {
    const { result } = renderHook(() => useTrackEditor());
    act(() => {
      result.current.applyPreset('oval');
    });
    expect(result.current.state.track.segments.length).toBeGreaterThan(0);
    expect(result.current.continuity.closed).toBe(true);
    expect(result.current.dirty).toBe(false);
  });

  test('loadJson replaces the track and a bad file leaves it untouched', () => {
    const { result } = renderHook(() => useTrackEditor());
    act(() => {
      result.current.applyPreset('oval');
    });
    const before = result.current.state.track;
    const json = result.current.toJson();
    let failed: string | null = null;
    act(() => {
      failed = result.current.loadJson('{ not json');
    });
    expect(failed).not.toBe(null);
    expect(result.current.state.track).toEqual(before);
    act(() => {
      result.current.applyPreset('crossing');
    });
    let ok: string | null = 'x';
    act(() => {
      ok = result.current.loadJson(json);
    });
    expect(ok).toBe(null);
    expect(result.current.state.track).toEqual(before);
    expect(result.current.dirty).toBe(false);
  });

  test('markSaved clears the unsaved flag after an edit', () => {
    const { result } = renderHook(() => useTrackEditor());
    act(() => {
      result.current.setTool('line');
    });
    act(() => {
      result.current.pointerDown([0, 0]);
    });
    act(() => {
      result.current.pointerUp([0.3, 0]);
    });
    expect(result.current.dirty).toBe(true);
    act(() => {
      result.current.markSaved();
    });
    expect(result.current.dirty).toBe(false);
  });

  test('an initial track opens the editor on it', () => {
    const { result } = renderHook(() =>
      useTrackEditor({
        initialTrack: {
          segments: [{ type: 'line', from: [0, 0], to: [1, 0] }],
          lineWidth_m: 0.02,
        },
      }),
    );
    expect(result.current.state.track.segments).toHaveLength(1);
  });

  test('onChange reports every committed track', () => {
    const seen: number[] = [];
    const { result } = renderHook(() =>
      useTrackEditor({
        onChange: (track) => {
          seen.push(track.segments.length);
        },
      }),
    );
    act(() => {
      result.current.setTool('line');
    });
    act(() => {
      result.current.pointerDown([0, 0]);
    });
    act(() => {
      result.current.pointerUp([0.3, 0]);
    });
    act(() => {
      result.current.undo();
    });
    expect(seen).toEqual([1, 0]);
  });

  test('a pointerup without a pointerdown draws nothing', () => {
    const { result } = renderHook(() => useTrackEditor());
    act(() => {
      result.current.setTool('line');
    });
    act(() => {
      result.current.pointerUp([0.3, 0]);
    });
    expect(result.current.state.track.segments).toEqual([]);
  });

  test('a drag shorter than the snapping radius draws nothing', () => {
    const { result } = renderHook(() => useTrackEditor());
    act(() => {
      result.current.setTool('line');
    });
    act(() => {
      result.current.pointerDown([0, 0]);
    });
    act(() => {
      result.current.pointerUp([0.0005, 0]);
    });
    expect(result.current.state.track.segments).toEqual([]);
    expect(result.current.draft).toBe(null);
  });

  test('the draft follows the pointer while a stroke is in progress', () => {
    const { result } = renderHook(() => useTrackEditor());
    act(() => {
      result.current.setTool('line');
    });
    act(() => {
      result.current.pointerDown([0, 0]);
    });
    expect(result.current.draft?.from).toEqual([0, 0]);
    act(() => {
      result.current.pointerMove([0.2, 0.1]);
    });
    expect(result.current.draft?.to).toEqual([0.2, 0.1]);
    expect(result.current.draft?.track.segments).toHaveLength(1);
  });

  test('an arc draft previews an arc, not a straight line', () => {
    const { result } = renderHook(() => useTrackEditor());
    act(() => {
      result.current.setTool('arc');
    });
    act(() => {
      result.current.pointerDown([0, 0]);
    });
    act(() => {
      result.current.pointerMove([0.2, 0.05]);
    });
    expect(result.current.draft?.track.segments[0]?.type).toBe('arc');
  });

  test('a pointermove with no stroke in progress is ignored', () => {
    const { result } = renderHook(() => useTrackEditor());
    act(() => {
      result.current.pointerMove([0.2, 0.1]);
    });
    expect(result.current.draft).toBe(null);
  });

  test('the select and erase tools never start a draft', () => {
    const { result } = renderHook(() => useTrackEditor());
    act(() => {
      result.current.setTool('select');
    });
    act(() => {
      result.current.pointerDown([0, 0]);
    });
    expect(result.current.draft).toBe(null);
  });
});
