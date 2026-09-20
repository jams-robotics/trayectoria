import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/react';
import { beforeAll, describe, expect, test, vi } from 'vitest';

// Sin WebGL en jsdom (mismo criterio que `UrdfModel.test.tsx`): `<primitive>` es un elemento de
// three, no de HTML, así que React lo deja en el DOM como elemento desconocido. El `Canvas` real
// nunca se monta aquí, de modo que la geometría se comprueba sobre `buildWorkspacePoints`.
import { Points } from 'three';

import { WorkspacePoints, buildWorkspacePoints } from './WorkspacePoints';

/** Dos puntos: uno en la base y otro a 0.35 m, los extremos de la rampa de color. */
const POINTS = new Float32Array([0, 0, 0, 0.35, 0, 0]);

// `primitive` es un elemento de three; bajo jsdom React avisa por su capitalización.
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
    // El punto de la base toma el extremo cercano de la rampa, `--color-data-1` (#0072b2).
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
 * El objeto de three que cuelga del `primitive`. En jsdom el atributo `object` solo guarda su
 * conversión a texto, así que se lee de las props de React del nodo.
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
    // R3F asigna cada prop de `<primitive>` al objeto de three, así que un `data-*` haría
    // estallar el render real (mismo criterio que `UrdfModel`, F5-01a).
    expect(primitive?.getAttributeNames()).toEqual(['object']);
  });

  test('el toggle apaga la nube sin recalcularla', () => {
    const { container, rerender } = render(<WorkspacePoints points={POINTS} visible />);
    const object = renderedObject(container);
    expect(object.visible).toBe(true);

    rerender(<WorkspacePoints points={POINTS} visible={false} />);

    expect(object.visible).toBe(false);
    // El mismo objeto: cambiar la visibilidad no vuelve a construir la nube.
    expect(renderedObject(container)).toBe(object);
  });
});
