/**
 * The lines of each values panel of `EnergyWidget` and the sentence of its `aria-live` region
 * (#90, decisions 4, 6 and 8). Every number comes from `compute.ts` or `model.ts` and is
 * formatted once here, so the React parts in `panels.tsx` only lay them out.
 */
import { format, radToDeg } from '@trayectoria/sim-core';
import type { Translate } from '@trayectoria/i18n';

import type { ReadoutRow } from '../shared/ReadoutPanel';
import { readElectrical, readMechanical } from './compute';
import type { Electrical, Mechanical, Ramp } from './compute';
import type { Energies } from './model';

/** The values panel of `ramp`: the three energies, the dissipated work and the height (T-3.1). */
export function rampRows(
  ramp: Ramp,
  energies: Energies,
  v_mps: number,
  t: Translate,
): readonly ReadoutRow[] {
  const unitJ = t('widgets.EnergyWidget.unitJ');
  return [
    [t('widgets.EnergyWidget.speed'), format(v_mps, t('widgets.EnergyWidget.unitMps'))],
    [t('widgets.EnergyWidget.height'), format(energies.height_m, t('widgets.EnergyWidget.unitM'))],
    [t('widgets.EnergyWidget.barkinetic'), format(energies.kinetic_J, unitJ)],
    [t('widgets.EnergyWidget.barpotential'), format(energies.potential_J, unitJ)],
    [t('widgets.EnergyWidget.barmechanical'), format(energies.mechanical_J, unitJ)],
    [t('widgets.EnergyWidget.bardissipated'), format(energies.dissipated_J, unitJ)],
    [t('widgets.EnergyWidget.slope'), format(radToDeg(ramp.slope_rad), t('widgets.EnergyWidget.unitDeg'))],
  ];
}

/** The values panel of the mechanical block of `power`: `ω` and `P = τ ω` (T-3.2). */
export function mechanicalRows(mechanical: Mechanical, t: Translate): readonly ReadoutRow[] {
  const { omega_radps, power_W } = readMechanical(mechanical);
  return [
    [t('widgets.EnergyWidget.omega'), format(omega_radps, t('widgets.EnergyWidget.unitRadps'))],
    [t('widgets.EnergyWidget.shaftPower'), format(power_W, t('widgets.EnergyWidget.unitW'))],
  ];
}

/** The values panel of the electrical block: `P_el`, `P_mec` and the autonomy (T-3.2). */
export function electricalRows(electrical: Electrical, t: Translate): readonly ReadoutRow[] {
  const { electrical_W, mechanical_W, autonomy_min } = readElectrical(electrical);
  const unitW = t('widgets.EnergyWidget.unitW');
  return [
    [t('widgets.EnergyWidget.electricalPower'), format(electrical_W, unitW)],
    [t('widgets.EnergyWidget.mechanicalPower'), format(mechanical_W, unitW)],
    [
      t('widgets.EnergyWidget.autonomy'),
      Number.isFinite(autonomy_min)
        ? format(autonomy_min, t('widgets.EnergyWidget.unitMin'))
        : t('widgets.EnergyWidget.noDraw'),
    ],
  ];
}

/** One sentence with the energies of the body, for the `aria-live` region (#90, decision 8). */
export function rampStatus(energies: Energies, v_mps: number, t: Translate): string {
  const unitJ = t('widgets.EnergyWidget.unitJ');
  return t('widgets.EnergyWidget.statusRamp', {
    speed: format(v_mps, t('widgets.EnergyWidget.unitMps')),
    height: format(energies.height_m, t('widgets.EnergyWidget.unitM')),
    kinetic: format(energies.kinetic_J, unitJ),
    potential: format(energies.potential_J, unitJ),
    mechanical: format(energies.mechanical_J, unitJ),
  });
}

/** One sentence with the three powers and the autonomy, for the `aria-live` region (decision 8). */
export function powerStatus(
  mechanical: Mechanical,
  electrical: Electrical,
  t: Translate,
): string {
  const unitW = t('widgets.EnergyWidget.unitW');
  const readout = readElectrical(electrical);
  return t('widgets.EnergyWidget.statusPower', {
    shaft: format(readMechanical(mechanical).power_W, unitW),
    electrical: format(readout.electrical_W, unitW),
    mechanical: format(readout.mechanical_W, unitW),
    autonomy: Number.isFinite(readout.autonomy_min)
      ? format(readout.autonomy_min, t('widgets.EnergyWidget.unitMin'))
      : t('widgets.EnergyWidget.noDraw'),
  });
}
