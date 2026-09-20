import { beforeEach, describe, expect, test, vi } from 'vitest';

const getDbClient = vi.fn();

vi.mock('@trayectoria/db', () => ({ getDbClient }));

const { MOBILE_KIND, listSavedRobots } = await import('./savedRobots');
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
