/**
 * The lines of the values panel of `GearWidget` and the sentence of its `aria-live` region
 * (#91, decisions 5 and 7). Every number comes from `compute.ts` and is formatted once here,
 * so the React parts in `panels.tsx` only lay them out.
 */
import { format } from '@trayectoria/sim-core';
import type { Translate } from '@trayectoria/i18n';

import type { ReadoutRow } from '../shared/ReadoutPanel';
import {
  inputPower_W,
  outputOmega_radps,
  outputPower_W,
  outputSign,
  outputSpeed_rpm,
  outputTorque_Nm,
  stageRatio,
  totalRatio,
} from './compute';
import type { GearStages, Train } from './compute';

/** Turns per second the input gear is never drawn above, so the animation stays readable. */
export const MAX_DRAWN_TURNS_PER_S = 1;

/**
 * Factor the drawn speed is divided by so the input gear does not pass one turn per second
 * (#91, decision 4). The panel always shows the real values; only the drawing is slowed.
 */
export function animationScale(nIn_rpm: number): number {
  const turnsPerS = Math.abs(nIn_rpm) / 60;
  return Math.max(turnsPerS / MAX_DRAWN_TURNS_PER_S, 1);
}

/** The direction of the output shaft, as a translated sentence (#91, decision 5). */
export function directionOf(stages: GearStages, t: Translate): string {
  return t(outputSign(stages) < 0 ? 'widgets.GearWidget.opposite' : 'widgets.GearWidget.same');
}

/** The ratio lines: one per stage plus the total, only both when the train has two stages. */
function ratioRows(stages: GearStages, train: Train, t: Translate): ReadoutRow[] {
  const total: ReadoutRow = [
    t('widgets.GearWidget.ratioTotal'),
    format(totalRatio(stages, train), ''),
  ];
  if (stages === 1) return [total];
  return [
    [t('widgets.GearWidget.ratioStage1'), format(stageRatio(train.z1, train.z2), '')],
    [t('widgets.GearWidget.ratioStage2'), format(stageRatio(train.z3, train.z4), '')],
    total,
  ];
}

/** The lines of the values panel: ratios, output speed, torque, powers and direction (T-4.4). */
export function panelRows(
  stages: GearStages,
  train: Train,
  t: Translate,
): readonly ReadoutRow[] {
  return [
    ...ratioRows(stages, train, t),
    [
      t('widgets.GearWidget.speedOut'),
      format(outputSpeed_rpm(stages, train), t('widgets.GearWidget.unitRpm')),
    ],
    [
      t('widgets.GearWidget.omegaOut'),
      format(outputOmega_radps(stages, train), t('widgets.GearWidget.unitRadps')),
    ],
    [
      t('widgets.GearWidget.torqueOut'),
      format(outputTorque_Nm(stages, train), t('widgets.GearWidget.unitNm')),
    ],
    [t('widgets.GearWidget.powerIn'), format(inputPower_W(train), t('widgets.GearWidget.unitW'))],
    [t('widgets.GearWidget.powerOut'), format(outputPower_W(train), t('widgets.GearWidget.unitW'))],
    [t('widgets.GearWidget.direction'), directionOf(stages, t)],
  ];
}

/** One sentence with `i`, `n_out`, `τ_out` and the direction, for the `aria-live` region. */
export function statusOf(stages: GearStages, train: Train, t: Translate): string {
  return t('widgets.GearWidget.status', {
    ratio: format(totalRatio(stages, train), ''),
    speed: format(outputSpeed_rpm(stages, train), t('widgets.GearWidget.unitRpm')),
    torque: format(outputTorque_Nm(stages, train), t('widgets.GearWidget.unitNm')),
    direction: directionOf(stages, t),
  });
}
