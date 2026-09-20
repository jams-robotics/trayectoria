import { beforeEach, describe, expect, test, vi } from 'vitest';

const getDbClient = vi.fn();

vi.mock('@trayectoria/db', () => ({ getDbClient }));

const { listRobotSimConfigs, saveRobotSimConfig, deleteRobotSimConfig } = await import(
  './simConfigPersistence'
);
const { referenceRobot, robotSpecToJson } = await import('@trayectoria/widgets');
const { parseSimConfig } = await import('@trayectoria/sims');

// F4-05 (#131, decisión 5): el adaptador escribe `robots.spec.simConfigs` de la fila del robot
// seleccionado con el cliente del estudiante. Lo que se comprueba aquí es la consulta: qué
// columnas pide, con qué `eq` filtra y qué `spec` manda el `update`.

interface Row {
  id: string;
  spec: unknown;
  spec_version: number;
}

/**
 * Una configuración cualquiera con la forma del ticket: óvalo, PID y semilla 1. Las ganancias son
 * literales y no `REFERENCE_PID_PARAMS`: `apps/web` no depende de sim-core
 * (docs/ARCHITECTURE.md §2), y lo que este adaptador guarda es el objeto tal cual, sea el que sea.
 */
const CONFIG = {
  id: 'cfg-1',
  name: 'Óvalo rápido',
  track: { preset: 'oval' as const },
  controller: 'pid' as const,
  params: { omegaBase_radps: 10, kp: 12, ki: 0.5, kd: 0.2, iMax: 2 },
  seed: 1,
};

/**
 * Cliente de Supabase justo para estas dos consultas: `select ... eq ... eq ... maybeSingle` y
 * `update ... eq ... eq`. Registra los filtros y el objeto del `update` para poder mirarlos.
 */
function mockClient(row: Row | null, error: unknown = null, updateError: unknown = null) {
  const selectEq: Array<readonly [string, unknown]> = [];
  const updateEq: Array<readonly [string, unknown]> = [];
  const columns: string[] = [];
  const updates: Array<Record<string, unknown>> = [];
  const from = vi.fn(() => ({
    select: (select: string) => {
      columns.push(select);
      const chain = {
        eq: (column: string, value: unknown) => {
          selectEq.push([column, value]);
          return chain;
        },
        maybeSingle: () => Promise.resolve({ data: row, error }),
      };
      return chain;
    },
    update: (values: Record<string, unknown>) => {
      updates.push(values);
      const chain = {
        eq: (column: string, value: unknown) => {
          updateEq.push([column, value]);
          return Object.assign(Promise.resolve({ error: updateError }), chain);
        },
      };
      return chain;
    },
  }));
  return { client: { from } as never, from, selectEq, updateEq, columns, updates };
}

/** Una fila de `robots` cuyo `spec` es el robot de referencia con las `simConfigs` dadas. */
function row(simConfigs: readonly unknown[] = []): Row {
  const spec = robotSpecToJson(referenceRobot()) as Record<string, unknown>;
  return { id: 'robot-1', spec: { ...spec, simConfigs }, spec_version: 1 };
}

beforeEach(() => {
  getDbClient.mockReset();
});

describe('listRobotSimConfigs (F4-05)', () => {
  test('lee las configuraciones de la fila del dueño', async () => {
    const mock = mockClient(row([CONFIG]));

    const configs = await listRobotSimConfigs('robot-1', 'user-1', mock.client);

    expect(mock.from).toHaveBeenCalledWith('robots');
    expect(mock.columns).toEqual(['id, spec, spec_version']);
    expect(mock.selectEq).toEqual([
      ['id', 'robot-1'],
      ['owner_id', 'user-1'],
    ]);
    expect(configs).toEqual([CONFIG]);
  });

  test('descarta las entradas que no cumplen el esquema', async () => {
    const mock = mockClient(row([CONFIG, { id: 'roto' }]));
    await expect(listRobotSimConfigs('robot-1', 'user-1', mock.client)).resolves.toEqual([CONFIG]);
  });

  test('una fila sin robot o un error devuelven la lista vacía', async () => {
    await expect(
      listRobotSimConfigs('robot-1', 'user-1', mockClient(null).client),
    ).resolves.toEqual([]);
    await expect(
      listRobotSimConfigs('robot-1', 'user-1', mockClient(row(), { message: 'nope' }).client),
    ).resolves.toEqual([]);
  });
});

describe('saveRobotSimConfig (F4-05)', () => {
  test('manda el `spec` completo con `simConfigs` y filtra por id y dueño', async () => {
    const mock = mockClient(row());

    const saved = await saveRobotSimConfig('robot-1', 'user-1', CONFIG, mock.client);

    expect(saved).toEqual([CONFIG]);
    expect(mock.updates).toHaveLength(1);
    const values = mock.updates[0] ?? {};
    // El `update` lleva `spec` y nada más: `spec_version` se queda como estaba.
    expect(Object.keys(values)).toEqual(['spec']);
    const spec = values['spec'] as Record<string, unknown>;
    expect(spec['simConfigs']).toEqual([CONFIG]);
    // El resto del robot viaja intacto: el nombre, el tipo y la sección móvil siguen ahí.
    const original = robotSpecToJson(referenceRobot()) as Record<string, unknown>;
    expect(spec['name']).toEqual(original['name']);
    expect(spec['kind']).toEqual(original['kind']);
    expect(spec['mobile']).toEqual(original['mobile']);
    // La escritura pasa por RLS con el dueño de la sesión, nunca con `service_role`.
    expect(mock.updateEq).toEqual([
      ['id', 'robot-1'],
      ['owner_id', 'user-1'],
    ]);
  });

  test('guardar con un id ya guardado lo sustituye en su sitio', async () => {
    const other = { ...CONFIG, id: 'cfg-2', name: 'Otra' };
    const mock = mockClient(row([CONFIG, other]));

    const saved = await saveRobotSimConfig(
      'robot-1',
      'user-1',
      { ...CONFIG, name: 'Óvalo lento' },
      mock.client,
    );

    expect(saved.map((config) => config.name)).toEqual(['Óvalo lento', 'Otra']);
  });

  test('sin fila del robot no escribe nada', async () => {
    const mock = mockClient(null);
    await expect(saveRobotSimConfig('robot-1', 'user-1', CONFIG, mock.client)).resolves.toEqual([]);
    expect(mock.updates).toEqual([]);
  });

  test('un error al escribir lanza, para que la página avise', async () => {
    const mock = mockClient(row(), null, { message: 'denegado' });
    await expect(saveRobotSimConfig('robot-1', 'user-1', CONFIG, mock.client)).rejects.toThrow(
      'denegado',
    );
  });

  test('lo escrito sigue siendo una `SimConfig` válida', async () => {
    const mock = mockClient(row());
    await saveRobotSimConfig('robot-1', 'user-1', CONFIG, mock.client);
    const spec = (mock.updates[0]?.['spec'] ?? {}) as Record<string, unknown>;
    const configs = spec['simConfigs'] as unknown[];
    expect(parseSimConfig(configs[0])).not.toBeNull();
  });
});

describe('deleteRobotSimConfig (F4-05)', () => {
  test('quita la configuración y escribe el resto', async () => {
    const other = { ...CONFIG, id: 'cfg-2', name: 'Otra' };
    const mock = mockClient(row([CONFIG, other]));

    const saved = await deleteRobotSimConfig('robot-1', 'user-1', 'cfg-1', mock.client);

    expect(saved).toEqual([other]);
    const spec = (mock.updates[0]?.['spec'] ?? {}) as Record<string, unknown>;
    expect(spec['simConfigs']).toEqual([other]);
    expect(mock.updateEq).toEqual([
      ['id', 'robot-1'],
      ['owner_id', 'user-1'],
    ]);
  });
});

describe('cliente por defecto (F4-05)', () => {
  test('sin cliente explícito usa el de `@trayectoria/db`', async () => {
    const mock = mockClient(row());
    getDbClient.mockReturnValue(mock.client);

    await listRobotSimConfigs('robot-1', 'user-1');

    expect(getDbClient).toHaveBeenCalledTimes(1);
  });
});
