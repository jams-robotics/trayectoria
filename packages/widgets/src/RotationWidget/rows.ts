/**
 * The lines of each values panel of `RotationWidget` and the sentence of its `aria-live` region
 * (#89, decisions 5, 6, 7 and 9). Every number comes from `compute.ts` and is formatted once
 * here, so the React parts in `panels.tsx` only lay them out.
 */
import { format } from '@trayectoria/sim-core';
import type { Translate } from '@trayectoria/i18n';

import type { ReadoutRow } from '../shared/ReadoutPanel';
import {
  angleAt,
  centripetalAccel,
  frequency,
  maxCurveSpeed,
  omegaAt,
  period,
  radpsToRpm,
  rimSpeed,
  rollingAdvance,
  rpmToRadps,
  tangentialAccel,
  timeToOmega,
  turnsAt,
} from './compute';
import type { Curve, Rotation, RotationMode } from './compute';

/** Angular speed the readouts count the time to, in rpm (#89, decision 7: T-4.3). */
export const TARGET_RPM = 200;

/** The lines shared by the three modes: `ω` in both units, then what each mode adds. */
function commonRows(rotation: Rotation, omega_radps: number, t: Translate): ReadoutRow[] {
  return [
    [t('widgets.RotationWidget.omegaRadps'), format(omega_radps, t('widgets.RotationWidget.unitRadps'))],
    [t('widgets.RotationWidget.omegaRpm'), format(radpsToRpm(omega_radps), t('widgets.RotationWidget.unitRpm'))],
    [
      t('widgets.RotationWidget.rimSpeed'),
      format(rimSpeed(omega_radps, rotation.r_m), t('widgets.RotationWidget.unitMps')),
    ],
  ];
}

/** The lines of `disc`: period, frequency and the angle swept, in radians and in turns (T-4.1). */
function discRows(rotation: Rotation, t_s: number, t: Translate): ReadoutRow[] {
  const omega_radps = rotation.omega_radps;
  const period_s = period(omega_radps);
  return [
    ...commonRows(rotation, omega_radps, t),
    [
      t('widgets.RotationWidget.period'),
      Number.isFinite(period_s)
        ? format(period_s, t('widgets.RotationWidget.unitS'))
        : t('widgets.RotationWidget.atRest'),
    ],
    [t('widgets.RotationWidget.frequency'), format(frequency(omega_radps), t('widgets.RotationWidget.unitHz'))],
    [t('widgets.RotationWidget.angle'), format(angleAt('disc', rotation, t_s), t('widgets.RotationWidget.unitRad'))],
    [t('widgets.RotationWidget.turns'), format(turnsAt('disc', rotation, t_s), '')],
  ];
}

/** The lines of `rolling`: the advance of the centre, the turns and the perimeter (T-4.2). */
function rollingRows(rotation: Rotation, t_s: number, t: Translate): ReadoutRow[] {
  const unitM = t('widgets.RotationWidget.unitM');
  return [
    [t('widgets.RotationWidget.advance'), format(rollingAdvance(rotation, t_s), unitM)],
    [t('widgets.RotationWidget.turns'), format(turnsAt('rolling', rotation, t_s), '')],
    ...commonRows(rotation, rotation.omega_radps, t),
  ];
}

/** The lines of `angularAccel`: `ω(t)`, `a_t` and the time left to 200 rpm (T-4.3). */
function accelRows(rotation: Rotation, t_s: number, t: Translate): ReadoutRow[] {
  const omega_radps = omegaAt('angularAccel', rotation, t_s);
  const toTarget_s = timeToOmega(rotation, rpmToRadps(TARGET_RPM));
  return [
    ...commonRows(rotation, omega_radps, t),
    [
      t('widgets.RotationWidget.tangentialAccel'),
      format(tangentialAccel(rotation.alpha_radps2, rotation.r_m), t('widgets.RotationWidget.unitMps2')),
    ],
    [
      t('widgets.RotationWidget.timeToTarget'),
      Number.isFinite(toTarget_s)
        ? format(toTarget_s, t('widgets.RotationWidget.unitS'))
        : t('widgets.RotationWidget.never'),
    ],
  ];
}

/** The lines of the values panel of the mode (#89, decisions 5, 6 and 7). */
export function panelRows(
  mode: RotationMode,
  rotation: Rotation,
  t_s: number,
  t: Translate,
): readonly ReadoutRow[] {
  if (mode === 'rolling') return rollingRows(rotation, t_s, t);
  if (mode === 'angularAccel') return accelRows(rotation, t_s, t);
  return discRows(rotation, t_s, t);
}

/** The two lines of the curve panel: `a_c = v²/R` and `v_max = √(μs g R)` (#89, decision 7). */
export function curveRows(curve: Curve, t: Translate): readonly ReadoutRow[] {
  return [
    [
      t('widgets.RotationWidget.centripetalAccel'),
      format(centripetalAccel(curve.v_mps, curve.radius_m), t('widgets.RotationWidget.unitMps2')),
    ],
    [
      t('widgets.RotationWidget.maxCurveSpeed'),
      format(maxCurveSpeed(curve.mu_s, curve.radius_m), t('widgets.RotationWidget.unitMps')),
    ],
  ];
}

/** One sentence with `t`, `ω` and the turns swept, for the `aria-live` region (#89, decision 9). */
export function statusOf(
  mode: RotationMode,
  rotation: Rotation,
  t_s: number,
  t: Translate,
): string {
  return t('widgets.RotationWidget.status', {
    time: format(t_s, t('widgets.RotationWidget.unitS')),
    omega: format(omegaAt(mode, rotation, t_s), t('widgets.RotationWidget.unitRadps')),
    turns: format(turnsAt(mode, rotation, t_s), ''),
  });
}

