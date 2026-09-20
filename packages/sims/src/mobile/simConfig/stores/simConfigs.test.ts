import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SimConfig } from '@trayectoria/robot-spec';

import { SIM_CONFIGS_KEY, deleteSimConfig, listSimConfigs, saveSimConfig } from './simConfigs';

// F4-05 (#131, decisión 4): el único archivo del repositorio que toca `localStorage`. Los tests
// lo sustituyen por uno falso, así que nada depende del almacenamiento real del entorno.

/** Un `localStorage` de mentira: un mapa con la misma interfaz que el store usa. */
function fakeStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => data.delete(key),
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

const CONFIG: SimConfig = {
  id: 'cfg-1',
  name: 'Óvalo rápido',
  track: { preset: 'oval' },
  controller: 'pid',
  params: { kp: 12 },
  seed: 1,
};

function install(initial?: Record<string, string>): Storage {
  const storage = fakeStorage(initial);
  vi.stubGlobal('localStorage', storage);
  return storage;
}

beforeEach(() => {
  install();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('simConfigs (F4-05)', () => {
  it('sin nada guardado la lista está vacía', () => {
    expect(listSimConfigs()).toEqual([]);
  });

  it('guarda y devuelve la configuración', () => {
    saveSimConfig(CONFIG);
    expect(listSimConfigs()).toEqual([CONFIG]);
  });

  it('guardar con el mismo id sustituye la entrada en su sitio', () => {
    saveSimConfig(CONFIG);
    saveSimConfig({ ...CONFIG, id: 'cfg-2', name: 'Otra' });
    saveSimConfig({ ...CONFIG, name: 'Óvalo lento' });
    expect(listSimConfigs().map((config) => config.name)).toEqual(['Óvalo lento', 'Otra']);
  });

  it('borra por id y deja el resto', () => {
    saveSimConfig(CONFIG);
    saveSimConfig({ ...CONFIG, id: 'cfg-2', name: 'Otra' });
    deleteSimConfig('cfg-1');
    expect(listSimConfigs().map((config) => config.id)).toEqual(['cfg-2']);
  });

  it('descarta las entradas que no cumplen el esquema y conserva las válidas', () => {
    install({
      [SIM_CONFIGS_KEY]: JSON.stringify([CONFIG, { id: 'roto' }, { ...CONFIG, seed: 'x' }]),
    });
    expect(listSimConfigs()).toEqual([CONFIG]);
  });

  it('un JSON ilegible o que no es una lista da una lista vacía', () => {
    install({ [SIM_CONFIGS_KEY]: '{' });
    expect(listSimConfigs()).toEqual([]);
    install({ [SIM_CONFIGS_KEY]: '{"a":1}' });
    expect(listSimConfigs()).toEqual([]);
  });

  it('sin `localStorage` la lista está vacía y guardar no lanza', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(listSimConfigs()).toEqual([]);
    expect(() => {
      saveSimConfig(CONFIG);
    }).not.toThrow();
    expect(() => {
      deleteSimConfig('cfg-1');
    }).not.toThrow();
  });

  it('un almacenamiento que lanza al escribir no rompe al que guarda', () => {
    const storage = install();
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('cuota agotada');
    });
    expect(() => {
      saveSimConfig(CONFIG);
    }).not.toThrow();
  });
});
