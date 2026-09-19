import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, renderHook } from '@testing-library/react';
import { Vector3 } from 'three';
import type { RobotSpec } from '@trayectoria/robot-spec';
import { describe, expect, test } from 'vitest';

import { createLoader } from './loadUrdf';
import {
  CONTINUOUS_LIMIT_RAD,
  actuatedJoints,
  armOf,
  clampToLimits,
  formatPose,
  initialConfiguration,
  useArmSim,
} from './useArmSim';
import { parseUrdf } from '@trayectoria/sim-core';

const CATALOG = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../catalog/arms');
const ROBOT_ID = '00000000-0000-4000-8000-000000000001';

/** El URDF del brazo plano, leído del catálogo del repositorio (sin red). */
const PLANAR_URDF = readFileSync(resolve(CATALOG, 'planar2dof/planar2dof.urdf'), 'utf8');

function planarSpec(): RobotSpec {
  const parsed = parseUrdf(PLANAR_URDF, { domParser: new DOMParser(), robotId: ROBOT_ID });
  if (!parsed.ok) throw new Error('El URDF del catálogo debería ser válido');
  return parsed.value;
}

/**
 * Valores dorados de PLAN.md F1-08, repetidos en el ticket: configuración y posición del efector
 * `tool0` del brazo plano (l1 = 0.20 m, l2 = 0.15 m).
 */
const GOLDEN: ReadonlyArray<{
  readonly q_rad: readonly [number, number];
  readonly position_m: readonly [number, number, number];
}> = [
  { q_rad: [0, 0], position_m: [0.35, 0, 0] },
  { q_rad: [Math.PI / 2, 0], position_m: [0, 0.35, 0] },
  { q_rad: [Math.PI / 2, -Math.PI / 2], position_m: [0.15, 0.2, 0] },
];

describe('useArmSim (F5-01a)', () => {
  test('lista las articulaciones actuadas con los límites del spec', () => {
    const arm = armOf(planarSpec());
    const joints = actuatedJoints(arm);
    expect(joints.map((joint) => joint.name)).toEqual(['joint1', 'joint2']);
    expect(joints.map((joint) => joint.index)).toEqual([0, 1]);
    expect(joints[0]?.lower_rad).toBeCloseTo(-Math.PI, 12);
    expect(joints[0]?.upper_rad).toBeCloseTo(Math.PI, 12);
  });

  test('una articulación `continuous` toma [−180°, 180°]', () => {
    const arm = armOf(planarSpec());
    const continuous = {
      ...arm,
      joints: arm.joints.map((joint) =>
        joint.name === 'joint1' ? { ...joint, type: 'continuous' as const } : joint,
      ),
    };
    const joints = actuatedJoints(continuous);
    expect(joints[0]?.lower_rad).toBe(-CONTINUOUS_LIMIT_RAD);
    expect(joints[0]?.upper_rad).toBe(CONTINUOUS_LIMIT_RAD);
    expect(CONTINUOUS_LIMIT_RAD).toBeCloseTo(Math.PI, 12);
  });

  test('recorta al límite de la articulación', () => {
    const joints = actuatedJoints(armOf(planarSpec()));
    expect(clampToLimits(joints, 0, 10)).toBeCloseTo(Math.PI, 12);
    expect(clampToLimits(joints, 0, -10)).toBeCloseTo(-Math.PI, 12);
    expect(clampToLimits(joints, 1, 0.5)).toBe(0.5);
    expect(clampToLimits(joints, 9, 0.5)).toBe(0.5);
  });

  test('la configuración inicial parte de ceros y recorta la que se le pase', () => {
    const joints = actuatedJoints(armOf(planarSpec()));
    expect(initialConfiguration(joints)).toEqual([0, 0]);
    const clamped = initialConfiguration(joints, [10, -10]);
    expect(clamped[0]).toBeCloseTo(Math.PI, 12);
    expect(clamped[1]).toBeCloseTo(-Math.PI, 12);
  });

  test('rechaza un robot sin sección de brazo', () => {
    expect(() => armOf({ ...planarSpec(), arm: undefined })).toThrow(RangeError);
  });

  test.each(GOLDEN)(
    'la pose del efector coincide con el valor dorado para q = $q_rad',
    ({ q_rad, position_m }) => {
      const { result } = renderHook(() => useArmSim(planarSpec(), q_rad));
      result.current.pose.position_m.forEach((value, axis) => {
        expect(value).toBeCloseTo(position_m[axis] ?? 0, 9);
      });
    },
  );

  test('el panel del efector con q = (90°, 0) muestra los valores dorados del ticket', () => {
    const { result } = renderHook(() => useArmSim(planarSpec(), [Math.PI / 2, 0]));
    expect(result.current.readout).toMatchObject({
      x_m: '0.000',
      y_m: '0.350',
      z_m: '0.000',
      yaw_deg: '90.0',
    });
  });

  test('formatea metros con 3 decimales y grados con 1', () => {
    const readout = formatPose({
      position_m: [0.123456, -0.2, 0],
      rpy_rad: [0, Math.PI / 4, -Math.PI],
      T: [],
    });
    expect(readout).toEqual({
      x_m: '0.123',
      y_m: '-0.200',
      z_m: '0.000',
      roll_deg: '0.0',
      pitch_deg: '45.0',
      yaw_deg: '-180.0',
    });
  });

  test('`setJoint` recorta al límite y deja las demás articulaciones en su sitio', () => {
    const { result } = renderHook(() => useArmSim(planarSpec()));
    act(() => {
      result.current.setJoint(0, 10);
    });
    expect(result.current.q_rad[0]).toBeCloseTo(Math.PI, 12);
    expect(result.current.q_rad[1]).toBe(0);
    act(() => {
      result.current.setJoint(1, -10);
    });
    expect(result.current.q_rad[1]).toBeCloseTo(-Math.PI, 12);
  });

  test('expone la transformada de cada eslabón de `forwardKinematics`', () => {
    const { result } = renderHook(() => useArmSim(planarSpec(), [Math.PI / 2, 0]));
    expect([...result.current.linkTransforms.keys()].sort()).toEqual([
      'base_link',
      'link1',
      'link2',
      'tool0',
    ]);
    const tool0 = result.current.linkTransforms.get('tool0') ?? [];
    // Columna-mayor: la traslación ocupa los índices 12, 13 y 14 (sim-core math/mat4.ts).
    expect(tool0[12]).toBeCloseTo(0, 9);
    expect(tool0[13]).toBeCloseTo(0.35, 9);
  });
});

describe('three coincide con sim-core (F5-01a)', () => {
  test.each(GOLDEN)(
    'la posición mundial de `tool0` en urdf-loader iguala a `endEffectorPose` para q = $q_rad',
    ({ q_rad }) => {
      const robot = createLoader('planar2dof').parse(PLANAR_URDF);
      robot.setJointValue('joint1', q_rad[0]);
      robot.setJointValue('joint2', q_rad[1]);
      robot.updateMatrixWorld(true);

      const fromThree = new Vector3();
      robot.links.tool0?.getWorldPosition(fromThree);

      const { result } = renderHook(() => useArmSim(planarSpec(), q_rad));
      const [x_m, y_m, z_m] = result.current.pose.position_m;
      expect(Math.abs(fromThree.x - x_m)).toBeLessThan(1e-6);
      expect(Math.abs(fromThree.y - y_m)).toBeLessThan(1e-6);
      expect(Math.abs(fromThree.z - z_m)).toBeLessThan(1e-6);
    },
  );
});
