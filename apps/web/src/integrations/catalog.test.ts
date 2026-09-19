import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { once } from 'node:events';
import { Writable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, test } from 'vitest';

import {
  CATALOG_URL_PREFIX,
  catalogAssets,
  contentTypeFor,
  isReadableFile,
  resolveCatalogPath,
} from './catalog';

/** Raíz ficticia: el resolutor es puro y no toca el disco. */
const ROOT = resolve(sep, 'repo', 'catalog');

/** El catálogo real del repositorio, para los enganches que sí leen archivos. */
const REAL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../catalog');

describe('integración de catálogo (F5-01a)', () => {
  test('resuelve un archivo del catálogo bajo la raíz', () => {
    expect(resolveCatalogPath('/catalog/arms/planar2dof/planar2dof.urdf', ROOT)).toBe(
      resolve(ROOT, 'arms/planar2dof/planar2dof.urdf'),
    );
    expect(resolveCatalogPath('/catalog/arms/so101/meshes/base_so101_v2.stl', ROOT)).toBe(
      resolve(ROOT, 'arms/so101/meshes/base_so101_v2.stl'),
    );
  });

  test('ignora las URL que no son del catálogo', () => {
    expect(resolveCatalogPath('/ruta/m04-t02', ROOT)).toBeNull();
    expect(resolveCatalogPath('/catalogo/arms/so101/so101.urdf', ROOT)).toBeNull();
    expect(resolveCatalogPath('', ROOT)).toBeNull();
    expect(resolveCatalogPath('/catalog/', ROOT)).toBeNull();
  });

  test('rechaza el ascenso de directorios, también codificado', () => {
    expect(resolveCatalogPath('/catalog/../secret.env', ROOT)).toBeNull();
    expect(resolveCatalogPath('/catalog/arms/../../secret.env', ROOT)).toBeNull();
    expect(resolveCatalogPath('/catalog/%2e%2e/%2e%2e/secret.env', ROOT)).toBeNull();
    expect(resolveCatalogPath('/catalog/arms/..%2f..%2fsecret.env', ROOT)).toBeNull();
  });

  test('rechaza el byte nulo', () => {
    expect(resolveCatalogPath('/catalog/arms/so101.urdf%00.png', ROOT)).toBeNull();
  });

  test('descarta la cadena de consulta y el fragmento antes de resolver', () => {
    expect(resolveCatalogPath('/catalog/arms/so101/so101.urdf?v=1', ROOT)).toBe(
      resolve(ROOT, 'arms/so101/so101.urdf'),
    );
    expect(resolveCatalogPath('/catalog/arms/so101/so101.urdf#top', ROOT)).toBe(
      resolve(ROOT, 'arms/so101/so101.urdf'),
    );
  });

  test('da el tipo MIME de cada extensión del catálogo', () => {
    expect(contentTypeFor('/catalog/arms/planar2dof/planar2dof.urdf')).toBe('application/xml');
    expect(contentTypeFor('/catalog/arms/so101/meshes/base_so101_v2.STL')).toBe('model/stl');
    expect(contentTypeFor('/catalog/arms/so101/ficha.json')).toBe('application/json');
    expect(contentTypeFor('/catalog/arms/so101/foto.jpg')).toBe('image/jpeg');
    expect(contentTypeFor('/catalog/arms/planar2dof/foto.svg')).toBe('image/svg+xml');
    expect(contentTypeFor('/catalog/arms/so101/LICENSE')).toBe('application/octet-stream');
  });

  test('la integración declara los dos enganches y el prefijo público', () => {
    const integration = catalogAssets(ROOT);
    expect(integration.name).toBe('trayectoria:catalog');
    expect(Object.keys(integration.hooks)).toEqual(['astro:server:setup', 'astro:build:done']);
    expect(CATALOG_URL_PREFIX).toBe('/catalog/');
  });

  test('distingue archivo, directorio y ruta inexistente', () => {
    expect(isReadableFile(resolve(REAL_ROOT, 'arms/planar2dof/planar2dof.urdf'))).toBe(true);
    expect(isReadableFile(resolve(REAL_ROOT, 'arms/planar2dof'))).toBe(false);
    expect(isReadableFile(resolve(REAL_ROOT, 'arms/no-existe.urdf'))).toBe(false);
  });

  test('el middleware de dev sirve el URDF con su tipo MIME y cede las URL ajenas', async () => {
    const integration = catalogAssets(REAL_ROOT);
    let middleware: ((req: unknown, res: unknown, next: () => void) => void) | undefined;
    void integration.hooks['astro:server:setup']?.({
      server: {
        middlewares: {
          use: (handler: (req: unknown, res: unknown, next: () => void) => void) => {
            middleware = handler;
          },
        },
      },
    } as never);
    expect(middleware).toBeTypeOf('function');

    let nexted = false;
    middleware?.({ url: '/ruta/m04-t02' }, {}, () => {
      nexted = true;
    });
    expect(nexted).toBe(true);

    const headers: Record<string, string> = {};
    const chunks: Buffer[] = [];
    let ceded = false;
    const response = new Writable({
      write(chunk: Buffer, _encoding, done) {
        chunks.push(chunk);
        done();
      },
    }) as Writable & { setHeader(name: string, value: string): void };
    response.setHeader = (name: string, value: string): void => {
      headers[name] = value;
    };
    middleware?.({ url: '/catalog/arms/planar2dof/planar2dof.urdf' }, response, () => {
      ceded = true;
    });
    expect(ceded).toBe(false);
    expect(headers['Content-Type']).toBe('application/xml');
    await once(response, 'finish');
    expect(Buffer.concat(chunks).toString('utf8')).toContain('<robot name="Brazo plano 2 GDL">');
  });

  test('cede una ruta del catálogo que no existe', () => {
    const integration = catalogAssets(REAL_ROOT);
    let middleware: ((req: unknown, res: unknown, next: () => void) => void) | undefined;
    void integration.hooks['astro:server:setup']?.({
      server: {
        middlewares: {
          use: (handler: (req: unknown, res: unknown, next: () => void) => void) => {
            middleware = handler;
          },
        },
      },
    } as never);
    let ceded = false;
    middleware?.({ url: '/catalog/arms/no-existe/no-existe.urdf' }, {}, () => {
      ceded = true;
    });
    expect(ceded).toBe(true);
  });

  test('copia solo `arms/` del catálogo al directorio del build', async () => {
    const out = await mkdtemp(join(tmpdir(), 'catalog-build-'));
    const integration = catalogAssets(REAL_ROOT);
    await integration.hooks['astro:build:done']?.({ dir: pathToFileURL(out + sep) } as never);
    expect(existsSync(join(out, 'catalog/arms/so101/so101.urdf'))).toBe(true);
    expect(existsSync(join(out, 'catalog/arms/planar2dof/planar2dof.urdf'))).toBe(true);
    expect(existsSync(join(out, 'catalog/arms/so101/meshes/base_so101_v2.stl'))).toBe(true);
    await rm(out, { recursive: true, force: true });
  });
});
