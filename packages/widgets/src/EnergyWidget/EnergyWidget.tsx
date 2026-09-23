import { useState } from 'react';
import type { JSX } from 'react';
import { radpsToRpm } from '@trayectoria/sim-core';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

import { ParamPanel } from '../ParamPanel/ParamPanel';
import { SimControls } from '../SimControls/SimControls';
import { LiveStatus, ReadoutPanel } from '../shared/ReadoutPanel';
import { EnergyBars } from './bars';
import type { Electrical, EnergyMode, Mechanical, MotorCount, Ramp } from './compute';
import { energiesOf } from './model';
import type { Energies } from './model';
import {
  ElectricalBlock,
  MechanicalBlock,
  applyElectricalChange,
  applyMechanicalChange,
  applyRampChange,
  powerStatus,
  rampParamsOf,
  rampRows,
  rampStatus,
} from './panels';
import { EnergyScene } from './scene';
import { useTimeline } from './timeline';

export type { EnergyMode, MotorCount } from './compute';

/** Default efficiency of the electrical block; `η` is an input, never derived (decision 6). */
const DEFAULT_EFFICIENCY = 0.6;
/** Default motor count: «Al robot» of T-3.2 adds up the two motors of the profile (decision 6). */
const DEFAULT_MOTORS: MotorCount = 2;

export interface EnergyWidgetProps {
  mode: EnergyMode;
  initial: {
    mass_kg: number;
    v0_mps: number;
    slope_rad: number;
    mu_k?: number;
  };
  power?: {
    torque_Nm: number;
    omega_radps: number;
    voltage_V: number;
    current_A: number;
    battery_Wh: number;
  };
  /** Time the widget opens at, in seconds. Defaults to the start of the run. */
  initialTime_s?: number;
}

/** The right-hand column of `ramp`: the values, the live sentence and the four sliders. */
function RampPanels({
  ramp,
  energies,
  v_mps,
  onChange,
  t,
}: {
  ramp: Ramp;
  energies: Energies;
  v_mps: number;
  onChange: (key: string, value: number) => void;
  t: Translate;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-4 lg:w-panel">
      <ReadoutPanel
        title={t('widgets.EnergyWidget.panel')}
        rows={rampRows(ramp, energies, v_mps, t)}
      />
      <LiveStatus text={rampStatus(energies, v_mps, t)} />
      <ParamPanel params={rampParamsOf(ramp, t)} onChange={onChange} />
    </div>
  );
}

/** The `ramp` mode: the body on its track, the live bars and the sliders (#90, decisions 3-5). */
function RampMode({
  initial,
  initialTime_s,
  t,
}: {
  initial: EnergyWidgetProps['initial'];
  initialTime_s: number;
  t: Translate;
}): JSX.Element {
  const [ramp, setRamp] = useState<Ramp>(() => ({
    mass_kg: initial.mass_kg,
    v0_mps: initial.v0_mps,
    slope_rad: initial.slope_rad,
    mu_k: initial.mu_k ?? 0,
  }));
  const timeline = useTimeline(ramp, initialTime_s);
  const energies = energiesOf(ramp, timeline.state);
  // Common scale of the four bars: the mechanical energy the body started with (decision 4).
  const scale_J = 0.5 * ramp.mass_kg * ramp.v0_mps * ramp.v0_mps;
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <EnergyScene ramp={ramp} state={timeline.state} t={t} />
        <SimControls {...timeline.driver} {...timeline.controls} t_s={timeline.t_s} />
        <EnergyBars energies={energies} scale_J={scale_J} t={t} />
      </div>
      <RampPanels
        ramp={ramp}
        energies={energies}
        v_mps={timeline.state.v_mps}
        onChange={(key, value) => {
          setRamp((current) => applyRampChange(current, key, value));
        }}
        t={t}
      />
    </div>
  );
}

/** The mechanical block the `power` props open at; `ω` arrives in rad/s and is edited in rpm. */
function mechanicalOf(power: NonNullable<EnergyWidgetProps['power']>): Mechanical {
  return {
    torque_Nm: power.torque_Nm,
    n_rpm: Number(radpsToRpm(power.omega_radps).toFixed(0)),
  };
}

/** The electrical block the `power` props open at; `η` and the motor count are its defaults. */
function electricalOf(power: NonNullable<EnergyWidgetProps['power']>): Electrical {
  return {
    voltage_V: power.voltage_V,
    current_A: power.current_A,
    efficiency: DEFAULT_EFFICIENCY,
    motors: DEFAULT_MOTORS,
    battery_Wh: power.battery_Wh,
  };
}

/** The `power` mode: the mechanical and the electrical blocks, with no animation (decision 6). */
function PowerMode({
  power,
  t,
}: {
  power: NonNullable<EnergyWidgetProps['power']>;
  t: Translate;
}): JSX.Element {
  const [mechanical, setMechanical] = useState<Mechanical>(() => mechanicalOf(power));
  const [electrical, setElectrical] = useState<Electrical>(() => electricalOf(power));
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <MechanicalBlock
          mechanical={mechanical}
          onChange={(key, value) => {
            setMechanical((current) => applyMechanicalChange(current, key, value));
          }}
          t={t}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <ElectricalBlock
          electrical={electrical}
          onChange={(key, value) => {
            setElectrical((current) => applyElectricalChange(current, key, value));
          }}
          onMotorsChange={(motors) => {
            setElectrical((current) => ({ ...current, motors }));
          }}
          t={t}
        />
        <LiveStatus text={powerStatus(mechanical, electrical, t)} />
      </div>
    </div>
  );
}

/** The `power` mode with nothing to show, when the props carry no `power` block. */
const EMPTY_POWER = {
  torque_Nm: 0.03,
  omega_radps: 523.6,
  voltage_V: 6,
  current_A: 1.2,
  battery_Wh: 11.1,
} as const;

/**
 * Work, energy and power of the robot (docs/WIDGETS.md, EnergyWidget; docs/CURRICULUM.md T-3.1
 * and T-3.2). In `ramp` a body slides along a flat run and up a ramp of angle `φ` while the
 * bars show `E_k`, `E_p`, `E_mec` and the work friction has dissipated; the dynamics are
 * integrated with `rk4` of sim-core in `model.ts` and the energies read back from that state in
 * closed form (#90, decision 1). In `power` there is no animation: `P = τ ω`, `P_el = V I`,
 * `P_mec = η P_el` and the autonomy `C/P_el · 60` (#90, decision 6).
 */
export function EnergyWidget({
  mode,
  initial,
  power,
  initialTime_s = 0,
}: EnergyWidgetProps): JSX.Element {
  const t = useT();
  if (mode === 'power') return <PowerMode power={power ?? EMPTY_POWER} t={t} />;
  return <RampMode initial={initial} initialTime_s={initialTime_s} t={t} />;
}
