import { beforeEach, describe, expect, test, vi } from 'vitest';

// `currentOwnerId` delegates the session wait to `ensureSessionReady` (#184): what is checked
// here is that contract, not the store read, which `packages/auth` already covers.
const ensureSessionReady = vi.fn();
const listImportedArms = vi.fn();

vi.mock('@trayectoria/auth', () => ({ ensureSessionReady }));
vi.mock('@trayectoria/db', () => ({ getDbClient: () => ({}) as never }));
vi.mock('../../lib/robots/download', () => ({
  listImportedArms,
  downloadRobotZip: vi.fn(),
}));
vi.mock('../../lib/robots/storage', () => ({ saveUploadedRobot: vi.fn() }));

const { currentOwnerId, loadImportedArms } = await import('./importedArms');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('currentOwnerId (#184)', () => {
  test('espera a la sesión y devuelve el id del estudiante', async () => {
    ensureSessionReady.mockResolvedValue({ user: { id: 'user-1' } });

    await expect(currentOwnerId()).resolves.toBe('user-1');
    expect(ensureSessionReady).toHaveBeenCalledTimes(1);
  });

  test('sin sesión devuelve null', async () => {
    ensureSessionReady.mockResolvedValue(null);

    await expect(currentOwnerId()).resolves.toBeNull();
  });
});

describe('loadImportedArms (#184)', () => {
  test('sin sesión devuelve la lista vacía y no consulta la base', async () => {
    ensureSessionReady.mockResolvedValue(null);

    await expect(loadImportedArms()).resolves.toEqual([]);
    expect(listImportedArms).not.toHaveBeenCalled();
  });

  test('con sesión consulta los brazos de ese dueño', async () => {
    ensureSessionReady.mockResolvedValue({ user: { id: 'user-2' } });
    const arms = [{ id: 'a-1', name: 'Brazo', urdfPath: 'user-2/a-1.zip' }];
    listImportedArms.mockResolvedValue(arms);

    await expect(loadImportedArms()).resolves.toBe(arms);
    expect(listImportedArms).toHaveBeenCalledWith(expect.anything(), 'user-2');
  });
});
