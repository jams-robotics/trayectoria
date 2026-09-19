import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Object3D } from 'three';
import { describe, expect, test, vi } from 'vitest';

import {
  UNSUPPORTED_MESH_KEY,
  catalogBaseUrl,
  catalogUrdfUrl,
  createLoader,
  loadMesh,
  loadUrdf,
} from './loadUrdf';

/** Raíz del catálogo del repositorio, para leer los URDF de prueba sin red. */
const CATALOG = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../catalog/arms');

function urdfOf(catalogId: string): string {
  return readFileSync(resolve(CATALOG, catalogId, `${catalogId}.urdf`), 'utf8');
}

/** Respuesta mínima de `fetch` con el cuerpo dado. */
function okResponse(body: string): Response {
  return { ok: true, status: 200, text: () => Promise.resolve(body) } as unknown as Response;
}

/** `fetch` de prueba que siempre devuelve la misma respuesta. */
function stubFetch(response: Response): typeof fetch {
  return () => Promise.resolve(response);
}

const ROBOT_ID = '00000000-0000-4000-8000-000000000001';

describe('loadUrdf (F5-01a)', () => {
  test('compone las URL del catálogo a partir del identificador', () => {
    expect(catalogBaseUrl('planar2dof')).toBe('/catalog/arms/planar2dof');
    expect(catalogUrdfUrl('so101')).toBe('/catalog/arms/so101/so101.urdf');
  });

  test('rechaza un identificador que se saldría del catálogo', () => {
    expect(() => catalogBaseUrl('../secret')).toThrow(RangeError);
    expect(() => catalogBaseUrl('so101/../..')).toThrow(RangeError);
    expect(() => catalogUrdfUrl('')).toThrow(RangeError);
    expect(() => catalogBaseUrl('https://example.com/x')).toThrow(RangeError);
  });

  test('el cargador resuelve las mallas solo bajo la carpeta del brazo', () => {
    const loader = createLoader('so101');
    expect(loader.workingPath).toBe('/catalog/arms/so101/');
    const resolvePackage = loader.packages as (pkg: string) => string;
    expect(resolvePackage('lo-que-sea')).toBe('/catalog/arms/so101');
    expect(loader.parseCollision).toBe(false);
    expect(loader.loadMeshCb).toBe(loadMesh);
  });

  test('una malla con extensión no soportada termina con la clave de error', () => {
    const onComplete = vi.fn();
    loadMesh('/catalog/arms/x/meshes/pieza.dae', {} as never, {} as never, onComplete);
    const [mesh, error] = onComplete.mock.calls[0] as [Object3D, Error];
    expect(mesh).toBeInstanceOf(Object3D);
    expect(error.message).toBe(UNSUPPORTED_MESH_KEY);
    expect(UNSUPPORTED_MESH_KEY).toBe('sims.arm.unsupportedMesh');
  });

  test('un fallo de carga de malla se informa en vez de propagarse', () => {
    const onComplete = vi.fn();
    // `FileLoader` rechaza una URL relativa sin documento base, como aquí en jsdom.
    loadMesh('/catalog/arms/so101/meshes/base_so101_v2.stl', {} as never, {} as never, onComplete);
    const [mesh, error] = onComplete.mock.calls[0] as [Object3D, Error];
    expect(mesh).toBeInstanceOf(Object3D);
    expect(error).toBeInstanceOf(Error);
  });

  test('carga el brazo plano: objeto de three y `RobotSpec` del mismo XML', async () => {
    const xml = urdfOf('planar2dof');
    const fetchFn = vi.fn(() => Promise.resolve(okResponse(xml)));
    const { robot, spec } = await loadUrdf('planar2dof', {
      domParser: new DOMParser(),
      robotId: ROBOT_ID,
      fetchFn,
    });
    expect(fetchFn).toHaveBeenCalledWith('/catalog/arms/planar2dof/planar2dof.urdf');
    expect(Object.keys(robot.joints)).toEqual(['joint1', 'joint2', 'joint_tool']);
    expect(robot.links.tool0).toBeDefined();
    expect(spec.kind).toBe('arm-serial');
    expect(spec.arm?.baseLink).toBe('base_link');
    expect(spec.arm?.endEffectorLink).toBe('tool0');
    expect(spec.id).toBe(ROBOT_ID);
  });

  test('carga el SO-101 del catálogo', async () => {
    const xml = urdfOf('so101');
    const { robot, spec } = await loadUrdf('so101', {
      domParser: new DOMParser(),
      robotId: ROBOT_ID,
      fetchFn: stubFetch(okResponse(xml)),
    });
    expect(spec.arm?.joints.length).toBeGreaterThan(0);
    expect(Object.keys(robot.joints).length).toBe(spec.arm?.joints.length);
  });

  test('propaga un fallo de descarga', async () => {
    const failed = { ok: false, status: 404 } as unknown as Response;
    await expect(
      loadUrdf('planar2dof', {
        domParser: new DOMParser(),
        robotId: ROBOT_ID,
        fetchFn: stubFetch(failed),
      }),
    ).rejects.toThrow('404');
  });

  test('rechaza un URDF que sim-core no valida', async () => {
    const broken = okResponse('<robot name="roto"><link name="a"/><link name="b"/></robot>');
    await expect(
      loadUrdf('planar2dof', {
        domParser: new DOMParser(),
        robotId: ROBOT_ID,
        fetchFn: stubFetch(broken),
      }),
    ).rejects.toThrow('no es válido');
  });
});
