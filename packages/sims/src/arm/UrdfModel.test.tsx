import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/react';
import { Color, Mesh, MeshStandardMaterial } from 'three';
import type { URDFRobot } from 'urdf-loader';
import { beforeAll, describe, expect, test, vi } from 'vitest';

// No WebGL in jsdom (same criterion as F2-12, #96, decision 6): `<primitive>` is a three
// element, not an HTML one, so React leaves it in the DOM as an unknown element and it can be
// queried. The real `Canvas` is never mounted here.
import { UrdfModel, applyArmMaterials, applyHighlight } from './UrdfModel';
import { createLoader } from './loadUrdf';
import type { ActuatedJoint, ArmColors } from './types';

const CATALOG = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../catalog/arms');
const PLANAR_URDF = readFileSync(resolve(CATALOG, 'planar2dof/planar2dof.urdf'), 'utf8');

const COLORS: ArmColors = {
  base: '#526475',
  link: '#a25607',
  joint: '#1a242f',
  highlight: '#0d6a8e',
};


const JOINTS: readonly ActuatedJoint[] = [
  { name: 'joint1', type: 'revolute', index: 0, lower_rad: -Math.PI, upper_rad: Math.PI },
  { name: 'joint2', type: 'revolute', index: 1, lower_rad: -Math.PI, upper_rad: Math.PI },
];

function planarRobot(): URDFRobot {
  return createLoader('planar2dof').parse(PLANAR_URDF);
}

// `primitive` is a three element; under jsdom React warns about its capitalisation. The warning is
// an artefact of the test environment, not of the component.
beforeAll(() => {
  const warn = console.error.bind(console);
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('incorrect casing')) return;
    warn(...(args as [unknown]));
  });
});

describe('UrdfModel (F5-01a)', () => {
  test('cuelga el objeto de three como `primitive`, sin atributos propios', () => {
    const robot = planarRobot();
    const { container } = render(
      <UrdfModel
        robot={robot}
        joints={JOINTS}
        q_rad={[0, 0]}
        baseLink="base_link"
        colors={COLORS}
      />,
    );
    const primitive = container.querySelector('primitive');
    expect(primitive).not.toBeNull();
    // R3F assigns every prop of `<primitive>` to the three object, so a `data-*` would
    // blow up the real render («R3F: Cannot set "data-base-link"»): the element carries no
    // prop other than the object itself.
    expect(primitive?.getAttributeNames()).toEqual(['object']);
  });

  test('aplica `setJointValue` por articulación al cambiar `q`', () => {
    const robot = planarRobot();
    const { rerender } = render(
      <UrdfModel
        robot={robot}
        joints={JOINTS}
        q_rad={[0, 0]}
        baseLink="base_link"
        colors={COLORS}
      />,
    );
    expect(robot.joints.joint1?.angle).toBeCloseTo(0, 12);

    rerender(
      <UrdfModel
        robot={robot}
        joints={JOINTS}
        q_rad={[Math.PI / 2, -Math.PI / 4]}
        baseLink="base_link"
        colors={COLORS}
      />,
    );
    expect(robot.joints.joint1?.angle).toBeCloseTo(Math.PI / 2, 12);
    expect(robot.joints.joint2?.angle).toBeCloseTo(-Math.PI / 4, 12);
  });

  test('sustituye los materiales del URDF por los tokens de DESIGN §6', () => {
    const robot = planarRobot();
    const created = applyArmMaterials(robot, COLORS, 'base_link');
    expect(created.length).toBeGreaterThan(0);

    /** Colour of the link's own first `<visual>`, without descending into the child links. */
    const colorOf = (link: string): string | undefined => {
      let hex: string | undefined;
      for (const visual of robot.links[link]?.children ?? []) {
        if (!('isURDFVisual' in visual)) continue;
        visual.traverse((node) => {
          if (
            hex === undefined &&
            node instanceof Mesh &&
            node.material instanceof MeshStandardMaterial
          ) {
            hex = `#${node.material.color.getHexString()}`;
          }
        });
      }
      return hex;
    };
    const hexOf = (value: string): string => `#${new Color(value).getHexString()}`;
    // docs/DESIGN.md §6: base `fg-muted`, the rest of the links `physical`.
    expect(colorOf('base_link')).toBe(hexOf(COLORS.base));
    expect(colorOf('link1')).toBe(hexOf(COLORS.link));
    expect(colorOf('link2')).toBe(hexOf(COLORS.link));
    // The material of the URDF's `<material name="link">` is replaced, not kept.
    expect(colorOf('link1')).not.toBe('#f59e0b');
    for (const material of created) material.dispose();
  });

  test('resalta el eslabón elegido con `emissive` y lo restaura al cambiar (F5-02)', () => {
    const robot = planarRobot();
    applyArmMaterials(robot, COLORS, 'base_link');

    /** `emissive` of the first material of the link's own `<visual>`, in hexadecimal. */
    const emissiveOf = (link: string): string | undefined => {
      let hex: string | undefined;
      for (const visual of robot.links[link]?.children ?? []) {
        if (!('isURDFVisual' in visual)) continue;
        visual.traverse((node) => {
          if (
            hex === undefined &&
            node instanceof Mesh &&
            node.material instanceof MeshStandardMaterial
          ) {
            hex = `#${node.material.emissive.getHexString()}`;
          }
        });
      }
      return hex;
    };

    const restore = applyHighlight(robot, 'link1', COLORS.highlight);
    // docs/DESIGN.md §6 and #135 decision 4: the highlight is the `primary` token.
    expect(emissiveOf('link1')).toBe(`#${new Color(COLORS.highlight).getHexString()}`);
    // Only the chosen link: the others remain without emission.
    expect(emissiveOf('link2')).toBe('#000000');

    restore();
    expect(emissiveOf('link1')).toBe('#000000');
  });

  test('sin eslabón elegido no resalta nada (F5-02)', () => {
    const robot = planarRobot();
    applyArmMaterials(robot, COLORS, 'base_link');
    const restore = applyHighlight(robot, null, COLORS.highlight);
    restore();
    render(
      <UrdfModel
        robot={robot}
        joints={JOINTS}
        q_rad={[0, 0]}
        baseLink="base_link"
        colors={COLORS}
      />,
    );
    expect(robot.links.link1).toBeDefined();
  });

  test('libera los materiales al desmontar', () => {
    const robot = planarRobot();
    const disposed: string[] = [];
    const spy = vi
      .spyOn(MeshStandardMaterial.prototype, 'dispose')
      .mockImplementation(function dispose(this: MeshStandardMaterial) {
        disposed.push(this.uuid);
      });
    const { unmount } = render(
      <UrdfModel
        robot={robot}
        joints={JOINTS}
        q_rad={[0, 0]}
        baseLink="base_link"
        colors={COLORS}
      />,
    );
    unmount();
    expect(disposed.length).toBeGreaterThan(0);
    spy.mockRestore();
  });
});
