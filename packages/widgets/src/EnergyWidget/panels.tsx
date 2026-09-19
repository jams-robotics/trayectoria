import type { JSX } from 'react';
import { degToRad, radToDeg } from '@trayectoria/sim-core';
import type { Translate } from '@trayectoria/i18n';

import { ParamPanel } from '../ParamPanel/ParamPanel';
import type { ParamPanelParam } from '../ParamPanel/ParamPanel';
import { ReadoutPanel } from '../shared/ReadoutPanel';
import { MotorToggle } from './MotorToggle';
import { electricalRows, mechanicalRows } from './rows';
import type { Electrical, Mechanical, MotorCount, Ramp } from './compute';

export { electricalRows, mechanicalRows, powerStatus, rampRows, rampStatus } from './rows';

/** Slider ranges of the `ramp` mode (#90, decision 5); `φ` is edited in degrees. */
const RAMP_RANGES = {
  mass: { min: 0.2, max: 3, step: 0.01 },
  v0: { min: 0.1, max: 1.5, step: 0.01 },
  slope: { min: 0, max: 45, step: 1 },
  mu: { min: 0, max: 0.3, step: 0.01 },
} as const;

/** Slider ranges of the two blocks of the `power` mode (#90, decision 6). */
const POWER_RANGES = {
  torque: { min: 0.005, max: 0.1, step: 0.001 },
  speed: { min: 500, max: 8000, step: 10 },
  voltage: { min: 3, max: 24, step: 0.1 },
  current: { min: 0.1, max: 5, step: 0.1 },
  efficiency: { min: 0.1, max: 1, step: 0.01 },
  battery: { min: 3, max: 40, step: 0.1 },
} as const;

/** The four sliders of `ramp`: `m`, `v0`, `φ` in degrees and `μk` (#90, decision 5). */
export function rampParamsOf(ramp: Ramp, t: Translate): readonly ParamPanelParam[] {
  return [
    {
      key: 'mass',
      label: t('widgets.EnergyWidget.paramMass'),
      unit: t('widgets.EnergyWidget.unitKg'),
      value: ramp.mass_kg,
      ...RAMP_RANGES.mass,
    },
    {
      key: 'v0',
      label: t('widgets.EnergyWidget.paramV0'),
      unit: t('widgets.EnergyWidget.unitMps'),
      value: ramp.v0_mps,
      ...RAMP_RANGES.v0,
    },
    {
      key: 'slope',
      label: t('widgets.EnergyWidget.paramSlope'),
      unit: t('widgets.EnergyWidget.unitDeg'),
      value: Number(radToDeg(ramp.slope_rad).toFixed(0)),
      ...RAMP_RANGES.slope,
    },
    {
      key: 'mu',
      label: t('widgets.EnergyWidget.paramMu'),
      unit: '',
      value: ramp.mu_k,
      ...RAMP_RANGES.mu,
    },
  ];
}

/** Applies one slider change of `ramp`; `φ` arrives in degrees (#90, decision 5). */
export function applyRampChange(ramp: Ramp, key: string, value: number): Ramp {
  if (key === 'mass') return { ...ramp, mass_kg: value };
  if (key === 'v0') return { ...ramp, v0_mps: value };
  if (key === 'slope') return { ...ramp, slope_rad: degToRad(value) };
  if (key === 'mu') return { ...ramp, mu_k: value };
  return ramp;
}

/** The two sliders of the mechanical block: `τ` and `n` in rpm (#90, decision 6). */
export function mechanicalParamsOf(
  mechanical: Mechanical,
  t: Translate,
): readonly ParamPanelParam[] {
  return [
    {
      key: 'torque',
      label: t('widgets.EnergyWidget.paramTorque'),
      unit: t('widgets.EnergyWidget.unitNm'),
      value: mechanical.torque_Nm,
      ...POWER_RANGES.torque,
    },
    {
      key: 'speed',
      label: t('widgets.EnergyWidget.paramSpeed'),
      unit: t('widgets.EnergyWidget.unitRpm'),
      value: mechanical.n_rpm,
      ...POWER_RANGES.speed,
    },
  ];
}

/** Applies one slider change of the mechanical block (#90, decision 6). */
export function applyMechanicalChange(
  mechanical: Mechanical,
  key: string,
  value: number,
): Mechanical {
  if (key === 'torque') return { ...mechanical, torque_Nm: value };
  if (key === 'speed') return { ...mechanical, n_rpm: value };
  return mechanical;
}

/** The four sliders of the electrical block: `V`, `I`, `η` and `C` (#90, decision 6). */
export function electricalParamsOf(
  electrical: Electrical,
  t: Translate,
): readonly ParamPanelParam[] {
  return [
    {
      key: 'voltage',
      label: t('widgets.EnergyWidget.paramVoltage'),
      unit: t('widgets.EnergyWidget.unitV'),
      value: electrical.voltage_V,
      ...POWER_RANGES.voltage,
    },
    {
      key: 'current',
      label: t('widgets.EnergyWidget.paramCurrent'),
      unit: t('widgets.EnergyWidget.unitA'),
      value: electrical.current_A,
      ...POWER_RANGES.current,
    },
    {
      key: 'efficiency',
      label: t('widgets.EnergyWidget.paramEfficiency'),
      unit: '',
      value: electrical.efficiency,
      ...POWER_RANGES.efficiency,
    },
    {
      key: 'battery',
      label: t('widgets.EnergyWidget.paramBattery'),
      unit: t('widgets.EnergyWidget.unitWh'),
      value: electrical.battery_Wh,
      ...POWER_RANGES.battery,
    },
  ];
}

/** Applies one slider change of the electrical block (#90, decision 6). */
export function applyElectricalChange(
  electrical: Electrical,
  key: string,
  value: number,
): Electrical {
  if (key === 'voltage') return { ...electrical, voltage_V: value };
  if (key === 'current') return { ...electrical, current_A: value };
  if (key === 'efficiency') return { ...electrical, efficiency: value };
  if (key === 'battery') return { ...electrical, battery_Wh: value };
  return electrical;
}

/** The mechanical block of `power`: `ω`, `P = τ ω` and its two sliders (#90, decision 6). */
export function MechanicalBlock({
  mechanical,
  onChange,
  t,
}: {
  mechanical: Mechanical;
  onChange: (key: string, value: number) => void;
  t: Translate;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2" data-testid="mechanical-block">
      <ReadoutPanel
        title={t('widgets.EnergyWidget.mechanicalBlock')}
        rows={mechanicalRows(mechanical, t)}
      />
      <ParamPanel params={mechanicalParamsOf(mechanical, t)} onChange={onChange} />
    </div>
  );
}

/** The electrical block of `power`: `P_el`, `P_mec`, the autonomy and its controls (decision 6). */
export function ElectricalBlock({
  electrical,
  onChange,
  onMotorsChange,
  t,
}: {
  electrical: Electrical;
  onChange: (key: string, value: number) => void;
  onMotorsChange: (motors: MotorCount) => void;
  t: Translate;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2" data-testid="electrical-block">
      <ReadoutPanel
        title={t('widgets.EnergyWidget.electricalBlock')}
        rows={electricalRows(electrical, t)}
      />
      <MotorToggle value={electrical.motors} onChange={onMotorsChange} t={t} />
      <ParamPanel params={electricalParamsOf(electrical, t)} onChange={onChange} />
    </div>
  );
}
