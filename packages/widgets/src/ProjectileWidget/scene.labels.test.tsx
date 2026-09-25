import { act, render } from '@testing-library/react';
import { degToRad } from '@trayectoria/sim-core';
import type { Translate } from '@trayectoria/i18n';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ProjectileScene } from './scene';
import type { Launch } from './compute';

/** Every text the scene asked the 2D context to draw. */
let texts: string[];

/** The translation keys are drawn as they are, so the labels are found by their key. */
const t: Translate = (key) => key;

/** The launch of the «Explora» of T-1.4 and a second one from the ground (#350). */
const A: Launch = { v0_mps: 4, launchAngle_rad: degToRad(40), h_m: 0.3, vRobot_mps: 0 };
const B: Launch = { ...A, h_m: 0 };

/**
 * Stub of `CanvasRenderingContext2D`: jsdom has no canvas backend, so the scene is checked by
 * the texts it draws. Any method other than `fillText` is a no-op.
 */
function stubContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const state: Record<string | symbol, unknown> = { canvas };
  return new Proxy(state, {
    get: (target, prop) => {
      if (prop in target) return target[prop];
      if (prop === 'fillText') return (text: string): void => void texts.push(text);
      if (prop === 'measureText') return (): { width: number } => ({ width: 0 });
      return (): void => undefined;
    },
    set: (target, prop, value) => {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

beforeEach(() => {
  vi.useFakeTimers();
  texts = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    return stubContext(this);
  });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => 800);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    },
  );
  vi.stubGlobal('devicePixelRatio', 1);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number =>
    setTimeout(() => {
      cb(0);
    }, 16) as unknown as number,
  );
  vi.stubGlobal('cancelAnimationFrame', (handle: number): void => {
    clearTimeout(handle);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('etiquetas de los vectores (#350)', () => {
  test('con dos lanzamientos, cada vector se rotula una sola vez: las flechas de B no se solapan con las de A', () => {
    render(
      <ProjectileScene
        mode="launch"
        launches={[
          { launch: A, color: 'color-data-1' },
          { launch: B, color: 'color-data-2' },
        ]}
        t_s={0}
        worldWidth_m={2.1}
        showVectors={['v', 'vx', 'vy']}
        t={t}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(32);
    });

    for (const kind of ['v', 'vx', 'vy']) {
      expect(texts.filter((text) => text === `widgets.ProjectileWidget.vector${kind}`)).toHaveLength(1);
    }
  });

  test('con un solo lanzamiento sus tres vectores siguen rotulados', () => {
    render(
      <ProjectileScene
        mode="launch"
        launches={[{ launch: A, color: 'color-data-1' }]}
        t_s={0.3}
        worldWidth_m={2.1}
        showVectors={['v', 'vx', 'vy']}
        t={t}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(32);
    });

    expect(texts.filter((text) => text.startsWith('widgets.ProjectileWidget.vector'))).toEqual([
      'widgets.ProjectileWidget.vectorv',
      'widgets.ProjectileWidget.vectorvx',
      'widgets.ProjectileWidget.vectorvy',
    ]);
  });
});
