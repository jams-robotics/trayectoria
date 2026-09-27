import { beforeEach, describe, expect, test, vi } from 'vitest';

const getDbClient = vi.fn();

vi.mock('@trayectoria/db', () => ({ getDbClient }));

const { listRobotSimConfigs, saveRobotSimConfig, deleteRobotSimConfig } = await import(
  './simConfigPersistence'
);
const { referenceRobot, robotSpecToJson } = await import('@trayectoria/widgets');
const { parseSimConfig } = await import('@trayectoria/sims');

// F4-05 (#131, decision 5): the adapter writes `robots.spec.simConfigs` of the selected robot's
// row with the learner's client. What is checked here is the query: which
// columns it asks for, which `eq` it filters with and which `spec` the `update` sends.

interface Row {
  id: string;
  spec: unknown;
  spec_version: number;
}

/**
 * Any configuration with the ticket's shape: oval, PID and seed 1. The gains are
 * literals and not `REFERENCE_PID_PARAMS`: `apps/web` does not depend on sim-core
 * (docs/ARCHITECTURE.md §2), and what this adapter saves is the object as is, whatever it is.
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
 * Supabase client just for these two queries: `select ... eq ... eq ... maybeSingle` and
 * `update ... eq ... eq`. It records the filters and the `update` object so they can be inspected.
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

/** A `robots` row whose `spec` is the reference robot with the given `simConfigs`. */
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
    // The `update` carries `spec` and nothing else: `spec_version` stays as it was.
    expect(Object.keys(values)).toEqual(['spec']);
    const spec = values['spec'] as Record<string, unknown>;
    expect(spec['simConfigs']).toEqual([CONFIG]);
    // The rest of the robot travels intact: the name, the type and the mobile section are still there.
    const original = robotSpecToJson(referenceRobot()) as Record<string, unknown>;
    expect(spec['name']).toEqual(original['name']);
    expect(spec['kind']).toEqual(original['kind']);
    expect(spec['mobile']).toEqual(original['mobile']);
    // The write goes through RLS with the session owner, never with `service_role`.
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

describe('size bound of robots.spec (#210)', () => {
  /** 500 saved configurations: well over 64 KiB of `spec`, the way the list really grows. */
  const MANY = Array.from({ length: 500 }, (_, i) => ({ ...CONFIG, id: `cfg-${String(i)}` }));
  const SIZE_MESSAGE =
    'new row for relation "robots" violates check constraint "robots_spec_size_check"';

  test('a spec over 64 KiB is refused with a RangeError and never reaches the update', async () => {
    const mock = mockClient(row(MANY));
    const saving = saveRobotSimConfig('robot-1', 'user-1', { ...CONFIG, id: 'new' }, mock.client);
    await expect(saving).rejects.toBeInstanceOf(RangeError);
    expect(mock.updates).toEqual([]);
  });

  test('the 23514 of the size check is the same RangeError', async () => {
    const mock = mockClient(row(), null, { message: SIZE_MESSAGE, code: '23514' });
    const saving = saveRobotSimConfig('robot-1', 'user-1', CONFIG, mock.client);
    await expect(saving).rejects.toBeInstanceOf(RangeError);
  });

  test('any other check violation stays a plain Error', async () => {
    const message = 'new row for relation "robots" violates check constraint "robots_kind_check"';
    const mock = mockClient(row(), null, { message, code: '23514' });
    const saving = saveRobotSimConfig('robot-1', 'user-1', CONFIG, mock.client);
    await expect(saving).rejects.not.toBeInstanceOf(RangeError);
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
