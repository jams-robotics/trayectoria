import { describe, expect, it } from 'vitest';
import { t } from '@trayectoria/i18n';

import type { Pose } from './compute';
import { odometryRows } from './rows';
import type { OdometryReadout } from './rows';

/** The value of one line of a set of rows, by its term. */
function valueOf(rows: readonly (readonly [string, string])[], term: string): string {
  return rows.find(([label]) => label === term)?.[1] ?? '';
}

const REAL: Pose = { x_m: 0, y_m: 0, theta_rad: 0 };

/** An odometry readout with the golden step of T-4.5 e2: 45 ticks in 0.1 s, N_e = 360, r = 0.032. */
const READOUT: OdometryReadout = {
  estimated: { x_m: 0.2339, y_m: 0.01745, theta_rad: 0.1489 },
  ticks: { left: 45, right: 45 },
  step: { deltaSL_m: 0.02513, deltaSR_m: 0.02513, deltaS_m: 0.02513, deltaTheta_rad: 0 },
  velocity: { left_mps: 0.25133, right_mps: 0.25133, robot_mps: 0.25133 },
};

describe('DiffDriveWidget odometryRows: velocidad estimada por encoders (#306, T-4.5)', () => {
  it('añade la velocidad estimada por rueda y del robot: 45 ticks en 0.1 s dan 0.2513 m/s (e2)', () => {
    const rows = odometryRows(READOUT, REAL, t);
    expect(valueOf(rows, 'Velocidad estimada de la rueda izquierda')).toBe('0.251 m/s');
    expect(valueOf(rows, 'Velocidad estimada de la rueda derecha')).toBe('0.251 m/s');
    expect(valueOf(rows, 'Velocidad lineal estimada')).toBe('0.251 m/s');
  });

  it('las filas de velocidad estimada van junto al avance y el giro del paso, antes de la pose', () => {
    const terms = odometryRows(READOUT, REAL, t).map(([term]) => term);
    const deltaS = terms.indexOf('Avance del paso Δs');
    const deltaTheta = terms.indexOf('Giro del paso Δθ');
    const vl = terms.indexOf('Velocidad estimada de la rueda izquierda');
    const vr = terms.indexOf('Velocidad estimada de la rueda derecha');
    const v = terms.indexOf('Velocidad lineal estimada');
    const x = terms.indexOf('Posición x estimada');
    expect([deltaS, deltaTheta, vl, vr, v, x]).toEqual(
      [deltaS, deltaTheta, vl, vr, v, x].slice().sort((a, b) => a - b),
    );
    expect(new Set([deltaS, deltaTheta, vl, vr, v, x]).size).toBe(6);
  });

  it('no cambia las filas existentes de la pose estimada, el error o los ticks', () => {
    const rows = odometryRows(READOUT, REAL, t);
    expect(valueOf(rows, 'Posición x estimada')).toBe('0.234 m');
    expect(valueOf(rows, 'Ticks acumulados (izquierda, derecha)')).toBe('(45, 45 ticks)');
  });
});
