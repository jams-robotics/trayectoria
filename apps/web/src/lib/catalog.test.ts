import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'astro/zod';
import { describe, expect, it } from 'vitest';

import { fichaSchema } from './ficha';
import { armHref, formatKilograms, formatMetres, formatUsd, simulatorHref } from './catalog';

const CATALOG_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../catalog/arms');

const ARM_IDS = readdirSync(CATALOG_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

function readFicha(id: string): unknown {
  return JSON.parse(readFileSync(join(CATALOG_DIR, id, 'ficha.json'), 'utf8'));
}

/** A ficha that satisfies the schema, used as the base of the rejection cases. */
const VALID_FICHA = readFicha('planar2dof');

describe('catalog/arms fichas', () => {
  it('finds both arms of the catalog', () => {
    expect([...ARM_IDS].sort()).toEqual(['planar2dof', 'so101']);
  });

  it.each(ARM_IDS)('%s validates against the ficha schema', (id) => {
    const result = fichaSchema.safeParse(readFicha(id));
    expect(result.success ? null : result.error.issues).toBeNull();
  });

  it.each(ARM_IDS)('%s declares an id equal to its directory', (id) => {
    expect(fichaSchema.parse(readFicha(id)).id).toBe(id);
  });

  it.each(ARM_IDS)('%s points photo at a file that exists', (id) => {
    const { photo } = fichaSchema.parse(readFicha(id));
    expect(photo.startsWith('/')).toBe(false);
    expect(() => readFileSync(join(CATALOG_DIR, id, photo))).not.toThrow();
  });

  it.each(ARM_IDS)('%s ships the license of its source', (id) => {
    expect(readFileSync(join(CATALOG_DIR, id, 'LICENSE'), 'utf8').length).toBeGreaterThan(0);
  });

  it('rejects a ficha without license, which is what breaks the build', () => {
    const withoutLicense: Record<string, unknown> = { ...(VALID_FICHA as object) };
    delete withoutLicense.license;
    const result = fichaSchema.safeParse(withoutLicense);
    expect(result.success).toBe(false);
    if (result.success) throw new Error('the ficha must be rejected');
    expect(result.error.issues.map((issue) => issue.path.join('.'))).toContain('license');
  });

  it.each([
    { field: 'dof', value: 0 },
    { field: 'reach_m', value: -1 },
    { field: 'verifiedAt', value: '19-09-2026' },
    { field: 'id', value: 'SO 101' },
  ])('rejects a ficha with an invalid $field', ({ field, value }) => {
    const result = fichaSchema.safeParse({ ...(VALID_FICHA as object), [field]: value });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown field, so a typo cannot pass silently', () => {
    const result = fichaSchema.safeParse({ ...(VALID_FICHA as object), alcance: 0.35 });
    expect(result.success).toBe(false);
  });
});

describe('catalog/arms/ficha.schema.json', () => {
  it('matches the zod schema it is generated from', () => {
    const committed: unknown = JSON.parse(
      readFileSync(join(CATALOG_DIR, 'ficha.schema.json'), 'utf8'),
    );
    expect(committed).toEqual(z.toJSONSchema(fichaSchema));
  });
});

describe('catalog helpers', () => {
  it('builds the hrefs of the catalog and the simulator', () => {
    expect(armHref('so101')).toBe('/brazos/so101');
    expect(simulatorHref('so101')).toBe('/simuladores/brazo?robot=so101');
  });

  it('formats numbers with the Spanish decimal comma', () => {
    expect(formatMetres(0.35)).toBe('0,35');
    expect(formatUsd(122)).toBe('122');
    expect(formatKilograms(0.25)).toBe('0,25');
  });

  it('has no mass to format when the source documents none', () => {
    expect(formatKilograms(null)).toBeUndefined();
  });
});
