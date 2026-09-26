import { describe, expect, it } from 'vitest';
import { t } from '@trayectoria/i18n';

import type { Curve } from './compute';
import {
  curveAngle,
  curveArrowLength,
  curveArrowMax,
  curveDescription,
  curveSceneHeight,
  curveViewRadius,
  curveWorldWidth,
  robotPosition,
  robotRadius,
  slips,
} from './curveScene';

/** The defaults of the curve panel (docs/WIDGETS.md, RotationWidget: R = 0.5 m, v = 0.6 m/s). */
const CURVE: Curve = { radius_m: 0.5, v_mps: 0.6, mu_s: 0.6 };

describe('vista del panel de curva (#387)', () => {
  it('dimensiona la escena con R_vista = max(R, 0.5 m): alto 2.5·R_vista, 16/9', () => {
    expect(curveViewRadius(0.25)).toBe(0.5);
    expect(curveViewRadius(0.5)).toBe(0.5);
    expect(curveViewRadius(2)).toBe(2);
    expect(curveSceneHeight(0.25)).toBeCloseTo(1.25, 9);
    expect(curveSceneHeight(2)).toBeCloseTo(5, 9);
    expect(curveWorldWidth(0.5)).toBeCloseTo((1.25 * 16) / 9, 9);
    // With R ≤ 0.5 m the scene is fixed: halving R leaves it as it was.
    expect(curveWorldWidth(0.25)).toBe(curveWorldWidth(0.5));
  });

  it('dibuja el robot con radio 4 % del alto de la escena', () => {
    expect(robotRadius(0.5)).toBeCloseTo(0.05, 9);
    expect(robotRadius(2)).toBeCloseTo(0.2, 9);
  });

  it('coloca el robot por forma cerrada θ(t) = −π/2 + (v/R)·t, antihorario, desde abajo', () => {
    expect(curveAngle(CURVE, 0)).toBeCloseTo(-Math.PI / 2, 12);
    const [x0_m, y0_m] = robotPosition(CURVE, 0);
    expect(x0_m).toBeCloseTo(0, 12);
    expect(y0_m).toBeCloseTo(-0.5, 12);
    // A quarter turn takes (π/2)·R/v; counter-clockwise, the robot is then on the right.
    const quarter_s = ((Math.PI / 2) * CURVE.radius_m) / CURVE.v_mps;
    const [x1_m, y1_m] = robotPosition(CURVE, quarter_s);
    expect(x1_m).toBeCloseTo(0.5, 9);
    expect(y1_m).toBeCloseTo(0, 9);
  });

  it('es determinista: el mismo t y los mismos sliders dan el mismo punto', () => {
    expect(robotPosition(CURVE, 1.234)).toEqual(robotPosition({ ...CURVE }, 1.234));
  });

  it('flecha a_c con k = L_max / 3 m/s², L_max = 0.9·R_vista: 24 % con los valores iniciales', () => {
    expect(curveArrowMax(0.5)).toBeCloseTo(0.45, 9);
    expect(curveArrowLength(CURVE) / curveArrowMax(0.5)).toBeCloseTo(0.24, 9);
  });

  it('con R = 0.25 m y la misma v la flecha mide el doble (48 % de L_max)', () => {
    const half: Curve = { ...CURVE, radius_m: 0.25 };
    expect(curveArrowLength(half) / curveArrowMax(0.25)).toBeCloseTo(0.48, 9);
    expect(curveArrowLength(half)).toBeCloseTo(2 * curveArrowLength(CURVE), 9);
  });

  it('satura la flecha en min(L_max, R): nunca pasa del centro ni sale de la escena', () => {
    // a_c = 1.5²/0.1 = 22.5 m/s², far above a_ref: capped by R = 0.1 m before L_max = 0.45 m.
    expect(curveArrowLength({ radius_m: 0.1, v_mps: 1.5, mu_s: 0.6 })).toBeCloseTo(0.1, 9);
    // a_c = 1.5²/0.6 = 3.75 m/s² > a_ref: capped by L_max = 0.54 m, below R = 0.6 m.
    expect(curveArrowLength({ radius_m: 0.6, v_mps: 1.5, mu_s: 0.6 })).toBeCloseTo(0.54, 9);
  });

  it('avisa «patinaría» solo si v > √(μs·g·R), estricto', () => {
    expect(slips(CURVE)).toBe(false);
    expect(slips({ ...CURVE, v_mps: 1.5 })).toBe(false);
    // R = 0.25 m: v_max = √(0.6·9.81·0.25) ≈ 1.213 m/s.
    expect(slips({ ...CURVE, radius_m: 0.25, v_mps: 1.21 })).toBe(false);
    expect(slips({ ...CURVE, radius_m: 0.25, v_mps: 1.22 })).toBe(true);
  });

  it('describe la vista con R, v, a_c y, si procede, el aviso', () => {
    const calm = curveDescription(CURVE, t);
    expect(calm).toContain('0.500 m');
    expect(calm).toContain('0.600 m/s');
    expect(calm).toContain('0.720 m/s²');
    expect(calm).not.toContain(t('widgets.RotationWidget.slipWarning'));
    const fast = curveDescription({ ...CURVE, radius_m: 0.25, v_mps: 1.3 }, t);
    expect(fast).toContain(t('widgets.RotationWidget.slipWarning'));
  });
});
