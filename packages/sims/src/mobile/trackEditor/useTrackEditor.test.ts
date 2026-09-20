import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { arcFromDrag, useTrackEditor } from './useTrackEditor';

// F4-01b, valores dorados del issue #126: un arrastre de (0,0) a (0.2,0) en modo Arco por
// encima de la cuerda produce un arco de radio cuerda/2 · 1.25 = 0.125 m. El signo de `ccw` se
// fija aquí: el punto intermedio del arrastre está a la izquierda de la cuerda from → to
// (producto cruzado > 0) y eso es el sentido antihorario (decisión 5 del comentario de #126).
describe('arcFromDrag (F4-01b)', () => {
  test('a drag of (0,0) → (0.2,0) above the chord gives radius_m = 0.125 and ccw', () => {
    const arc = arcFromDrag([0, 0], [0.2, 0], [0.1, 0.05]);
    expect(arc.radius_m).toBeCloseTo(0.125, 12);
    expect(arc.ccw).toBe(true);
  });

  test('the same drag below the chord keeps the radius and flips the sweep', () => {
    const arc = arcFromDrag([0, 0], [0.2, 0], [0.1, -0.05]);
    expect(arc.radius_m).toBeCloseTo(0.125, 12);
    expect(arc.ccw).toBe(false);
  });

  test('without a midpoint the end of the drag decides the side (on the chord: clockwise)', () => {
    expect(arcFromDrag([0, 0], [0.2, 0], null).ccw).toBe(false);
  });

  test('a zero-length drag gives a zero radius', () => {
    expect(arcFromDrag([0, 0], [0, 0], null).radius_m).toBe(0);
  });
});

describe('useTrackEditor (F4-01b)', () => {
  test('starts empty, with nothing to undo or redo and an open track', () => {
    const { result } = renderHook(() => useTrackEditor());
    expect(result.current.state.track.segments).toEqual([]);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.continuity.closed).toBe(false);
    expect(result.current.continuity.gaps).toEqual([]);
    expect(result.current.dirty).toBe(false);
  });

  test('a line drag adds a straight segment and selects it', () => {
    const { result } = renderHook(() => useTrackEditor());
    act(() => {
      result.current.setTool('line');
    });
    act(() => {
      result.current.pointerDown([0, 0]);
    });
    act(() => {
      result.current.pointerMove([0.3, 0]);
    });
    act(() => {
      result.current.pointerUp([0.3, 0]);
    });
    expect(result.current.state.track.segments).toEqual([
      { type: 'line', from: [0, 0], to: [0.3, 0] },
    ]);
    expect(result.current.state.selected).toBe(0);
    expect(result.current.dirty).toBe(true);
  });

  test('an arc drag applies the golden radius of the ticket', () => {
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
    const segment = result.current.state.track.segments[0];
    if (segment?.type !== 'arc') throw new Error('expected an arc');
    expect(segment.radius_m).toBeCloseTo(0.125, 12);
    expect(segment.ccw).toBe(true);
  });

  test('the second stroke snaps to the end of the first one and closes the report', () => {
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
    // 5 mm off both ends of the first stroke, inside the 20 mm snapping radius of F4-01a.
    act(() => {
      result.current.pointerDown([0.305, 0]);
    });
    act(() => {
      result.current.pointerUp([0.005, 0]);
    });
    const [, second] = result.current.state.track.segments;
    expect(second).toEqual({ type: 'line', from: [0.3, 0], to: [0, 0] });
    expect(result.current.continuity.gaps).toEqual([]);
    expect(result.current.continuity.closed).toBe(true);
  });

  test('the erase tool removes the segment under the pointer', () => {
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
      result.current.setTool('erase');
    });
    act(() => {
      result.current.pointerDown([0.15, 0.001]);
    });
    act(() => {
      result.current.pointerUp([0.15, 0.001]);
    });
    expect(result.current.state.track.segments).toEqual([]);
  });

  test('the erase tool away from the track leaves it untouched', () => {
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
      result.current.setTool('erase');
    });
    act(() => {
      result.current.pointerDown([1, 1]);
    });
    act(() => {
      result.current.pointerUp([1, 1]);
    });
    expect(result.current.state.track.segments).toHaveLength(1);
  });

  test('the select tool selects the segment under the pointer and clears it elsewhere', () => {
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
      result.current.setTool('select');
    });
    act(() => {
      result.current.pointerDown([1, 1]);
    });
    act(() => {
      result.current.pointerUp([1, 1]);
    });
    expect(result.current.state.selected).toBe(null);
    act(() => {
      result.current.pointerDown([0.15, 0]);
    });
    act(() => {
      result.current.pointerUp([0.15, 0]);
    });
    expect(result.current.state.selected).toBe(0);
  });

  test('undo removes the last segment and redo brings it back', () => {
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
    expect(result.current.canUndo).toBe(true);
    act(() => {
      result.current.undo();
    });
    expect(result.current.state.track.segments).toEqual([]);
    expect(result.current.canRedo).toBe(true);
    act(() => {
      result.current.redo();
    });
    expect(result.current.state.track.segments).toHaveLength(1);
  });

  test('undo and redo do nothing at the ends of the history', () => {
    const { result } = renderHook(() => useTrackEditor());
    act(() => {
      result.current.undo();
    });
    act(() => {
      result.current.redo();
    });
    expect(result.current.state.track.segments).toEqual([]);
  });
});
