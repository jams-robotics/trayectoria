import { describe, expect, it } from 'vitest';

import type { Translate } from '@trayectoria/i18n';

import { applyChange, paramsOf, readoutValues } from './panels';
import { flightTime } from './compute';
import type { Launch } from './compute';

/** The launch of the «Explora» of T-1.4, before any slider is touched. */
const LAUNCH: Launch = {
  v0_mps: 4,
  launchAngle_rad: (40 * Math.PI) / 180,
  h_m: 0.3,
  vRobot_mps: 0.6,
};

/** Translation stub: returns the key, so the tests read the structure and not the Spanish. */
const t: Translate = (key) => key;

describe('parámetros editables (F2-05)', () => {
  it('cada modo expone los deslizadores de la decisión 6, con sus rangos', () => {
    expect(paramsOf('launch', LAUNCH, t).map(({ key, min, max }) => [key, min, max])).toEqual([
      ['v0', 0.5, 8],
      ['angle', 0, 90],
      ['h', 0, 2],
    ]);
    expect(paramsOf('drop', LAUNCH, t).map(({ key }) => key)).toEqual(['h']);
    expect(paramsOf('dropFromRobot', LAUNCH, t).map(({ key, min, max }) => [key, min, max])).toEqual(
      [
        ['vRobot', 0, 1],
        ['h', 0, 2],
      ],
    );
  });

  it('el ángulo se muestra en grados aunque se guarde en radianes (decisión 6)', () => {
    const angle = paramsOf('launch', LAUNCH, t).find(({ key }) => key === 'angle');
    expect(angle?.value).toBe(40);
    expect(angle?.unit).toBe('widgets.ProjectileWidget.unitDeg');
  });

  it('`applyChange` escribe cada clave en su campo y el ángulo vuelve a radianes', () => {
    expect(applyChange(LAUNCH, 'v0', 5).v0_mps).toBe(5);
    expect(applyChange(LAUNCH, 'angle', 60).launchAngle_rad).toBeCloseTo(Math.PI / 3, 12);
    expect(applyChange(LAUNCH, 'h', 1.2).h_m).toBe(1.2);
    expect(applyChange(LAUNCH, 'vRobot', 0.9).vRobot_mps).toBe(0.9);
  });

  it('`applyChange` ignora una clave desconocida', () => {
    expect(applyChange(LAUNCH, 'mass', 2)).toBe(LAUNCH);
  });
});

describe('valores del panel (F2-05)', () => {
  it('devuelve alcance, altura máxima, tiempo de vuelo y los valores en vivo', () => {
    const values = readoutValues('launch', { ...LAUNCH, vRobot_mps: 0 }, 0.3, t);
    expect(values).toHaveLength(8);
    // Los tres primeros son los resultados dorados de T-1.4.
    expect(values.slice(0, 3)).toEqual([
      '1.91 widgets.ProjectileWidget.unitM',
      '0.637 widgets.ProjectileWidget.unitM',
      '0.622 widgets.ProjectileWidget.unitS',
    ]);
  });
});

describe('formato al aterrizar (#350)', () => {
  it('la altura al final del vuelo es 0.00 m, no ruido de coma flotante', () => {
    const launch = { ...LAUNCH, vRobot_mps: 0 };
    const values = readoutValues('launch', launch, flightTime('launch', launch), t);
    expect(values[5]).toBe('0.00 widgets.ProjectileWidget.unitM');
  });
});
