import { degToRad } from '@trayectoria/sim-core';
import { describe, expect, test } from 'vitest';

import { barShare, barsOf } from './bars';
import type { Electrical, Mechanical, Ramp } from './compute';
import { energiesOf } from './model';
import {
  applyElectricalChange,
  applyMechanicalChange,
  applyRampChange,
  electricalParamsOf,
  electricalRows,
  mechanicalParamsOf,
  mechanicalRows,
  powerStatus,
  rampParamsOf,
  rampRows,
  rampStatus,
} from './panels';
import { sceneCentre, trackPoint, worldWidthOf } from './scene';

/** Units this stub translator renders as the real symbol, so the rows read as the panel does. */
const UNITS: Readonly<Record<string, string>> = {
  unitJ: 'J',
  unitM: 'm',
  unitMps: 'm/s',
  unitDeg: '°',
  unitW: 'W',
  unitRadps: 'rad/s',
  unitMin: 'min',
};

/** Stub translator: the unit symbol for a unit key, the bare key otherwise, plus its values. */
const t = (key: string, values?: Record<string, string | number>): string => {
  const name = key.split('.').at(-1) ?? key;
  const text = UNITS[name] ?? key;
  return values === undefined ? text : `${text}:${Object.values(values).join('|')}`;
};

const RAMP: Ramp = { mass_kg: 0.9, v0_mps: 0.6, slope_rad: 0.26, mu_k: 0 };
const MECHANICAL: Mechanical = { torque_Nm: 0.03, n_rpm: 5000 };
const ELECTRICAL: Electrical = {
  voltage_V: 6,
  current_A: 1.2,
  efficiency: 0.6,
  motors: 2,
  battery_Wh: 11.1,
};

describe('ramp panel (F2-07)', () => {
  test('has the four sliders of decision 5 with their ranges, `φ` in degrees', () => {
    const params = rampParamsOf(RAMP, t);
    expect(params.map((param) => param.key)).toEqual(['mass', 'v0', 'slope', 'mu']);
    expect(params[0]).toMatchObject({ min: 0.2, max: 3, step: 0.01, value: 0.9 });
    expect(params[1]).toMatchObject({ min: 0.1, max: 1.5, step: 0.01, value: 0.6 });
    expect(params[2]).toMatchObject({ min: 0, max: 45, step: 1, value: 15 });
    expect(params[3]).toMatchObject({ min: 0, max: 0.3, step: 0.01, value: 0 });
  });

  test('applies each change and ignores an unknown key; `φ` arrives in degrees', () => {
    expect(applyRampChange(RAMP, 'mass', 2).mass_kg).toBe(2);
    expect(applyRampChange(RAMP, 'v0', 1.2).v0_mps).toBe(1.2);
    expect(applyRampChange(RAMP, 'slope', 30).slope_rad).toBeCloseTo(degToRad(30), 12);
    expect(applyRampChange(RAMP, 'mu', 0.05).mu_k).toBe(0.05);
    expect(applyRampChange(RAMP, 'other', 1)).toBe(RAMP);
  });

  test('the values panel lists the three energies, the dissipated work and the height', () => {
    const rows = rampRows(RAMP, energiesOf(RAMP, { s_m: 0, v_mps: 0.6, dissipated_J: 0 }), 0.6, t);
    expect(rows).toHaveLength(7);
    expect(rows.map(([, value]) => value)).toContain('0.162 J');
  });

  test('the live sentence carries the speed, the height and the three energies', () => {
    const status = rampStatus(energiesOf(RAMP, { s_m: 0, v_mps: 0.6, dissipated_J: 0 }), 0.6, t);
    expect(status).toContain('0.600 m/s');
    expect(status).toContain('0.162 J');
  });
});

describe('power panels (F2-07)', () => {
  test('the mechanical block has the two sliders of decision 6', () => {
    const params = mechanicalParamsOf(MECHANICAL, t);
    expect(params.map((param) => param.key)).toEqual(['torque', 'speed']);
    expect(params[0]).toMatchObject({ min: 0.005, max: 0.1, value: 0.03 });
    expect(params[1]).toMatchObject({ min: 500, max: 8000, value: 5000 });
  });

  test('the electrical block has the four sliders of decision 6', () => {
    const params = electricalParamsOf(ELECTRICAL, t);
    expect(params.map((param) => param.key)).toEqual([
      'voltage',
      'current',
      'efficiency',
      'battery',
    ]);
    expect(params[2]).toMatchObject({ min: 0.1, max: 1, value: 0.6 });
    expect(params[3]).toMatchObject({ min: 3, max: 40, value: 11.1 });
  });

  test('applies each change of both blocks and ignores an unknown key', () => {
    expect(applyMechanicalChange(MECHANICAL, 'torque', 0.05).torque_Nm).toBe(0.05);
    expect(applyMechanicalChange(MECHANICAL, 'speed', 6000).n_rpm).toBe(6000);
    expect(applyMechanicalChange(MECHANICAL, 'other', 1)).toBe(MECHANICAL);
    expect(applyElectricalChange(ELECTRICAL, 'voltage', 12).voltage_V).toBe(12);
    expect(applyElectricalChange(ELECTRICAL, 'current', 2).current_A).toBe(2);
    expect(applyElectricalChange(ELECTRICAL, 'efficiency', 0.8).efficiency).toBe(0.8);
    expect(applyElectricalChange(ELECTRICAL, 'battery', 20).battery_Wh).toBe(20);
    expect(applyElectricalChange(ELECTRICAL, 'other', 1)).toBe(ELECTRICAL);
  });

  test('the two values panels carry the golden values of T-3.2', () => {
    expect(mechanicalRows(MECHANICAL, t).map(([, value]) => value)).toEqual([
      '524 rad/s',
      '15.7 W',
    ]);
    expect(electricalRows(ELECTRICAL, t).map(([, value]) => value)).toEqual([
      '14.4 W',
      '8.64 W',
      '46.3 min',
    ]);
  });

  test('a block that draws nothing reports an unbounded autonomy instead of a number', () => {
    const rows = electricalRows({ ...ELECTRICAL, current_A: 0 }, t);
    expect(rows.at(-1)?.[1]).toBe('widgets.EnergyWidget.noDraw');
    expect(powerStatus(MECHANICAL, { ...ELECTRICAL, current_A: 0 }, t)).toContain('noDraw');
  });

  test('the live sentence carries the three powers and the autonomy', () => {
    const status = powerStatus(MECHANICAL, ELECTRICAL, t);
    expect(status).toContain('15.7 W');
    expect(status).toContain('46.3 min');
  });
});

describe('energy bars (F2-07)', () => {
  test('the four bars keep the order `E_k`, `E_p`, `E_mec`, `W_fricción`', () => {
    const bars = barsOf(energiesOf(RAMP, { s_m: 0, v_mps: 0.6, dissipated_J: 0 }));
    expect(bars.map((bar) => bar.key)).toEqual([
      'kinetic',
      'potential',
      'mechanical',
      'dissipated',
    ]);
    expect(bars[0]?.value_J).toBeCloseTo(0.162, 6);
  });

  test('the share is clamped to [0, 1] against the common scale', () => {
    expect(barShare(0.081, 0.162)).toBeCloseTo(0.5, 12);
    expect(barShare(0.3, 0.162)).toBe(1);
    expect(barShare(-1, 0.162)).toBe(0);
    // A run that starts at rest has no scale to measure against, so every bar stays empty.
    expect(barShare(0.1, 0)).toBe(0);
    expect(barShare(0.1, Number.NaN)).toBe(0);
  });
});

describe('ramp scene geometry (F2-07)', () => {
  test('the view is wider than the track the body may cover', () => {
    expect(worldWidthOf(RAMP)).toBeGreaterThan(0.3);
    expect(sceneCentre(RAMP)[0]).toBeCloseTo(worldWidthOf(RAMP) / 2, 12);
  });

  test('the track is flat up to the foot and then climbs at `φ`', () => {
    expect(trackPoint(RAMP, 0.1)).toEqual([0.1, 0]);
    const [x_m, y_m] = trackPoint(RAMP, 0.4);
    expect(x_m).toBeCloseTo(0.3 + 0.1 * Math.cos(0.26), 12);
    expect(y_m).toBeCloseTo(0.1 * Math.sin(0.26), 12);
  });

  test('with no ramp the track stays flat all the way along', () => {
    expect(trackPoint({ ...RAMP, slope_rad: 0 }, 0.5)).toEqual([0.5, 0]);
  });
});
