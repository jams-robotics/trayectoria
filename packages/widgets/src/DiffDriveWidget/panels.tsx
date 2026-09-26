import type { JSX } from 'react';
import { degToRad, radToDeg } from '@trayectoria/sim-core';
import type { MobileSpec } from '@trayectoria/robot-spec';
import type { Translate } from '@trayectoria/i18n';

import { ParamPanel } from '../ParamPanel/ParamPanel';
import type { ParamPanelParam } from '../ParamPanel/ParamPanel';
import { ReadoutPanel } from '../shared/ReadoutPanel';
import type { ReadoutRow } from '../shared/ReadoutPanel';
import { maxSpeed_mps, maxWheelSpeed_radps } from './compute';
import type { DiffDriveMode, Pose, WheelCommand } from './compute';
import type { Calibration } from './odometry';
import { frameRows, odometryRows, poseRows } from './rows';
import type { OdometryReadout, Readout } from './rows';

export { radiusText, readDiffDrive, statusOf } from './rows';
export type { Readout } from './rows';

/** Step of the wheel sliders, in rad/s (#92, decision 4: the range comes from the spec). */
const OMEGA_STEP_RADPS = 0.1;
/** Step of the `v` slider, in m/s (#92, decision 4). */
const V_STEP_MPS = 0.01;
/** Range of the `ω` slider of `inverse`, in rad/s (#92, decision 4). */
const OMEGA_RANGE_RADPS = { min: -5, max: 5, step: 0.05 };
/** Range of the `N_e` slider, in ticks per wheel revolution (#93, decision 3). */
const TICKS_RANGE = { min: 16, max: 4096, step: 1 };
/** Range of the believed wheel radius slider, in metres (#93, decision 3). */
const BELIEVED_RADIUS_RANGE_M = { min: 0.02, max: 0.05, step: 0.0005 };
/** Range of the believed track width slider, in metres (#93, decision 3). */
const BELIEVED_BASE_RANGE_M = { min: 0.1, max: 0.25, step: 0.0005 };
/** Decimals a calibration length is rounded to, so the 0.5 mm step reaches the panel exactly. */
const CALIBRATION_DECIMALS = 4;

/** Range of the `θ` slider of the pose panel, in degrees (#92, decision 6). */
const THETA_RANGE_DEG = { min: -180, max: 180, step: 1 };
/** Decimals a slider value is rounded to before it reaches the panel. */
const SLIDER_DECIMALS = 2;

/** The twist the learner edits in `inverse`, as `WIDGETS.md` declares its `initial`. */
export interface TwistInput {
  v_mps: number;
  omega_radps: number;
}

/** Rounds a value so the panel never shows the floating point noise of a slider step. */
function rounded(value: number): number {
  return Number(value.toFixed(SLIDER_DECIMALS));
}

/** The two wheel sliders of `forward`, bounded by `±ω_max` of the spec (#92, decision 4). */
export function wheelParams(
  command: WheelCommand,
  spec: MobileSpec,
  t: Translate,
): readonly ParamPanelParam[] {
  const max = Number(maxWheelSpeed_radps(spec).toFixed(1));
  const unit = t('widgets.DiffDriveWidget.unitRadps');
  return [
    {
      key: 'omegaL',
      label: t('widgets.DiffDriveWidget.paramOmegaL'),
      unit,
      min: -max,
      max,
      step: OMEGA_STEP_RADPS,
      value: rounded(command.omegaL_radps),
    },
    {
      key: 'omegaR',
      label: t('widgets.DiffDriveWidget.paramOmegaR'),
      unit,
      min: -max,
      max,
      step: OMEGA_STEP_RADPS,
      value: rounded(command.omegaR_radps),
    },
  ];
}

/** The `v` and `ω` sliders of `inverse`; `v` is bounded by `v_max` (#92, decision 4). */
export function twistParams(
  twist: TwistInput,
  spec: MobileSpec,
  t: Translate,
): readonly ParamPanelParam[] {
  const maxV = Number(maxSpeed_mps(spec).toFixed(2));
  return [
    {
      key: 'v',
      label: t('widgets.DiffDriveWidget.paramV'),
      unit: t('widgets.DiffDriveWidget.unitMps'),
      min: -maxV,
      max: maxV,
      step: V_STEP_MPS,
      value: rounded(twist.v_mps),
    },
    {
      key: 'omega',
      label: t('widgets.DiffDriveWidget.paramOmega'),
      unit: t('widgets.DiffDriveWidget.unitRadps'),
      value: rounded(twist.omega_radps),
      ...OMEGA_RANGE_RADPS,
    },
  ];
}

/** The slider of the initial orientation `θ₀`, in degrees (#92, decision 6; #371). */
export function thetaParam(theta0_rad: number, t: Translate): readonly ParamPanelParam[] {
  return [
    {
      key: 'theta',
      label: t('widgets.DiffDriveWidget.paramTheta'),
      unit: t('widgets.DiffDriveWidget.unitDeg'),
      value: Math.round(radToDeg(theta0_rad)),
      ...THETA_RANGE_DEG,
    },
  ];
}

/** Turns a change of the `θ₀` slider, which arrives in degrees, into radians (#371). */
export function theta0Of(value_deg: number): number {
  return degToRad(value_deg);
}

/** Applies a change of one wheel slider (#92, decision 4). */
export function applyWheel(command: WheelCommand, key: string, value: number): WheelCommand {
  if (key === 'omegaL') return { ...command, omegaL_radps: value };
  if (key === 'omegaR') return { ...command, omegaR_radps: value };
  return command;
}

/** Applies a change of the `v` or `ω` slider of `inverse` (#92, decision 4). */
export function applyTwist(twist: TwistInput, key: string, value: number): TwistInput {
  if (key === 'v') return { ...twist, v_mps: value };
  if (key === 'omega') return { ...twist, omega_radps: value };
  return twist;
}

/**
 * The three calibration sliders of `odometry`: the ticks per revolution that quantise the
 * encoders and the radius and track width the estimator believes (#93, decision 3).
 */
export function calibrationParams(
  calibration: Calibration,
  t: Translate,
): readonly ParamPanelParam[] {
  const unitM = t('widgets.DiffDriveWidget.unitM');
  const length = (value: number): number => Number(value.toFixed(CALIBRATION_DECIMALS));
  return [
    {
      key: 'ticksPerRev',
      label: t('widgets.DiffDriveWidget.paramTicksPerRev'),
      unit: t('widgets.DiffDriveWidget.unitTicks'),
      value: calibration.ticksPerRev,
      ...TICKS_RANGE,
    },
    {
      key: 'believedRadius',
      label: t('widgets.DiffDriveWidget.paramBelievedRadius'),
      unit: unitM,
      value: length(calibration.wheelRadius_m),
      ...BELIEVED_RADIUS_RANGE_M,
    },
    {
      key: 'believedBase',
      label: t('widgets.DiffDriveWidget.paramBelievedBase'),
      unit: unitM,
      value: length(calibration.wheelBase_m),
      ...BELIEVED_BASE_RANGE_M,
    },
  ];
}

/** Applies a change of one calibration slider (#93, decision 3). */
export function applyCalibration(
  calibration: Calibration,
  key: string,
  value: number,
): Calibration {
  if (key === 'ticksPerRev') return { ...calibration, ticksPerRev: Math.round(value) };
  if (key === 'believedRadius') return { ...calibration, wheelRadius_m: value };
  if (key === 'believedBase') return { ...calibration, wheelBase_m: value };
  return calibration;
}

/** The odometry panel: the step, the estimated pose and the two errors (#93, decision 3). */
export function OdometryPanel({
  odometry,
  real,
  t,
}: {
  odometry: OdometryReadout;
  real: Pose;
  t: Translate;
}): JSX.Element {
  return (
    <ReadoutPanel
      title={t('widgets.DiffDriveWidget.odometryPanel')}
      rows={odometryRows(odometry, real, t)}
    />
  );
}

/** A short notice line: the saturation warning of decision 4. */
export function Notice({ text, tone }: { text: string; tone: 'error' | 'muted' }): JSX.Element {
  const color = tone === 'error' ? 'text-error' : 'text-fg-muted';
  return (
    <p role="note" className={`${color} text-sm`} data-testid="diffdrive-notice">
      {text}
    </p>
  );
}

export interface PosePanelProps {
  mode: DiffDriveMode;
  readout: Readout;
  spec: MobileSpec;
  withFrames: boolean;
  /** Initial orientation `θ₀` the slider shows, not the current one of the pose (#371). */
  theta0_rad: number;
  /** True while the simulation runs: the slider is disabled and keeps showing `θ₀` (#371). */
  running: boolean;
  onTheta: (value_deg: number) => void;
  /** Lines added after the pose ones: the phase and duration of the maneuver (#394), or none. */
  extraRows: readonly ReadoutRow[];
  t: Translate;
}

/**
 * The pose panel: `x, y, θ`, `v, ω, R` and the wheel commands, plus the terms of `R(θ)` and the
 * global sensor coordinates when `show` includes `frames` (#92, decision 6). The initial
 * orientation `θ₀` is edited here with a slider, because the scene only drags `x, y` (#371).
 */
export function PosePanel({
  readout,
  spec,
  withFrames,
  theta0_rad,
  running,
  onTheta,
  extraRows,
  t,
}: PosePanelProps): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <ReadoutPanel
        title={t('widgets.DiffDriveWidget.panel')}
        rows={[...poseRows(readout, spec, t), ...extraRows]}
      />
      {withFrames ? (
        <ReadoutPanel
          title={t('widgets.DiffDriveWidget.framesPanel')}
          rows={frameRows(readout.pose, spec, t)}
        />
      ) : null}
      {/* A disabled fieldset disables the slider and its field without a prop on ParamPanel. */}
      <fieldset disabled={running} className="m-0 min-w-0 border-0 p-0">
        <ParamPanel
          params={thetaParam(theta0_rad, t)}
          onChange={(_key, value) => {
            onTheta(value);
          }}
        />
      </fieldset>
    </div>
  );
}
