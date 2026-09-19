import type { JSX } from 'react';
import { degToRad, radToDeg } from '@trayectoria/sim-core';
import type { MobileSpec } from '@trayectoria/robot-spec';
import type { Translate } from '@trayectoria/i18n';

import { ParamPanel } from '../ParamPanel/ParamPanel';
import type { ParamPanelParam } from '../ParamPanel/ParamPanel';
import { ReadoutPanel } from '../shared/ReadoutPanel';
import { maxSpeed_mps, maxWheelSpeed_radps } from './compute';
import type { DiffDriveMode, Pose, WheelCommand } from './compute';
import { frameRows, poseRows } from './rows';
import type { Readout } from './rows';

export { radiusText, readDiffDrive, statusOf } from './rows';
export type { Readout } from './rows';

/** Step of the wheel sliders, in rad/s (#92, decision 4: the range comes from the spec). */
const OMEGA_STEP_RADPS = 0.1;
/** Step of the `v` slider, in m/s (#92, decision 4). */
const V_STEP_MPS = 0.01;
/** Range of the `ω` slider of `inverse`, in rad/s (#92, decision 4). */
const OMEGA_RANGE_RADPS = { min: -5, max: 5, step: 0.05 };
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

/** The `θ` slider of the pose panel, in degrees (#92, decision 6). */
export function thetaParam(pose: Pose, t: Translate): readonly ParamPanelParam[] {
  return [
    {
      key: 'theta',
      label: t('widgets.DiffDriveWidget.paramTheta'),
      unit: t('widgets.DiffDriveWidget.unitDeg'),
      value: Math.round(radToDeg(pose.theta_rad)),
      ...THETA_RANGE_DEG,
    },
  ];
}

/** Applies a change of the `θ` slider, which arrives in degrees (#92, decision 6). */
export function applyTheta(pose: Pose, value_deg: number): Pose {
  return { ...pose, theta_rad: degToRad(value_deg) };
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

/** A short notice line: the saturation warning and the `odometry` placeholder of decision 9. */
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
  onTheta: (value_deg: number) => void;
  t: Translate;
}

/**
 * The pose panel: `x, y, θ`, `v, ω, R` and the wheel commands, plus the terms of `R(θ)` and the
 * global sensor coordinates when `show` includes `frames` (#92, decision 6). `θ` is edited here
 * with a slider, because the scene only drags `x, y`.
 */
export function PosePanel({
  readout,
  spec,
  withFrames,
  onTheta,
  t,
}: PosePanelProps): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <ReadoutPanel title={t('widgets.DiffDriveWidget.panel')} rows={poseRows(readout, spec, t)} />
      {withFrames ? (
        <ReadoutPanel
          title={t('widgets.DiffDriveWidget.framesPanel')}
          rows={frameRows(readout.pose, spec, t)}
        />
      ) : null}
      <ParamPanel
        params={thetaParam(readout.pose, t)}
        onChange={(_key, value) => {
          onTheta(value);
        }}
      />
    </div>
  );
}
