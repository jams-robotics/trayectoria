import type { ArmSpec } from '@trayectoria/robot-spec';
import { createRng, sampleWorkspace } from '@trayectoria/sim-core';
import { describe, expect, test, vi } from 'vitest';

import { WORKSPACE_SEED, defaultBatchSize, sampleWorkspaceInBatches } from './sampler';

// F5-03 (#136, decisiones 2 y 6): el muestreo por lotes con planificador inyectado. Los puntos
// salen de `sampleWorkspace` de sim-core; aquí solo se trocea el trabajo para no bloquear la
// interfaz, de modo que el resultado por lotes ha de ser idéntico al de una llamada única.

/** Brazo plano de 2 GDL del catálogo (docs/ROBOT-SPEC.md §4); l1 = 0.20 m, l2 = 0.15 m. */
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
      name: 'tool',
      type: 'fixed',
      parent: 'link2',
      child: 'tool0',
      origin: { xyz: [0.15, 0, 0], rpy: [0, 0, 0] },
      axis: [1, 0, 0],
    },
  ],
};

/** Valores dorados del anillo de planar2dof: |l1 − l2| y l1 + l2, en metros. */
const RADIUS_MIN_M = 0.05;
const RADIUS_MAX_M = 0.35;
const TOLERANCE_M = 1e-6;

/** Planificador síncrono: ejecuta el lote en el acto, sin ceder el hilo (decisión 2). */
function immediateSchedule(run: () => void): () => void {
  run();
  return () => {
    /* nada que cancelar: el lote ya corrió */
  };
}

/** Los radios `√(x² + y²)` de una nube aplanada `[x0, y0, z0, x1, …]`. */
function radii_m(points: Float32Array): number[] {
  const values: number[] = [];
  for (let i = 0; i < points.length; i += 3) {
    values.push(Math.hypot(points[i] ?? 0, points[i + 1] ?? 0));
  }
  return values;
}

describe('sampleWorkspaceInBatches (F5-03)', () => {
  test('planar2dof con n = 20 000 y semilla 1 llena el anillo [0.05, 0.35] m con z = 0', async () => {
    const { promise } = sampleWorkspaceInBatches(PLANAR_2DOF, 20_000, WORKSPACE_SEED, {
      schedule: immediateSchedule,
    });
    const points = await promise;

    expect(points).toHaveLength(3 * 20_000);
    const radii = radii_m(points);
    for (const radius_m of radii) {
      expect(radius_m).toBeGreaterThanOrEqual(RADIUS_MIN_M - TOLERANCE_M);
      expect(radius_m).toBeLessThanOrEqual(RADIUS_MAX_M + TOLERANCE_M);
    }
    // El anillo se llena: hay puntos pegados al borde interior y al exterior.
    expect(Math.min(...radii)).toBeLessThan(0.06);
    expect(Math.max(...radii)).toBeGreaterThan(0.34);
    for (let i = 2; i < points.length; i += 3) {
      expect(points[i]).toBeCloseTo(0, 6);
    }
  });

  test('los lotes producen exactamente los mismos puntos que una llamada única', async () => {
    const single = sampleWorkspace(PLANAR_2DOF, 5_000, createRng(WORKSPACE_SEED));
    const { promise } = sampleWorkspaceInBatches(PLANAR_2DOF, 5_000, WORKSPACE_SEED, {
      batchSize: 1_000,
      schedule: immediateSchedule,
    });

    expect([...(await promise)]).toEqual([...single]);
  });

  test('un último lote parcial no altera la secuencia', async () => {
    const single = sampleWorkspace(PLANAR_2DOF, 2_500, createRng(WORKSPACE_SEED));
    const { promise } = sampleWorkspaceInBatches(PLANAR_2DOF, 2_500, WORKSPACE_SEED, {
      batchSize: 1_000,
      schedule: immediateSchedule,
    });

    expect([...(await promise)]).toEqual([...single]);
  });

  test('informa del progreso lote a lote hasta 1', async () => {
    const progress: number[] = [];
    const { promise } = sampleWorkspaceInBatches(PLANAR_2DOF, 3_000, WORKSPACE_SEED, {
      batchSize: 1_000,
      schedule: immediateSchedule,
      onProgress: (value) => progress.push(value),
    });
    await promise;

    expect(progress).toEqual([1 / 3, 2 / 3, 1]);
  });

  test('cancelar a mitad detiene el cálculo y deja el progreso por debajo de 1', async () => {
    const progress: number[] = [];
    let pending: (() => void) | null = null;
    // Planificador manual: los lotes solo avanzan cuando el test los suelta.
    const manual = (run: () => void): (() => void) => {
      pending = run;
      return () => {
        pending = null;
      };
    };
    const run = (): void => {
      const next = pending;
      pending = null;
      next?.();
    };

    const { promise, cancel } = sampleWorkspaceInBatches(PLANAR_2DOF, 4_000, WORKSPACE_SEED, {
      batchSize: 1_000,
      schedule: manual,
      onProgress: (value) => progress.push(value),
    });
    run();
    run();
    cancel();
    run();

    await expect(promise).rejects.toThrow(/cancel/i);
    expect(progress.at(-1)).toBeLessThan(1);
    expect(progress).toEqual([0.25, 0.5]);
  });

  test('cancelar antes del primer lote no deja progreso', async () => {
    const progress: number[] = [];
    const { promise, cancel } = sampleWorkspaceInBatches(PLANAR_2DOF, 4_000, WORKSPACE_SEED, {
      batchSize: 1_000,
      schedule: () => () => {
        /* el lote nunca corre */
      },
      onProgress: (value) => progress.push(value),
    });
    cancel();

    await expect(promise).rejects.toThrow(/cancel/i);
    expect(progress).toEqual([]);
  });

  test('n = 0 resuelve con una nube vacía', async () => {
    const { promise } = sampleWorkspaceInBatches(PLANAR_2DOF, 0, WORKSPACE_SEED, {
      schedule: immediateSchedule,
    });

    expect(await promise).toHaveLength(0);
  });

  test('rechaza un tamaño de lote que no sea un entero positivo', () => {
    expect(() =>
      sampleWorkspaceInBatches(PLANAR_2DOF, 10, WORKSPACE_SEED, {
        batchSize: 0,
        schedule: immediateSchedule,
      }),
    ).toThrow(RangeError);
  });

  test('el planificador por defecto usa requestIdleCallback cuando existe', async () => {
    const idle = vi.fn((callback: () => void) => {
      callback();
      return 7;
    });
    vi.stubGlobal('requestIdleCallback', idle);
    vi.stubGlobal('cancelIdleCallback', vi.fn());
    try {
      const { promise } = sampleWorkspaceInBatches(PLANAR_2DOF, 10, WORKSPACE_SEED, {
        batchSize: 10,
      });
      await promise;
      expect(idle).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('sin requestIdleCallback el planificador por defecto cae en setTimeout', async () => {
    vi.stubGlobal('requestIdleCallback', undefined);
    try {
      const { promise } = sampleWorkspaceInBatches(PLANAR_2DOF, 10, WORKSPACE_SEED, {
        batchSize: 10,
      });
      expect(await promise).toHaveLength(30);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('el tamaño de lote por defecto es de 1 000 puntos', () => {
    expect(defaultBatchSize).toBe(1_000);
  });
});
