import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test, vi } from 'vitest';

import { NO_LABELS, fetchFicha, labelOf, parseFicha } from './ficha';
import { catalogFichaUrl, loadUrdf } from './loadUrdf';

// #535 and #556: what the viewer reads from `catalog/arms/<id>/ficha.json`.

/** Root of the repository catalog, to read the real cards and URDFs without network. */
const CATALOG = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../catalog/arms');

function catalogFile(catalogId: string, file: string): string {
  return readFileSync(resolve(CATALOG, catalogId, file), 'utf8');
}

/** `fetch` of the catalog: the URDF and the card of `catalogId`, and 404 for anything else. */
function catalogFetch(catalogId: string): typeof fetch {
  return (input) => {
    // The viewer always requests a string URL.
    const url = input as string;
    const file = url.slice(url.lastIndexOf('/') + 1);
    if (file !== 'ficha.json' && file !== `${catalogId}.urdf`) {
      return Promise.resolve({ ok: false, status: 404 } as Response);
    }
    const body = catalogFile(catalogId, file);
    return Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(body),
      json: () => Promise.resolve(JSON.parse(body) as unknown),
    } as Response);
  };
}

const OPTIONS = { domParser: new DOMParser(), robotId: '00000000-0000-4000-8000-000000000001' };

describe('parseFicha', () => {
  test('takes the reach and the label maps of the card', () => {
    const ficha = parseFicha({
      reach_m: 0.35,
      joint_labels: { joint1: 'Articulación 1' },
      link_labels: { base_link: 'Base' },
    });
    expect(ficha?.reach_m).toBe(0.35);
    expect(ficha?.labels.joints.get('joint1')).toBe('Articulación 1');
    expect(ficha?.labels.links.get('base_link')).toBe('Base');
  });

  test('a card without labels has empty maps', () => {
    const ficha = parseFicha({ reach_m: 0.48 });
    expect(ficha?.labels.joints.size).toBe(0);
    expect(ficha?.labels.links.size).toBe(0);
  });

  test('ignores label entries that are not non-empty strings', () => {
    const ficha = parseFicha({ reach_m: 0.35, joint_labels: { a: 3, b: '', c: 'Codo' } });
    expect([...(ficha?.labels.joints ?? [])]).toEqual([['c', 'Codo']]);
  });

  test.each([null, 'ficha', {}, { reach_m: 0 }, { reach_m: -1 }, { reach_m: '0.35' }])(
    'rejects a card without a positive reach: %j',
    (value) => {
      expect(parseFicha(value)).toBeNull();
    },
  );
});

describe('labelOf', () => {
  test('the readable label, or the URDF id when the card gives none', () => {
    const labels = new Map([['shoulder_pan', 'Hombro (giro)']]);
    expect(labelOf(labels, 'shoulder_pan')).toBe('Hombro (giro)');
    expect(labelOf(labels, 'wrist_roll')).toBe('wrist_roll');
    expect(labelOf(NO_LABELS.joints, 'constructor')).toBe('constructor');
  });
});

describe('fetchFicha', () => {
  test('a missing card or one that is not JSON is not an error: null', async () => {
    const missing = vi.fn(() => Promise.resolve({ ok: false, status: 404 } as Response));
    expect(await fetchFicha('/x/ficha.json', missing)).toBeNull();
    const broken = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('x')),
      } as Response),
    );
    expect(await fetchFicha('/x/ficha.json', broken)).toBeNull();
    const offline = vi.fn(() => Promise.reject(new Error('offline')));
    expect(await fetchFicha('/x/ficha.json', offline)).toBeNull();
  });
});

describe('the catalog cards', () => {
  test('the card URL sits next to the URDF', () => {
    expect(catalogFichaUrl('so101')).toBe('/catalog/arms/so101/ficha.json');
  });

  test.each(['planar2dof', 'so101'])(
    '%s: every actuated joint and every link of the chain has a readable label',
    async (catalogId) => {
      const { spec, ficha } = await loadUrdf(catalogId, {
        ...OPTIONS,
        fetchFn: catalogFetch(catalogId),
      });
      const arm = spec.arm;
      expect(arm).toBeDefined();
      expect(ficha).not.toBeNull();
      const actuated = arm?.joints.filter((joint) => joint.type !== 'fixed') ?? [];
      for (const joint of actuated) expect(ficha?.labels.joints.has(joint.name)).toBe(true);
      for (const link of arm?.links ?? []) expect(ficha?.labels.links.has(link.name)).toBe(true);
    },
  );

  test('golden (#556): the reach of the cards is 0.35 m and 0.48 m', async () => {
    const planar = await loadUrdf('planar2dof', {
      ...OPTIONS,
      fetchFn: catalogFetch('planar2dof'),
    });
    const so101 = await loadUrdf('so101', { ...OPTIONS, fetchFn: catalogFetch('so101') });
    expect(planar.ficha?.reach_m).toBe(0.35);
    expect(so101.ficha?.reach_m).toBe(0.48);
  });

  test('without a card the arm still loads, with no card', async () => {
    const xml = catalogFile('planar2dof', 'planar2dof.urdf');
    const onlyUrdf: typeof fetch = (input) =>
      Promise.resolve(
        (input as string).endsWith('.urdf')
          ? ({ ok: true, status: 200, text: () => Promise.resolve(xml) } as Response)
          : ({ ok: false, status: 404 } as Response),
      );
    const loaded = await loadUrdf('planar2dof', { ...OPTIONS, fetchFn: onlyUrdf });
    expect(loaded.spec.kind).toBe('arm-serial');
    expect(loaded.ficha).toBeNull();
  });
});
