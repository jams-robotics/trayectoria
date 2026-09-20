import { beforeEach, describe, expect, test, vi } from 'vitest';

const getDbClient = vi.fn();
const ensureSessionReady = vi.fn();

vi.mock('@trayectoria/db', () => ({ getDbClient }));
vi.mock('@trayectoria/auth', () => ({ ensureSessionReady }));

const { MOBILE_KIND, listSavedRobots, loadForCurrentSession } = await import('./savedRobots');
const { referenceRobot, robotSpecToJson } = await import('@trayectoria/widgets');

/** Cliente de Supabase justo para esta consulta: `select ... eq ... eq ... order`. */
function mockClient(data: unknown, error: unknown = null) {
  const eq: Array<readonly [string, unknown]> = [];
  const columns: string[] = [];
  const orders: string[] = [];
  const from = vi.fn(() => ({
    select: (select: string) => {
      columns.push(select);
      const chain = {
        eq: (column: string, value: unknown) => {
          eq.push([column, value]);
          return chain;
        },
        order: (column: string) => {
          orders.push(column);
          return Promise.resolve({ data, error });
        },
      };
      return chain;
    },
  }));
  return { client: { from } as never, from, eq, columns, orders };
}

beforeEach(() => {
  getDbClient.mockReset();
  ensureSessionReady.mockReset();
});

describe('listSavedRobots (F4-02b)', () => {
  test('pide solo los robots móviles del dueño, ordenados por nombre', async () => {
    const spec = referenceRobot();
    const mock = mockClient([{ id: 'r-1', name: 'Ágil', spec: robotSpecToJson(spec) }]);

    const robots = await listSavedRobots('user-1', mock.client);

    expect(mock.from).toHaveBeenCalledWith('robots');
    expect(mock.columns).toEqual(['id, name, spec']);
    expect(mock.eq).toEqual([
      ['owner_id', 'user-1'],
      ['kind', MOBILE_KIND],
    ]);
    expect(mock.orders).toEqual(['name']);
    expect(robots).toHaveLength(1);
    expect(robots[0]?.name).toBe('Ágil');
    expect(robots[0]?.spec.specVersion).toBe(spec.specVersion);
  });

  test('descarta una fila cuyo spec no valida en lugar de romper el selector', async () => {
    const spec = referenceRobot();
    const mock = mockClient([
      { id: 'r-1', name: 'Roto', spec: { nope: true } },
      { id: 'r-2', name: 'Bueno', spec: robotSpecToJson(spec) },
    ]);

    const robots = await listSavedRobots('user-1', mock.client);

    expect(robots.map((robot) => robot.id)).toEqual(['r-2']);
  });

  test('un error de la consulta devuelve la lista vacía', async () => {
    const mock = mockClient(null, { message: 'nope' });
    await expect(listSavedRobots('user-1', mock.client)).resolves.toEqual([]);
  });

  test('sin cliente explícito usa el de `@trayectoria/db`', async () => {
    const mock = mockClient([]);
    getDbClient.mockReturnValue(mock.client);

    await listSavedRobots('user-1');

    expect(getDbClient).toHaveBeenCalledTimes(1);
  });
});

// `loadForCurrentSession` delega la espera de la sesión en `ensureSessionReady` (#184): aquí se
// comprueba ese contrato, no la lectura del store, que ya cubre `packages/auth`.
describe('loadForCurrentSession (#184)', () => {
  test('espera a la sesión y pide los robots de ese dueño', async () => {
    ensureSessionReady.mockResolvedValue({ user: { id: 'user-1' } });
    const spec = referenceRobot();
    const mock = mockClient([{ id: 'r-1', name: 'Ágil', spec: robotSpecToJson(spec) }]);
    getDbClient.mockReturnValue(mock.client);

    const robots = await loadForCurrentSession();

    expect(ensureSessionReady).toHaveBeenCalledTimes(1);
    expect(mock.eq).toEqual([
      ['owner_id', 'user-1'],
      ['kind', MOBILE_KIND],
    ]);
    expect(robots.map((robot) => robot.id)).toEqual(['r-1']);
  });

  test('sin sesión devuelve la lista vacía y no consulta la base', async () => {
    ensureSessionReady.mockResolvedValue(null);

    await expect(loadForCurrentSession()).resolves.toEqual([]);
    expect(getDbClient).not.toHaveBeenCalled();
  });
});
