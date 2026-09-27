import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/react';
import { beforeAll, describe, expect, test, vi } from 'vitest';

// No WebGL in jsdom (same criterion as `UrdfModel.test.tsx`): `<primitive>` is a three
// element, not an HTML one, so React leaves it in the DOM as an unknown element. The real `Canvas`
// is never mounted here, so the geometry is checked on `buildWorkspacePoints`.
import { Points } from 'three';

import { WorkspacePoints, buildWorkspacePoints } from './WorkspacePoints';

/** Two points: one at the base and another at 0.35 m, the ends of the colour ramp. */
const POINTS = new Float32Array([0, 0, 0, 0.35, 0, 0]);

// `primitive` is a three element; under jsdom React warns about its capitalisation.
beforeAll(() => {
  const warn = console.error.bind(console);
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('incorrect casing')) return;
    warn(...(args as [unknown]));
  });
});

describe('buildWorkspacePoints (F5-03)', () => {
  test('pone una posición y un color por muestra', () => {
    const object = buildWorkspacePoints(POINTS, null);

    expect(object.geometry.getAttribute('position').count).toBe(2);
    const colors = object.geometry.getAttribute('color');
    expect(colors.count).toBe(2);
    // The base point takes the near end of the ramp, `--color-data-1` (#0072b2).
    expect(colors.getX(0)).toBeCloseTo(0, 5);
    expect(colors.getZ(0)).toBeCloseTo(0xb2 / 255, 5);
    // El punto lejano toma `--color-data-3` (#009e73).
    expect(colors.getY(1)).toBeCloseTo(0x9e / 255, 5);
  });

  test('los puntos miden 2 px y no se atenúan con el zoom', () => {
    const { material } = buildWorkspacePoints(POINTS, null);

    expect(material).toMatchObject({ size: 2, sizeAttenuation: false, vertexColors: true });
  });

  test('una nube vacía da una geometría sin vértices', () => {
    const object = buildWorkspacePoints(new Float32Array(0), null);

    expect(object.geometry.getAttribute('position').count).toBe(0);
  });
});

/**
 * The three object hanging from the `primitive`. In jsdom the `object` attribute only stores its
 * conversion to text, so it is read from the React props of the node.
 */
function renderedObject(container: HTMLElement): Points {
  const node = container.querySelector('primitive');
  const key = Object.keys(node ?? {}).find((name) => name.startsWith('__reactProps$'));
  const props = (node as unknown as Record<string, { object?: unknown }>)[key ?? ''];
  expect(props?.object).toBeInstanceOf(Points);
  return props?.object as Points;
}

describe('WorkspacePoints (F5-03)', () => {
  test('cuelga la nube como `primitive`, sin más prop que el objeto', () => {
    const { container } = render(<WorkspacePoints points={POINTS} visible />);

    const primitive = container.querySelector('primitive');
    expect(primitive).not.toBeNull();
    // R3F assigns every prop of `<primitive>` to the three object, so a `data-*` would
    // blow up the real render (same criterion as `UrdfModel`, F5-01a).
    expect(primitive?.getAttributeNames()).toEqual(['object']);
  });

  test('el toggle apaga la nube sin recalcularla', () => {
    const { container, rerender } = render(<WorkspacePoints points={POINTS} visible />);
    const object = renderedObject(container);
    expect(object.visible).toBe(true);

    rerender(<WorkspacePoints points={POINTS} visible={false} />);

    expect(object.visible).toBe(false);
    // The same object: changing the visibility does not rebuild the cloud.
    expect(renderedObject(container)).toBe(object);
  });
});
