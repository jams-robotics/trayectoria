import type { ArmSpec } from '@trayectoria/robot-spec';
import { armForwardKinematics } from '@trayectoria/sim-core';
import { describe, expect, test } from 'vitest';

import { formatEntry, linkTransforms, matrixRows } from './matrices';

// F5-02 (#135, decisiones 2, 3 y 6): los valores dorados del ticket sobre el brazo plano de
// docs/ROBOT-SPEC.md §4 (l₁ = 0,20 m, l₂ = 0,15 m, dos articulaciones revolutas sobre Z).

/** Brazo plano de 2 GDL del catálogo, escrito aquí para no depender de la carga del URDF. */
const PLANAR_2DOF: ArmSpec = {
  baseLink: 'base_link',
  endEffectorLink: 'tool0',
  links: [{ name: 'base_link' }, { name: 'link1' }, { name: 'link2' }, { name: 'tool0' }],
  joints: [
    {
      name: 'joint1',
      type: 'revolute',
      parent: 'base_link',
      child: 'link1',
      origin: { xyz: [0, 0, 0], rpy: [0, 0, 0] },
      axis: [0, 0, 1],
      limits: { lower: -Math.PI, upper: Math.PI },
    },
    {
      name: 'joint2',
      type: 'revolute',
      parent: 'link1',
      child: 'link2',
      origin: { xyz: [0.2, 0, 0], rpy: [0, 0, 0] },
      axis: [0, 0, 1],
      limits: { lower: -Math.PI, upper: Math.PI },
    },
    {
      name: 'joint_tool',
      type: 'fixed',
      parent: 'link2',
      child: 'tool0',
      origin: { xyz: [0.15, 0, 0], rpy: [0, 0, 0] },
      axis: [0, 0, 1],
    },
  ],
};

/** Brazo con una articulación prismática sobre +Y, para el caso `Trans(axis · q)`. */
const PRISMATIC: ArmSpec = {
  baseLink: 'base_link',
  endEffectorLink: 'slider',
  links: [{ name: 'base_link' }, { name: 'slider' }],
  joints: [
    {
      name: 'rail',
      type: 'prismatic',
      parent: 'base_link',
      child: 'slider',
      origin: { xyz: [0, 0, 0], rpy: [0, 0, 0] },
      axis: [0, 1, 0],
      limits: { lower: 0, upper: 0.5 },
    },
  ],
};

/** La configuración dorada del ticket: q₁ = 90°, q₂ = −90°. */
const GOLDEN_Q_RAD = [Math.PI / 2, -Math.PI / 2] as const;

/** Tolerancia de las comparaciones entrada a entrada del ticket. */
const TOLERANCE = 1e-12;

/** La transformada del eslabón, o un fallo explícito si la cadena no lo trae. */
function transformOf(spec: ArmSpec, q_rad: readonly number[], link: string): readonly number[] {
  const found = linkTransforms(spec, q_rad).find((entry) => entry.link === link);
  expect(found).toBeDefined();
  return found?.T_cumulative ?? [];
}

describe('linkTransforms (F5-02)', () => {
  test('`T_joint` de joint1 con q₁ = π/2 es Rz(π/2)', () => {
    const rows = linkTransforms(PLANAR_2DOF, GOLDEN_Q_RAD);
    const joint1 = rows.find((entry) => entry.joint === 'joint1');
    // Valor dorado del ticket, en columna-mayor como el `Mat4` de sim-core.
    const RZ_90 = [0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    RZ_90.forEach((expected, index) => {
      expect(joint1?.T_joint[index] ?? Number.NaN).toBeCloseTo(expected, 12);
    });
  });

  test('`T_origin` de joint2 traslada (0.20, 0, 0)', () => {
    const joint2 = linkTransforms(PLANAR_2DOF, GOLDEN_Q_RAD).find(
      (entry) => entry.joint === 'joint2',
    );
    expect(joint2?.T_origin[12] ?? Number.NaN).toBeCloseTo(0.2, 12);
    expect(joint2?.T_origin[13] ?? Number.NaN).toBeCloseTo(0, 12);
    expect(joint2?.T_origin[14] ?? Number.NaN).toBeCloseTo(0, 12);
  });

  test('`T_cumulative` de la punta del eslabón 2 con q = (π/2, −π/2) traslada (0.15, 0.20, 0)', () => {
    // Valor dorado del ticket. La traslación (0.15, 0.20, 0) es la de la punta del segundo
    // eslabón, que en el URDF del catálogo es el marco `tool0`: el marco propio de `link2` está
    // en su base, a (0, 0.20, 0) tras girar q₁ = 90°. Se comprueban los dos, porque el que fija
    // el ticket es el número, y `forwardKinematics` da el mismo (test siguiente).
    const tip = transformOf(PLANAR_2DOF, GOLDEN_Q_RAD, 'tool0');
    expect(tip[12] ?? Number.NaN).toBeCloseTo(0.15, 9);
    expect(tip[13] ?? Number.NaN).toBeCloseTo(0.2, 9);
    expect(tip[14] ?? Number.NaN).toBeCloseTo(0, 9);

    const base = transformOf(PLANAR_2DOF, GOLDEN_Q_RAD, 'link2');
    expect(base[12] ?? Number.NaN).toBeCloseTo(0, 9);
    expect(base[13] ?? Number.NaN).toBeCloseTo(0.2, 9);
    expect(base[14] ?? Number.NaN).toBeCloseTo(0, 9);
  });

  test('`T_cumulative` coincide entrada a entrada con forwardKinematics de sim-core', () => {
    const expected = armForwardKinematics(PLANAR_2DOF, GOLDEN_Q_RAD);
    for (const entry of linkTransforms(PLANAR_2DOF, GOLDEN_Q_RAD)) {
      const reference = expected.get(entry.link);
      expect(reference).toBeDefined();
      entry.T_cumulative.forEach((value, index) => {
        expect(Math.abs(value - (reference?.[index] ?? Number.NaN))).toBeLessThanOrEqual(TOLERANCE);
      });
    }
  });

  test('la cadena arranca en el eslabón base con la identidad y sigue el orden padre-hijo', () => {
    const rows = linkTransforms(PLANAR_2DOF, GOLDEN_Q_RAD);
    expect(rows.map((entry) => entry.link)).toEqual(['base_link', 'link1', 'link2', 'tool0']);
    expect(rows[0]?.joint).toBeNull();
    expect(rows[0]?.T_cumulative).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  });

  test('una articulación fija aporta `T_joint` identidad', () => {
    const tool = linkTransforms(PLANAR_2DOF, GOLDEN_Q_RAD).find((entry) => entry.joint === 'joint_tool');
    expect(tool?.T_joint).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  });

  test('una articulación prismática traslada sobre su eje', () => {
    const rail = linkTransforms(PRISMATIC, [0.25]).find((entry) => entry.joint === 'rail');
    expect(rail?.T_joint[13] ?? Number.NaN).toBeCloseTo(0.25, 12);
    expect(rail?.T_joint[12] ?? Number.NaN).toBeCloseTo(0, 12);
  });
});

describe('formatEntry (F5-02)', () => {
  test('usa tres decimales', () => {
    expect(formatEntry(0.35)).toBe('0.350');
    expect(formatEntry(-1)).toBe('-1.000');
  });

  test('normaliza el cero negativo a `0.000`', () => {
    expect(formatEntry(-0)).toBe('0.000');
    expect(formatEntry(-1e-9)).toBe('0.000');
    expect(formatEntry(-0.0004)).toBe('0.000');
  });
});

describe('matrixRows (F5-02)', () => {
  test('parte el `Mat4` columna-mayor en cuatro filas de la matriz', () => {
    const T = [0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 0.2, 0.35, 0, 1];
    expect(matrixRows(T)).toEqual([
      ['0.000', '-1.000', '0.000', '0.200'],
      ['1.000', '0.000', '0.000', '0.350'],
      ['0.000', '0.000', '1.000', '0.000'],
      ['0.000', '0.000', '0.000', '1.000'],
    ]);
  });
});
