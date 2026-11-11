import type { JSX, ReactNode } from 'react';
import { degToRad, radToDeg } from '@trayectoria/sim-core';
import type { MobileSpec } from '@trayectoria/robot-spec';
import type { Translate } from '@trayectoria/i18n';

import type { ParamPanelParam } from '../ParamPanel/ParamPanel';
import { ReadoutPanel } from '../shared/ReadoutPanel';
import type { ReadoutRow } from '../shared/ReadoutPanel';
import { maxSpeed_mps, maxWheelSpeed_radps } from './compute';
import type { DiffDriveMode, Pose, WheelCommand } from './compute';
import type { Calibration } from './odometry';
import {
  ODOMETRY_ESSENTIAL_ROWS,
  POSE_ESSENTIAL_ROWS,
  frameRows,
  matrixTerms,
  odometryRows,
  poseRows,
} from './rows';
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

/**
 * The slider of the initial orientation `θ₀`, in degrees (#92, decision 6; #371). It is disabled
 * while the simulation runs and keeps showing `θ₀`.
 */
export function thetaParam(
  theta0_rad: number,
  t: Translate,
  disabled = false,
): readonly ParamPanelParam[] {
  return [
    {
      key: 'theta',
      label: t('widgets.DiffDriveWidget.paramTheta'),
      unit: t('widgets.DiffDriveWidget.unitDeg'),
      value: Math.round(radToDeg(theta0_rad)),
      disabled,
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
  velocityFirst,
  t,
}: {
  odometry: OdometryReadout;
  real: Pose;
  /** The topic reads the velocity estimate: its lines come first (v1.5). */
  velocityFirst: boolean;
  t: Translate;
}): JSX.Element {
  return (
    <ReadoutPanel
      title={t('widgets.DiffDriveWidget.odometryPanel')}
      rows={odometryRows(odometry, real, t, velocityFirst)}
      visibleRows={ODOMETRY_ESSENTIAL_ROWS}
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

/** Pose rows with the maneuver lines right after the essential ones, so they stay in view. */
function posePanelRows(
  mode: DiffDriveMode,
  readout: Readout,
  spec: MobileSpec,
  extraRows: readonly ReadoutRow[],
  t: Translate,
): readonly ReadoutRow[] {
  const rows = poseRows(readout, spec, t, mode);
  return [...rows.slice(0, POSE_ESSENTIAL_ROWS), ...extraRows, ...rows.slice(POSE_ESSENTIAL_ROWS)];
}

export interface PosePanelProps {
  mode: DiffDriveMode;
  readout: Readout;
  spec: MobileSpec;
  withFrames: boolean;
  /** Lines added after the pose ones: the phase and duration of the maneuver (#394), or none. */
  extraRows: readonly ReadoutRow[];
  /** Rendered right under the pose rows, before the frames panel (v1.5). */
  children?: ReactNode;
  t: Translate;
}

/** One term of `R(θ)`; the matrix is drawn with a bracket on each side. */
function MatrixCell({ value }: { value: string }): JSX.Element {
  return <td className="px-2 text-right">{value}</td>;
}

/**
 * `R(θ)` as a 2×2 matrix with its brackets. A `table` named «R(θ), matriz de rotación…» keeps
 * its rows and columns for a screen reader.
 */
function RotationMatrix({ pose, t }: { pose: Pose; t: Translate }): JSX.Element {
  const [r11, r12, r21, r22] = matrixTerms(pose);
  return (
    <div className="flex items-center gap-2 font-mono text-sm tabular-nums">
      <span aria-hidden="true">{t('widgets.DiffDriveWidget.matrixName')}</span>
      <div className="border-fg relative px-3 py-1 before:absolute before:inset-y-0 before:left-0 before:w-[6px] before:border-y-2 before:border-l-2 before:border-inherit after:absolute after:inset-y-0 after:right-0 after:w-[6px] after:border-y-2 after:border-r-2 after:border-inherit">
        <table
          aria-label={t('widgets.DiffDriveWidget.matrix')}
          data-testid="rotation-matrix"
          className="border-separate border-spacing-y-1"
        >
          <tbody>
            <tr>
              <MatrixCell value={r11} />
              <MatrixCell value={r12} />
            </tr>
            <tr>
              <MatrixCell value={r21} />
              <MatrixCell value={r22} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Sensor lines of the frames panel in view: the first one, the one the topics read (v1.5). */
const FRAMES_ESSENTIAL_ROWS = 1;

/** The frames panel: `R(θ)` as a matrix, the first sensor and the rest behind «Más datos». */
function FramesPanel({
  pose,
  spec,
  t,
}: {
  pose: Pose;
  spec: MobileSpec;
  t: Translate;
}): JSX.Element {
  return (
    <ReadoutPanel
      title={t('widgets.DiffDriveWidget.framesPanel')}
      rows={frameRows(pose, spec, t)}
      visibleRows={FRAMES_ESSENTIAL_ROWS}
      lead={<RotationMatrix pose={pose} t={t} />}
    />
  );
}

/**
 * The pose panel: `x, y, θ`, `v, ω, R` and the wheel commands, plus the matrix `R(θ)` and the
 * global sensor coordinates when `show` includes `frames` (#92, decision 6). The initial
 * orientation `θ₀` is a slider of the controls, because the scene only drags `x, y` (#371).
 */
export function PosePanel({
  mode,
  readout,
  spec,
  withFrames,
  extraRows,
  children,
  t,
}: PosePanelProps): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <ReadoutPanel
        title={t('widgets.DiffDriveWidget.panel')}
        rows={posePanelRows(mode, readout, spec, extraRows, t)}
        visibleRows={POSE_ESSENTIAL_ROWS + extraRows.length}
      />
      {children}
      {withFrames ? <FramesPanel pose={readout.pose} spec={spec} t={t} /> : null}
    </div>
  );
}
