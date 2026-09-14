import { describe, expect, test } from 'vitest';

import { DEFAULT_LANGUAGE, t } from './index';

describe('F0-06 t()', () => {
  test('default language is es', () => {
    expect(DEFAULT_LANGUAGE).toBe('es');
  });

  test('resolves a dot-notation key to its Spanish value', () => {
    expect(t('nav.home')).toBe('Inicio');
    expect(t('home.features.widgets.title')).toBe('Visualizaciones manipulables');
  });

  test('interpolates {{params}} without HTML escaping', () => {
    expect(t('meta.title', { title: 'Vectores' })).toBe('Vectores · Trayectoria');
    expect(t('topic.number', { module: 4, order: 2 })).toBe('Tema 4.2');
    expect(t('meta.title', { title: "Fuerza & 'torque'" })).toBe("Fuerza & 'torque' · Trayectoria");
  });

  test('returns the key itself when it is missing', () => {
    expect(t('missing.key')).toBe('missing.key');
  });
});
