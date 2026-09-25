/**
 * The values panel, the sliders and the `aria-live` sentence of `PowerWidget`
 * (docs/WIDGETS.md, PowerWidget). Every number comes from `compute.ts` and is formatted here.
 */
import { format } from '@trayectoria/sim-core';
import type { Translate } from '@trayectoria/i18n';

import type { ParamPanelParam } from '../ParamPanel/ParamPanel';
import type { ReadoutRow } from '../shared/ReadoutPanel';
import { heightAt, liftSpeed, potentialEnergyAt, reachedTop, riseTime, workAt } from './compute';
import type { Lift } from './compute';

/** Slider ranges of docs/WIDGETS.md, PowerWidget. `H` is a fixed prop with no slider. */
const RANGES = {
  power: { min: 0.5, max: 20, step: 0.01 },
  mass: { min: 0.1, max: 3, step: 0.01 },
} as const;

/** The lines of the values panel, in the order of the catalogue entry. */
export function panelRows(lift: Lift, t_s: number, t: Translate): readonly ReadoutRow[] {
  const unitJ = t('widgets.PowerWidget.unitJ');
  return [
    [t('widgets.PowerWidget.power'), format(lift.power_W, t('widgets.PowerWidget.unitW'))],
    [t('widgets.PowerWidget.mass'), format(lift.mass_kg, t('widgets.PowerWidget.unitKg'))],
    [t('widgets.PowerWidget.speed'), format(liftSpeed(lift), t('widgets.PowerWidget.unitMps'))],
    [t('widgets.PowerWidget.height'), format(heightAt(lift, t_s), t('widgets.PowerWidget.unitM'))],
    [t('widgets.PowerWidget.potential'), format(potentialEnergyAt(lift, t_s), unitJ)],
    [t('widgets.PowerWidget.work'), format(workAt(lift, t_s), unitJ)],
    [t('widgets.PowerWidget.riseTime'), format(riseTime(lift), t('widgets.PowerWidget.unitS'))],
  ];
}

/** The two sliders, `P` and `m`. */
export function paramsOf(lift: Lift, t: Translate): readonly ParamPanelParam[] {
  return [
    {
      key: 'power',
      label: t('widgets.PowerWidget.paramPower'),
      unit: t('widgets.PowerWidget.unitW'),
      value: lift.power_W,
      ...RANGES.power,
    },
    {
      key: 'mass',
      label: t('widgets.PowerWidget.paramMass'),
      unit: t('widgets.PowerWidget.unitKg'),
      value: lift.mass_kg,
      ...RANGES.mass,
    },
  ];
}

/** Applies one slider change; the time is untouched, so the scene is recomputed at `t`. */
export function applyChange(lift: Lift, key: string, value: number): Lift {
  if (key === 'power') return { ...lift, power_W: value };
  if (key === 'mass') return { ...lift, mass_kg: value };
  return lift;
}

/** One sentence with `t`, `h` and `E_p`, for the `aria-live` region. */
export function statusOf(lift: Lift, t_s: number, t: Translate): string {
  const values = {
    time: format(t_s, t('widgets.PowerWidget.unitS')),
    height: format(heightAt(lift, t_s), t('widgets.PowerWidget.unitM')),
    energy: format(potentialEnergyAt(lift, t_s), t('widgets.PowerWidget.unitJ')),
  };
  return reachedTop(lift, t_s)
    ? t('widgets.PowerWidget.statusTop', values)
    : t('widgets.PowerWidget.status', values);
}
