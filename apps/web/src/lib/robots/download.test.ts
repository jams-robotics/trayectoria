import { describe, expect, it, vi } from 'vitest';

import { DOWNLOAD_FAILED_KEY, downloadRobotZip, objectKeyOf } from './download';

// F5-04 (#137, decisión 5): la descarga corre con el cliente de sesión y las políticas de la
// migración 0003. Un objeto de otro `uid` lo rechaza RLS, y aquí se comprueba que ese rechazo
// llega a la UI como un error genérico, sin filtrar el mensaje de Supabase.

const OWNER = '11111111-1111-4111-8111-111111111111';
const ROBOT = '22222222-2222-4222-8222-222222222222';

interface StorageCall {
  readonly bucket: string;
  readonly path: string;
}

/** Cliente de Supabase mínimo: apunta la llamada y responde lo que le digan. */
function mockDb(answer: { data: Blob | null; error: { message: string } | null }): {
  db: never;
  calls: StorageCall[];
} {
  const calls: StorageCall[] = [];
  const db = {
    storage: {
      from: (bucket: string) => ({
        download: (path: string) => {
          calls.push({ bucket, path });
          return Promise.resolve(answer);
        },
      }),
    },
  };
  return { db: db as never, calls };
}

/** Un zip de prueba como `Blob`, que es lo que Storage devuelve. */
function blobOf(bytes: Uint8Array): Blob {
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'application/zip' });
}

describe('objectKeyOf (F5-04)', () => {
  it('quita el prefijo del bucket que guarda la columna `urdf_path`', () => {
    expect(objectKeyOf(`urdf/${OWNER}/${ROBOT}.zip`)).toBe(`${OWNER}/${ROBOT}.zip`);
  });

  it('deja intacta una ruta que ya viene sin el bucket', () => {
    expect(objectKeyOf(`${OWNER}/${ROBOT}.zip`)).toBe(`${OWNER}/${ROBOT}.zip`);
  });
});

describe('downloadRobotZip (F5-04)', () => {
  it('descarga del bucket `urdf` la ruta que trae la fila, sin construirla', async () => {
    const bytes = new Uint8Array([80, 75, 3, 4, 1, 2]);
    const { db, calls } = mockDb({ data: blobOf(bytes), error: null });

    const downloaded = await downloadRobotZip(db, `urdf/${OWNER}/${ROBOT}.zip`);

    expect(calls).toEqual([{ bucket: 'urdf', path: `${OWNER}/${ROBOT}.zip` }]);
    expect(downloaded).toBeInstanceOf(Uint8Array);
    expect([...downloaded]).toEqual([...bytes]);
  });

  it('un objeto de otro `uid` lo rechaza RLS y sale el error genérico', async () => {
    const { db, calls } = mockDb({
      data: null,
      error: { message: 'new row violates row-level security policy for bucket "urdf"' },
    });

    await expect(
      downloadRobotZip(db, `urdf/33333333-3333-4333-8333-333333333333/${ROBOT}.zip`),
    ).rejects.toThrow(DOWNLOAD_FAILED_KEY);
    expect(calls).toHaveLength(1);
    expect(DOWNLOAD_FAILED_KEY).toBe('sims.import.downloadFailed');
  });

  it('el mensaje de Supabase nunca llega al error que ve el estudiante', async () => {
    const secret = 'bucket urdf: object 4f1c not found for tenant t-42';
    const { db } = mockDb({ data: null, error: { message: secret } });

    const failure = await downloadRobotZip(db, `urdf/${OWNER}/${ROBOT}.zip`).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe(DOWNLOAD_FAILED_KEY);
    expect((failure as Error).message).not.toContain('tenant');
  });

  it('una respuesta sin datos ni error también es un fallo genérico', async () => {
    const { db } = mockDb({ data: null, error: null });
    await expect(downloadRobotZip(db, `urdf/${OWNER}/${ROBOT}.zip`)).rejects.toThrow(
      DOWNLOAD_FAILED_KEY,
    );
  });

  it('una fila sin `urdf_path` no llega a pedir nada al bucket', async () => {
    const { db, calls } = mockDb({ data: null, error: null });
    await expect(downloadRobotZip(db, null)).rejects.toThrow(DOWNLOAD_FAILED_KEY);
    expect(calls).toEqual([]);
  });

  it('una ruta con `..` no se pide: solo se acepta la de la propia fila', async () => {
    const { db, calls } = mockDb({ data: blobOf(new Uint8Array([1])), error: null });
    await expect(downloadRobotZip(db, `urdf/${OWNER}/../otro/${ROBOT}.zip`)).rejects.toThrow(
      DOWNLOAD_FAILED_KEY,
    );
    expect(calls).toEqual([]);
  });
});

describe('listImportedArms (F5-04)', () => {
  it('devuelve solo los `arm-serial` del estudiante con su spec y su ruta', async () => {
    const { listImportedArms } = await import('./download');
    const filters: Record<string, unknown> = {};
    const rows = [
      { id: ROBOT, name: 'SO-101', urdf_path: `urdf/${OWNER}/${ROBOT}.zip` },
      { id: 'sin-zip', name: 'Sin archivo', urdf_path: null },
    ];
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((column: string, value: unknown) => {
        filters[column] = value;
        return builder;
      }),
      order: vi.fn(() => Promise.resolve({ data: rows, error: null })),
    };
    const db = { from: vi.fn(() => builder) } as never;

    const arms = await listImportedArms(db, OWNER);

    expect(filters).toEqual({ owner_id: OWNER, kind: 'arm-serial' });
    expect(arms).toEqual([{ id: ROBOT, name: 'SO-101', urdfPath: `urdf/${OWNER}/${ROBOT}.zip` }]);
  });

  it('un error de la consulta deja la lista vacía en lugar de romper el selector', async () => {
    const { listImportedArms } = await import('./download');
    const builder = {
      select: () => builder,
      eq: () => builder,
      order: () => Promise.resolve({ data: null, error: { message: 'denied' } }),
    };
    const db = { from: () => builder } as never;

    await expect(listImportedArms(db, OWNER)).resolves.toEqual([]);
  });
});
