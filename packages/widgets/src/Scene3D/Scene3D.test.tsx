import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { act } from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

// No WebGL renderer runs in jsdom (#96, decision 6): the `Canvas` of fiber is replaced by a div
// that renders its children, and drei's `OrbitControls` and `Html` by markers, so what the tests
// assert is the declared tree — the lights, the grid, the controls and the triad — and not a
// rendered image. `three` elements (`mesh`, `gridHelper`, …) are lower-case tags, so React keeps
// them in the DOM as unknown elements and they can be queried directly.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => (
    <div data-testid="canvas" {...props}>
      {children}
    </div>
  ),
}));

vi.mock('@react-three/drei', () => ({
  // The marker exposes the `change` event of the controls through `data-camera`, so a test can
  // move the camera the way the user's orbit would (#556).
  OrbitControls: (props: Record<string, unknown>) => (
    <div
      data-testid="orbit-controls"
      data-make-default={String(props.makeDefault === true)}
      data-reports={String(typeof props.onChange === 'function')}
      data-target={String(props.target)}
      onClick={(event) => {
        const raw = (event.currentTarget as HTMLElement).dataset.camera ?? '';
        const [x, y, z] = raw.split(',').map(Number);
        const onChange = props.onChange as ((event: unknown) => void) | undefined;
        onChange?.({ target: { object: { position: { x, y, z } } } });
      }}
    />
  ),
  Html: ({ children }: { children: ReactNode }) => <div data-testid="html">{children}</div>,
}));

import { tokenColor } from '../shared/theme';
import { AXIS_TOKENS, Frame } from './Frame';
import { Scene3D } from './Scene3D';
import { framedView } from './framing';

/** Default camera position of the scene, in metres. */
const DEFAULT_CAMERA_M: readonly [number, number, number] = [0.8, -0.9, 0.7];

/** Fires the `change` event of the mocked controls with the camera at `position_m`. */
function orbitTo(position_m: readonly [number, number, number]): void {
  const controls = screen.getByTestId('orbit-controls');
  controls.setAttribute('data-camera', position_m.join(','));
  controls.click();
}

/** Light values of the axis tokens, resolved the same way `Frame` resolves them at runtime. */
const AXIS_COLORS = AXIS_TOKENS.map((token) => tokenColor(null, token));

/** Renders a scene with the given props and the triad of the origin. */
function renderScene(props: Partial<Parameters<typeof Scene3D>[0]> = {}): HTMLElement {
  const { container } = render(
    <Scene3D description="escena" {...props}>
      <Frame label="origen" />
    </Scene3D>,
  );
  return container;
}

// `mesh`, `gridHelper` and friends are three.js elements, not HTML ones: with the real fiber
// reconciler they never reach the DOM, but under the `Canvas` mock React renders them as unknown
// elements and warns about their casing. The warning is an artefact of the mock, so it is
// silenced here rather than renaming the elements of the actual scene.
beforeAll(() => {
  const warn = console.error.bind(console);
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('incorrect casing')) return;
    warn(...(args as [unknown]));
  });
});

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe('Scene3D', () => {
  test('declares the two lights, the grid, the orbit controls and its children', () => {
    const container = renderScene();
    expect(container.querySelectorAll('ambientLight')).toHaveLength(1);
    expect(container.querySelectorAll('directionalLight')).toHaveLength(1);
    expect(container.querySelectorAll('gridHelper')).toHaveLength(1);
    expect(screen.getByTestId('orbit-controls')).toHaveAttribute('data-make-default', 'true');
    expect(screen.getByTestId('frame')).toBeInTheDocument();
  });

  test('labels the canvas with the description given by the widget', () => {
    renderScene();
    expect(screen.getByTestId('canvas')).toHaveAttribute('aria-label', 'escena');
    expect(screen.getByTestId('canvas')).toHaveAttribute('role', 'img');
  });

  test('defaults to `up: z` and rotates the grid onto the XY ground plane', () => {
    const container = renderScene();
    expect(screen.getByTestId('canvas')).toHaveAttribute('data-up', 'z');
    const grid = container.querySelector('gridHelper');
    expect(grid?.getAttribute('rotation')).toBe(String([Math.PI / 2, 0, 0]));
  });

  test('with `up: y` leaves the grid on its own plane', () => {
    const container = renderScene({ up: 'y' });
    expect(screen.getByTestId('canvas')).toHaveAttribute('data-up', 'y');
    expect(container.querySelector('gridHelper')?.getAttribute('rotation')).toBe(String([0, 0, 0]));
  });

  test('`showGrid: false` drops the grid and keeps the lights and the controls', () => {
    const container = renderScene({ showGrid: false });
    expect(container.querySelectorAll('gridHelper')).toHaveLength(0);
    expect(container.querySelectorAll('ambientLight')).toHaveLength(1);
    expect(screen.getByTestId('orbit-controls')).toBeInTheDocument();
  });

  test('bounds the device pixel ratio to [1, 2] (docs/ARCHITECTURE.md §8)', () => {
    renderScene();
    expect(screen.getByTestId('canvas')).toHaveAttribute('dpr', String([1, 2]));
  });

  test('is responsive: full width with a 16/9 aspect', () => {
    renderScene();
    const host = screen.getByTestId('scene3d');
    expect(host).toHaveClass('w-full');
    expect(host.style.aspectRatio).toBe('16 / 9');
  });

  test('paints the background with `bg-raised` and re-reads it when the theme changes', async () => {
    const light = '#ffffff';
    const dark = '#1a222c';
    const spy = vi.spyOn(globalThis, 'getComputedStyle').mockImplementation(
      () =>
        ({
          getPropertyValue: (name: string) =>
            name === '--color-bg-raised'
              ? document.documentElement.getAttribute('data-theme') === 'dark'
                ? dark
                : light
              : '',
        }) as unknown as CSSStyleDeclaration,
    );
    renderScene();
    expect(screen.getByTestId('canvas').style.background).toBe('rgb(255, 255, 255)');

    await act(async () => {
      document.documentElement.setAttribute('data-theme', 'dark');
      await Promise.resolve();
    });
    expect(screen.getByTestId('canvas').style.background).toBe('rgb(26, 34, 44)');
    spy.mockRestore();
  });
});

describe('Scene3D · initial framing (#556)', () => {
  const POINTS_M: readonly (readonly [number, number, number])[] = [
    [0, 0, 0],
    [0.2, 0, 0],
    [0.35, 0, 0],
  ];

  test('without points the camera keeps the default position that frames the grid', () => {
    renderScene();
    const canvas = screen.getByTestId('canvas');
    expect(canvas).toHaveAttribute('data-camera-position', DEFAULT_CAMERA_M.join(','));
    expect(canvas).toHaveAttribute('data-camera-target', '0,0,0');
  });

  test('`framePoints_m` puts the target at the middle of the points and the camera on the framing', () => {
    renderScene({ framePoints_m: POINTS_M });
    const view = framedView(POINTS_M, [0, 0, 1]);
    const canvas = screen.getByTestId('canvas');
    expect(canvas).toHaveAttribute('data-camera-target', view.target_m.join(','));
    expect(canvas).toHaveAttribute(
      'data-camera-position',
      view.target_m.map((value, axis) => value + (view.offset_m[axis] ?? 0)).join(','),
    );
    expect(screen.getByTestId('orbit-controls')).toHaveAttribute(
      'data-target',
      view.target_m.join(','),
    );
  });

  test('an explicit `cameraOffset_m` keeps the zoom the user left, around the new target', () => {
    renderScene({ framePoints_m: POINTS_M, cameraOffset_m: [1, 2, 3] });
    const [x, y, z] = framedView(POINTS_M, [0, 0, 1]).target_m;
    expect(screen.getByTestId('canvas')).toHaveAttribute(
      'data-camera-position',
      [x + 1, y + 2, z + 3].join(','),
    );
  });

  test('reports the offset the user orbits to, but not the initial one the controls echo', () => {
    const onCameraChange = vi.fn();
    renderScene({ framePoints_m: POINTS_M, onCameraChange });
    expect(screen.getByTestId('orbit-controls')).toHaveAttribute('data-reports', 'true');
    const view = framedView(POINTS_M, [0, 0, 1]);
    const at = (offset_m: readonly number[]): [number, number, number] => [
      view.target_m[0] + (offset_m[0] ?? 0),
      view.target_m[1] + (offset_m[1] ?? 0),
      view.target_m[2] + (offset_m[2] ?? 0),
    ];

    // The first `update()` of the controls fires `change` with the camera still in place.
    orbitTo(at(view.offset_m));
    expect(onCameraChange).not.toHaveBeenCalled();

    orbitTo(at([0.5, -0.5, 0.4]));
    expect(onCameraChange).toHaveBeenCalledTimes(1);
    const [reported] = onCameraChange.mock.calls[0] as [number[]];
    [0.5, -0.5, 0.4].forEach((value, axis) => {
      expect(reported[axis]).toBeCloseTo(value, 9);
    });
  });

  test('without `onCameraChange` the controls report nothing', () => {
    renderScene();
    expect(screen.getByTestId('orbit-controls')).toHaveAttribute('data-reports', 'false');
  });
});

describe('Frame', () => {
  test('draws one arm per axis with the tokens of docs/DESIGN.md §6', () => {
    const { container } = render(<Frame />);
    const materials = Array.from(container.querySelectorAll('meshStandardMaterial'));
    expect(materials.map((material) => material.getAttribute('color'))).toEqual([...AXIS_COLORS]);
    expect(AXIS_TOKENS).toEqual(['color-error', 'color-success', 'color-data-1']);
  });

  test('orients each arm along its own axis and sizes it from `length_m`', () => {
    const { container } = render(<Frame length_m={0.4} />);
    const meshes = Array.from(container.querySelectorAll('mesh'));
    expect(meshes.map((mesh) => mesh.getAttribute('position'))).toEqual([
      String([0.2, 0, 0]),
      String([0, 0.2, 0]),
      String([0, 0, 0.2]),
    ]);
    expect(meshes.map((mesh) => mesh.getAttribute('rotation'))).toEqual([
      String([0, 0, -Math.PI / 2]),
      String([0, 0, 0]),
      String([Math.PI / 2, 0, 0]),
    ]);
    const geometry = container.querySelector('cylinderGeometry');
    expect(geometry?.getAttribute('args')).toBe(String([0.008, 0.008, 0.4, 12]));
  });

  test('places the triad at `position_m`, the origin by default', () => {
    const { container: atOrigin } = render(<Frame />);
    expect(atOrigin.querySelector('group')?.getAttribute('position')).toBe(String([0, 0, 0]));
    const { container: moved } = render(<Frame position_m={[0.1, -0.2, 0.3]} />);
    expect(moved.querySelector('group')?.getAttribute('position')).toBe(String([0.1, -0.2, 0.3]));
  });

  test('renders the label only when one is given', () => {
    render(<Frame label="origen" />);
    expect(screen.getByTestId('html')).toHaveTextContent('origen');
    const { container } = render(<Frame />);
    expect(container.querySelector('[data-testid="html"]')).toBeNull();
  });
});
