import { act, renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MANUAL_DIFF_RADPS, MANUAL_STEP_RADPS, commandOf, useManualKeyboard } from './useManualKeyboard';

// F4-04 (#130, decisions 2 and 6): the keyboard of manual mode. It listens only on the viewer
// element, never on `window` or `document` (forbidden outside `apps/web`).

/** An already mounted viewer element, like the one the widget passes through `ref`. */
function viewerRef(): { ref: { current: HTMLDivElement | null }; element: HTMLDivElement } {
  const element = document.createElement('div');
  document.body.append(element);
  const ref = createRef<HTMLDivElement>() as { current: HTMLDivElement | null };
  ref.current = element;
  return { ref, element };
}

/** Sends a `keydown` on the viewer with the given key. */
function press(element: HTMLElement, key: string): void {
  act(() => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });
}

/** Sends a `keyup` on the viewer with the given key. */
function release(element: HTMLElement, key: string): void {
  act(() => {
    element.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
  });
}

/** Sends an auto-repeat `keydown` (key held down) on the viewer. */
function repeatPress(element: HTMLElement, key: string): void {
  act(() => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, repeat: true, bubbles: true, cancelable: true }));
  });
}

const OMEGA_MAX_RADPS = 20.944;

describe('useManualKeyboard', () => {
  it('sube la velocidad base en pasos de 0.5 rad/s con ↑', () => {
    const { ref, element } = viewerRef();
    const { result } = renderHook(() => useManualKeyboard(ref, { omegaMax_radps: OMEGA_MAX_RADPS }));

    expect(result.current.omegaBase_radps).toBe(0);
    press(element, 'ArrowUp');
    press(element, 'ArrowUp');
    press(element, 'ArrowUp');
    expect(result.current.omegaBase_radps).toBeCloseTo(3 * MANUAL_STEP_RADPS, 10);
    expect(result.current.omegaBase_radps).toBe(1.5);
  });

  it('baja con ↓ y no pasa de 0', () => {
    const { ref, element } = viewerRef();
    const { result } = renderHook(() => useManualKeyboard(ref, { omegaMax_radps: OMEGA_MAX_RADPS }));

    press(element, 'ArrowUp');
    press(element, 'ArrowDown');
    press(element, 'ArrowDown');
    expect(result.current.omegaBase_radps).toBe(0);
  });

  it('no pasa de omegaMax al subir', () => {
    const { ref, element } = viewerRef();
    const { result } = renderHook(() => useManualKeyboard(ref, { omegaMax_radps: 1 }));

    press(element, 'ArrowUp');
    press(element, 'ArrowUp');
    press(element, 'ArrowUp');
    expect(result.current.omegaBase_radps).toBe(1);
  });

  it('aplica la diferencia mientras → está pulsada y la suelta al soltar', () => {
    const { ref, element } = viewerRef();
    const { result } = renderHook(() => useManualKeyboard(ref, { omegaMax_radps: OMEGA_MAX_RADPS }));

    press(element, 'ArrowRight');
    // Sign from decision 2 of #130: → turns right, that is, the left wheel runs faster
    // than the right one, and that is `diff = −2` with `ωL = base − diff`, `ωR = base + diff`.
    expect(result.current.diff_radps).toBe(-MANUAL_DIFF_RADPS);
    release(element, 'ArrowRight');
    expect(result.current.diff_radps).toBe(0);
  });

  it('← aplica la diferencia contraria', () => {
    const { ref, element } = viewerRef();
    const { result } = renderHook(() => useManualKeyboard(ref, { omegaMax_radps: OMEGA_MAX_RADPS }));

    press(element, 'ArrowLeft');
    expect(result.current.diff_radps).toBe(MANUAL_DIFF_RADPS);
    release(element, 'ArrowLeft');
    expect(result.current.diff_radps).toBe(0);
  });

  it('el comando combina base y diferencia', () => {
    const { ref, element } = viewerRef();
    const { result } = renderHook(() => useManualKeyboard(ref, { omegaMax_radps: OMEGA_MAX_RADPS }));

    press(element, 'ArrowUp');
    press(element, 'ArrowUp');
    press(element, 'ArrowRight');
    expect(result.current.command).toEqual({ omegaL_radps: 3, omegaR_radps: -1 });
  });

  it('Espacio alterna reproducción y pausa', () => {
    const { ref, element } = viewerRef();
    const onTogglePlay = vi.fn();
    renderHook(() =>
      useManualKeyboard(ref, { omegaMax_radps: OMEGA_MAX_RADPS, onTogglePlay }),
    );

    press(element, ' ');
    expect(onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it('ignora las teclas que no son suyas', () => {
    const { ref, element } = viewerRef();
    const { result } = renderHook(() => useManualKeyboard(ref, { omegaMax_radps: OMEGA_MAX_RADPS }));

    press(element, 'a');
    release(element, 'a');
    expect(result.current.omegaBase_radps).toBe(0);
    expect(result.current.diff_radps).toBe(0);
  });

  it('no escucha mientras está deshabilitado', () => {
    const { ref, element } = viewerRef();
    const { result } = renderHook(() =>
      useManualKeyboard(ref, { omegaMax_radps: OMEGA_MAX_RADPS, enabled: false }),
    );

    press(element, 'ArrowUp');
    expect(result.current.omegaBase_radps).toBe(0);
  });

  it('no escucha en window ni en document', () => {
    const { ref } = viewerRef();
    const { result } = renderHook(() => useManualKeyboard(ref, { omegaMax_radps: OMEGA_MAX_RADPS }));

    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });
    expect(result.current.omegaBase_radps).toBe(0);
  });

  it('el auto-repeat de ↑ no acumula pasos (#130, auditoría F4-04)', () => {
    const { ref, element } = viewerRef();
    const { result } = renderHook(() => useManualKeyboard(ref, { omegaMax_radps: OMEGA_MAX_RADPS }));

    press(element, 'ArrowUp');
    repeatPress(element, 'ArrowUp');
    repeatPress(element, 'ArrowUp');
    repeatPress(element, 'ArrowUp');
    repeatPress(element, 'ArrowUp');
    repeatPress(element, 'ArrowUp');
    expect(result.current.omegaBase_radps).toBe(MANUAL_STEP_RADPS);
  });

  it('el blur del visor suelta la diferencia si el keyup no llega (#130, auditoría F4-04)', () => {
    const { ref, element } = viewerRef();
    const { result } = renderHook(() => useManualKeyboard(ref, { omegaMax_radps: OMEGA_MAX_RADPS }));

    press(element, 'ArrowRight');
    expect(result.current.diff_radps).toBe(-MANUAL_DIFF_RADPS);
    act(() => {
      element.dispatchEvent(new FocusEvent('blur', { bubbles: false }));
    });
    expect(result.current.diff_radps).toBe(0);
  });

  it('recorta la base cuando el robot admite menos velocidad', () => {
    const { ref, element } = viewerRef();
    const { rerender, result } = renderHook(
      ({ omegaMax_radps }: { omegaMax_radps: number }) => useManualKeyboard(ref, { omegaMax_radps }),
      { initialProps: { omegaMax_radps: OMEGA_MAX_RADPS } },
    );

    press(element, 'ArrowUp');
    press(element, 'ArrowUp');
    expect(result.current.omegaBase_radps).toBe(1);
    rerender({ omegaMax_radps: 0.5 });
    expect(result.current.omegaBase_radps).toBe(0.5);
  });

  it('expone los ajustes de las teclas para el widget', () => {
    const { ref } = viewerRef();
    const { result } = renderHook(() => useManualKeyboard(ref, { omegaMax_radps: OMEGA_MAX_RADPS }));

    act(() => {
      result.current.press('up');
      result.current.press('right');
    });
    expect(result.current.omegaBase_radps).toBe(0.5);
    expect(result.current.diff_radps).toBe(-MANUAL_DIFF_RADPS);
    act(() => {
      result.current.release('right');
    });
    expect(result.current.diff_radps).toBe(0);
  });
});

describe('commandOf', () => {
  it('manda las dos ruedas igual sin diferencia', () => {
    expect(commandOf(10, 0)).toEqual({ omegaL_radps: 10, omegaR_radps: 10 });
  });

  it('reparte la diferencia entre las dos ruedas', () => {
    expect(commandOf(10, -MANUAL_DIFF_RADPS)).toEqual({ omegaL_radps: 12, omegaR_radps: 8 });
  });
});
