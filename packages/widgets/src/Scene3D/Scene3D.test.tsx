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
  OrbitControls: (props: Record<string, unknown>) => (
    <div data-testid="orbit-controls" data-make-default={String(props.makeDefault === true)} />
  ),
  Html: ({ children }: { children: ReactNode }) => <div data-testid="html">{children}</div>,
}));

import { tokenColor } from '../shared/theme';
import { AXIS_TOKENS, Frame } from './Frame';
import { Scene3D } from './Scene3D';

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
