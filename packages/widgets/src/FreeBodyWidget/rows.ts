/**
 * The lines of the values panel of `FreeBodyWidget` and the sentence of its `aria-live` region
 * (#86, decision 6; #305). Every number comes from `compute.ts` and is formatted once here, so
 * the React parts in `panels.tsx` only lay them out.
 */
import { format } from '@trayectoria/sim-core';
import type { Translate } from '@trayectoria/i18n';

import type { ReadoutRow } from '../shared/ReadoutPanel';
import type { FreeBodyReadout, StaticFriction } from './compute';

/** Decimals of an angle in degrees (#86, decision 6). */
const ANGLE_DECIMALS = 2;

/** The rows of the friction model after the normal: `f_max = μs·N` and `a_max = f_max/m`. */
export function frictionRows(
  friction: StaticFriction | null,
  t: Translate,
): readonly ReadoutRow[] {
  if (friction === null) return [];
  return [
    [
      t('widgets.FreeBodyWidget.frictionMax'),
      format(friction.frictionMax_N, t('widgets.FreeBodyWidget.unitN')),
    ],
    [
      t('widgets.FreeBodyWidget.accelMax'),
      format(friction.accelMax_mps2, t('widgets.FreeBodyWidget.unitMps2')),
    ],
  ];
}

/**
 * The lines of the panel: weight, normal, the friction rows with `mu_s` and, with
 * `showResultant`, `|R|`, its angle and `a`.
 */
export function panelRows(
  readout: FreeBodyReadout,
  mass_kg: number,
  showResultant: boolean,
  t: Translate,
): readonly ReadoutRow[] {
  const unit_N = t('widgets.FreeBodyWidget.unitN');
  const rows: ReadoutRow[] = [
    [t('widgets.FreeBodyWidget.mass'), format(mass_kg, t('widgets.FreeBodyWidget.unitKg'))],
    [t('widgets.FreeBodyWidget.weight'), format(readout.weight_N, unit_N)],
    [t('widgets.FreeBodyWidget.weightAlong'), format(readout.weightAlong_N, unit_N)],
    [t('widgets.FreeBodyWidget.normal'), format(readout.normal_N, unit_N)],
    ...frictionRows(readout.friction, t),
  ];
  if (!showResultant) return rows;
  rows.push(
    [t('widgets.FreeBodyWidget.resultant'), format(readout.resultantMagnitude_N, unit_N)],
    [
      t('widgets.FreeBodyWidget.resultantAngle'),
      t('widgets.FreeBodyWidget.degrees', {
        value: readout.resultantAngle_deg.toFixed(ANGLE_DECIMALS),
      }),
    ],
    [
      t('widgets.FreeBodyWidget.accel'),
      format(readout.accel_mps2, t('widgets.FreeBodyWidget.unitMps2')),
    ],
  );
  return rows;
}

/** The «desliza» notice of the current state, or null while static friction holds (#305). */
export function slipNotice(readout: FreeBodyReadout, t: Translate): string | null {
  const slip = readout.friction?.slip ?? null;
  if (slip === null) return null;
  return slip === 'traction'
    ? t('widgets.FreeBodyWidget.slipTraction')
    : t('widgets.FreeBodyWidget.slipHold');
}

/** One sentence with the resultant, the acceleration and any slip, for the `aria-live` region. */
export function statusOf(readout: FreeBodyReadout, t: Translate): string {
  const status = t('widgets.FreeBodyWidget.status', {
    magnitude: format(readout.resultantMagnitude_N, t('widgets.FreeBodyWidget.unitN')),
    angle: readout.resultantAngle_deg.toFixed(ANGLE_DECIMALS),
    accel: format(readout.accel_mps2, t('widgets.FreeBodyWidget.unitMps2')),
  });
  const notice = slipNotice(readout, t);
  return notice === null ? status : `${status}. ${notice}`;
}
