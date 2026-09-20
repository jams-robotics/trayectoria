import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, renderHook } from '@testing-library/react';
import { zipSync } from 'fflate';
import { Vector3 } from 'three';
import { parseUrdf } from '@trayectoria/sim-core';
import type { RobotSpec } from '@trayectoria/robot-spec';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { MISSING_MESH_KEY, loadArm, meshLoaderForZip } from './loadUrdf';
import { useArmSim } from './useArmSim';

// F5-04 (#137, decisiones 2 y 7): cargar un brazo desde un zip en memoria, sin red y sin tocar
// `/catalog/`. Los valores dorados son los de F5-01a: la FK de three coincide con la de sim-core
// por debajo de 1e-6.

const CATALOG = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../catalog/arms');
const ROBOT_ID = '00000000-0000-4000-8000-000000000137';

const PLANAR_URDF = readFileSync(resolve(CATALOG, 'planar2dof/planar2dof.urdf'), 'utf8');

/** Un STL binario mínimo y válido: cabecera de 80 bytes y cero triángulos. */
function emptyStl(): Uint8Array {
  const bytes = new Uint8Array(84);
  return bytes;
}

/** Un zip almacenado con los archivos dados; `fflate` ya es dependencia del paquete (ADR-0008). */
function zipOf(files: Readonly<Record<string, Uint8Array>>): Uint8Array {
  return zipSync({ ...files }, { level: 0 });
}

const encoder = new TextEncoder();

/** El zip del brazo plano: solo su URDF, sin mallas (su geometría es primitiva). */
function planarZip(path = 'planar2dof.urdf'): Uint8Array {
  return zipOf({ [path]: encoder.encode(PLANAR_URDF) });
}

function planarSpecFromCatalog(): RobotSpec {
  const parsed = parseUrdf(PLANAR_URDF, { domParser: new DOMParser(), robotId: ROBOT_ID });
  if (!parsed.ok) throw new Error('El URDF del catálogo debería ser válido');
  return parsed.value;
}

/** Las URL de objeto creadas durante un test, para comprobar que se revocan. */
const created: string[] = [];
const revoked: string[] = [];

function stubObjectUrls(): void {
  let next = 0;
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn((): string => {
      next += 1;
      const url = `blob:test/${String(next)}`;
      created.push(url);
      return url;
    }),
    revokeObjectURL: vi.fn((url: string): void => {
      revoked.push(url);
    }),
  });
}

afterEach(() => {
  created.length = 0;
  revoked.length = 0;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('loadArm desde un zip en memoria (F5-04)', () => {
  test('carga el brazo plano: objeto de three y `RobotSpec` del mismo XML del zip', async () => {
    const loaded = await loadArm(
      { kind: 'zip', bytes: planarZip(), urdfPath: 'planar2dof.urdf' },
      { domParser: new DOMParser(), robotId: ROBOT_ID },
    );

    expect(Object.keys(loaded.robot.joints)).toEqual(['joint1', 'joint2', 'joint_tool']);
    expect(loaded.spec.kind).toBe('arm-serial');
    expect(loaded.spec.arm?.baseLink).toBe('base_link');
    expect(loaded.spec.arm?.endEffectorLink).toBe('tool0');
    expect(loaded.spec.id).toBe(ROBOT_ID);
    loaded.revoke();
  });

  test('la FK de three coincide con la de sim-core por debajo de 1e-6 (dorados de F5-01a)', async () => {
    const goldens: readonly (readonly [number, number])[] = [
      [0, 0],
      [Math.PI / 2, 0],
      [Math.PI / 4, -Math.PI / 4],
      [-Math.PI / 3, Math.PI / 6],
    ];

    const loaded = await loadArm(
      { kind: 'zip', bytes: planarZip(), urdfPath: 'planar2dof.urdf' },
      { domParser: new DOMParser(), robotId: ROBOT_ID },
    );

    for (const q_rad of goldens) {
      loaded.robot.setJointValue('joint1', q_rad[0]);
      loaded.robot.setJointValue('joint2', q_rad[1]);
      loaded.robot.updateMatrixWorld(true);
      const fromThree = new Vector3();
      loaded.robot.links.tool0?.getWorldPosition(fromThree);

      const { result, unmount } = renderHook(() => useArmSim(loaded.spec, [...q_rad]));
      const [x_m, y_m, z_m] = result.current.pose.position_m;
      expect(Math.abs(fromThree.x - x_m)).toBeLessThan(1e-6);
      expect(Math.abs(fromThree.y - y_m)).toBeLessThan(1e-6);
      expect(Math.abs(fromThree.z - z_m)).toBeLessThan(1e-6);
      unmount();
    }
    loaded.revoke();
  });

  test('el spec del zip es el mismo que sim-core saca del catálogo', async () => {
    const loaded = await loadArm(
      { kind: 'zip', bytes: planarZip(), urdfPath: 'planar2dof.urdf' },
      { domParser: new DOMParser(), robotId: ROBOT_ID },
    );
    expect(loaded.spec).toEqual(planarSpecFromCatalog());
    loaded.revoke();
  });

  test('un URDF en una subcarpeta resuelve sus mallas relativas a esa carpeta', async () => {
    stubObjectUrls();
    const bytes = zipOf({
      'robot/arm.urdf': encoder.encode(
        '<robot name="mini"><link name="base_link"><visual><geometry>' +
          '<mesh filename="meshes/pieza.stl"/></geometry></visual></link>' +
          '<link name="tool0"/>' +
          '<joint name="j1" type="revolute"><parent link="base_link"/><child link="tool0"/>' +
          '<origin xyz="0 0 0.1"/><axis xyz="0 0 1"/><limit lower="-1" upper="1" effort="1" velocity="1"/>' +
          '</joint></robot>',
      ),
      'robot/meshes/pieza.stl': emptyStl(),
    });

    const loaded = await loadArm(
      { kind: 'zip', bytes, urdfPath: 'robot/arm.urdf' },
      { domParser: new DOMParser(), robotId: ROBOT_ID },
    );

    // Una malla del zip se sirve como URL de objeto, nunca como una petición de red.
    expect(created).toHaveLength(1);
    loaded.revoke();
    expect(revoked).toEqual(created);
  });

  test('una malla que no viaja en el zip termina con `urdf.missingMesh`', () => {
    stubObjectUrls();
    const loadMesh = meshLoaderForZip(zipOf({ 'a.urdf': encoder.encode('<robot name="x"/>') }), 'a.urdf');
    const onComplete = vi.fn();
    loadMesh('meshes/no-esta.stl', {} as never, {} as never, onComplete);

    const [, error] = onComplete.mock.calls[0] as [unknown, Error];
    expect(error.message).toBe(MISSING_MESH_KEY);
    expect(MISSING_MESH_KEY).toBe('urdf.missingMesh');
    expect(created).toHaveLength(0);
  });

  test('una malla fuera del zip nunca se pide por red', () => {
    stubObjectUrls();
    const loadMesh = meshLoaderForZip(planarZip(), 'planar2dof.urdf');
    const onComplete = vi.fn();
    loadMesh('https://ejemplo.invalid/pieza.stl', {} as never, {} as never, onComplete);
    loadMesh('package://otro/pieza.stl', {} as never, {} as never, onComplete);
    loadMesh('../../secreto.stl', {} as never, {} as never, onComplete);

    for (const call of onComplete.mock.calls) {
      const [, error] = call as [unknown, Error];
      expect(error.message).toBe(MISSING_MESH_KEY);
    }
    expect(created).toHaveLength(0);
  });

  test('una malla con extensión no soportada no se carga', () => {
    stubObjectUrls();
    const loadMesh = meshLoaderForZip(
      zipOf({ 'a.urdf': encoder.encode('<robot name="x"/>'), 'pieza.dae': emptyStl() }),
      'a.urdf',
    );
    const onComplete = vi.fn();
    loadMesh('pieza.dae', {} as never, {} as never, onComplete);

    const [, error] = onComplete.mock.calls[0] as [unknown, Error];
    expect(error.message).toBe('sims.arm.unsupportedMesh');
  });

  test('un zip cuyo URDF sim-core no valida se rechaza', async () => {
    const bytes = zipOf({
      'roto.urdf': encoder.encode('<robot name="roto"><link name="a"/><link name="b"/></robot>'),
    });
    await expect(
      loadArm(
        { kind: 'zip', bytes, urdfPath: 'roto.urdf' },
        { domParser: new DOMParser(), robotId: ROBOT_ID },
      ),
    ).rejects.toThrow('no es válido');
  });

  test('una entrada que no está en el zip se rechaza', async () => {
    await expect(
      loadArm(
        { kind: 'zip', bytes: planarZip(), urdfPath: 'no-existe.urdf' },
        { domParser: new DOMParser(), robotId: ROBOT_ID },
      ),
    ).rejects.toThrow();
  });

  test('`loadArm` con una fuente de catálogo sigue descargando del catálogo', async () => {
    const fetchFn = vi.fn(
      () =>
        Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(PLANAR_URDF),
        }) as unknown as Promise<Response>,
    );
    const loaded = await loadArm(
      { kind: 'catalog', catalogId: 'planar2dof' },
      { domParser: new DOMParser(), robotId: ROBOT_ID, fetchFn },
    );
    expect(fetchFn).toHaveBeenCalledWith('/catalog/arms/planar2dof/planar2dof.urdf');
    expect(loaded.spec.arm?.endEffectorLink).toBe('tool0');
    // Un brazo del catálogo no crea ninguna URL de objeto, así que revocar no hace nada.
    expect(() => loaded.revoke()).not.toThrow();
  });
});

describe('act sobre el hook no altera los dorados', () => {
  test('mover una articulación del brazo del zip sigue coincidiendo con three', async () => {
    const loaded = await loadArm(
      { kind: 'zip', bytes: planarZip(), urdfPath: 'planar2dof.urdf' },
      { domParser: new DOMParser(), robotId: ROBOT_ID },
    );
    const { result } = renderHook(() => useArmSim(loaded.spec));
    act(() => {
      result.current.setJoint(0, Math.PI / 2);
    });

    loaded.robot.setJointValue('joint1', Math.PI / 2);
    loaded.robot.setJointValue('joint2', 0);
    loaded.robot.updateMatrixWorld(true);
    const fromThree = new Vector3();
    loaded.robot.links.tool0?.getWorldPosition(fromThree);

    const [x_m, y_m, z_m] = result.current.pose.position_m;
    expect(Math.abs(fromThree.x - x_m)).toBeLessThan(1e-6);
    expect(Math.abs(fromThree.y - y_m)).toBeLessThan(1e-6);
    expect(Math.abs(fromThree.z - z_m)).toBeLessThan(1e-6);
    loaded.revoke();
  });
});
