import { describe, expect, it } from 'vitest';
import { t } from '@trayectoria/i18n';

import { rpmToRadps } from './compute';
import type { Curve, Rotation } from './compute';
import { applyChange, applyCurveChange, curveRows, panelRows, statusOf } from './panels';

/** The wheel of the «Explora» of T-4.1 and T-4.2: 200 rpm and a radius of 32 mm. */
const WHEEL: Rotation = { omega_radps: rpmToRadps(200), r_m: 0.032, alpha_radps2: 0 };
/** The defaults of the curve panel (#89, decision 7). */
const CURVE: Curve = { radius_m: 0.5, v_mps: 0.6, mu_s: 0.6 };

/** The value of one line of a set of rows, by its term. */
function valueOf(rows: readonly (readonly [string, string])[], term: string): string {
  return rows.find(([label]) => label === term)?.[1] ?? '';
}

describe('panels de RotationWidget (F2-06)', () => {
  it('convierte ω a la unidad del panel al aplicar el cambio (decisión 4)', () => {
    expect(applyChange(WHEEL, 'omega', 60, 'rpm').omega_radps).toBeCloseTo(6.2832, 4);
    expect(applyChange(WHEEL, 'omega', 6.2832, 'radps').omega_radps).toBe(6.2832);
  });

  it('editar v fija ω = v/r, el enlace bidireccional (decisión 6)', () => {
    expect(applyChange(WHEEL, 'v', 1, 'radps').omega_radps).toBeCloseTo(31.25, 6);
    expect(applyChange(WHEEL, 'r', 0.064, 'radps').r_m).toBe(0.064);
    expect(applyChange(WHEEL, 'alpha', 41.89, 'radps').alpha_radps2).toBe(41.89);
  });

  it('ignora una clave que no edita ningún parámetro', () => {
    expect(applyChange(WHEEL, 'otro', 1, 'rpm')).toBe(WHEEL);
    expect(applyCurveChange(CURVE, 'otro', 1)).toBe(CURVE);
  });

  it('aplica cada deslizador del panel de curva (decisión 7)', () => {
    expect(applyCurveChange(CURVE, 'radius', 0.3).radius_m).toBe(0.3);
    expect(applyCurveChange(CURVE, 'vCurve', 1).v_mps).toBe(1);
    expect(applyCurveChange(CURVE, 'mu', 0.4).mu_s).toBe(0.4);
  });

  it('en reposo el panel dice que no hay período ni tiempo hasta 200 rpm', () => {
    const resting: Rotation = { ...WHEEL, omega_radps: 0 };
    expect(valueOf(panelRows('disc', resting, 0, t), 'Período')).toBe('en reposo');
    expect(valueOf(panelRows('angularAccel', resting, 0, t), 'Tiempo hasta 200 rpm')).toBe(
      'no llega',
    );
  });

  it('el panel de curva muestra a_c y v_max con los valores dorados de T-4.3', () => {
    const rows = curveRows(CURVE, t);
    expect(valueOf(rows, 'Aceleración centrípeta')).toBe('0.720 m/s²');
    expect(valueOf(rows, 'Velocidad máxima en curva')).toBe('1.72 m/s');
  });

  it('describe el estado con el tiempo, ω y las vueltas', () => {
    expect(statusOf('disc', WHEEL, 1, t)).toBe(
      'En t 1.00 s la velocidad angular es 20.9 rad/s y lleva 3.33 vueltas',
    );
  });
});
