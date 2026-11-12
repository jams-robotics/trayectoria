/**
 * The values panel, the sliders and the `aria-live` sentence of `MotorCurveWidget`
 * (docs/WIDGETS.md, MotorCurveWidget). Every number comes from `compute.ts` and is formatted
 * here with `format` of `sim-core`, as GearWidget does (#611).
 */
import { format, rpmToRadps } from '@trayectoria/sim-core';
import type { Translate } from '@trayectoria/i18n';

import { format as formatControl } from '../ParamPanel/ParamPanel';
import type { ParamPanelParam } from '../ParamPanel/ParamPanel';
import type { ReadoutRow } from '../shared/ReadoutPanel';
import {
  clampSpeed_rpm,
  currentAt_A,
  electricalPowerAt_W,
  maxPower_W,
  motorEfficiency,
  powerAt_W,
  torqueAt_Nm,
} from './compute';
import type { Motor, MotorElectrical } from './compute';

/** Below this share of its scale a reading is zero for the learner, not a power of ten (v1.5). */
const NEGLIGIBLE_SHARE = 1e-3;

/**
 * `format` for the panel: a value that is a thousandth of its scale or less reads as zero, and
 * one too small for plain `format` is written in decimals, so the panel never shows
 * «2.00e-6 N·m» near `n₀` (v1.5).
 */
function reading(value: number, scale: number, unit: string): string {
  if (Math.abs(value) < Math.abs(scale) * NEGLIGIBLE_SHARE) return format(0, unit);
  if (value !== 0 && Math.abs(value) < PLAIN_MIN) {
    const text = String(Number(value.toPrecision(3)));
    return unit === '' ? text : `${text} ${unit}`;
  }
  return format(value, unit);
}

/** Smallest magnitude `format` still writes in plain decimals. */
const PLAIN_MIN = 1e-3;

/** The speed as the «Velocidad» control writes it, so panel and control show the same number. */
function speedReading(speed_rpm: number, t: Translate): string {
  return `${formatControl(speed_rpm)} ${t('widgets.MotorCurveWidget.unitRpm')}`;
}

/** What the sliders edit: the working point and, when `editable` lists them, the line. */
export interface MotorState {
  motor: Motor;
  speed_rpm: number;
}

/** The parameters of the line a topic may open to the learner (docs/WIDGETS.md). */
export type MotorCurveEditable = 'stallTorque_Nm' | 'noLoadSpeed_rpm';

/** Key of the working point slider; the other keys are the `MotorCurveEditable` names. */
export const SPEED_KEY = 'speed_rpm';

/** Slider ranges of docs/WIDGETS.md, MotorCurveWidget; the steps follow GearWidget (#611). */
const RANGES: Readonly<Record<MotorCurveEditable, { min: number; max: number; step: number }>> = {
  stallTorque_Nm: { min: 0.001, max: 0.2, step: 0.001 },
  noLoadSpeed_rpm: { min: 500, max: 20000, step: 10 },
};

const LABEL_KEYS: Readonly<Record<MotorCurveEditable, string>> = {
  stallTorque_Nm: 'widgets.MotorCurveWidget.paramStallTorque',
  noLoadSpeed_rpm: 'widgets.MotorCurveWidget.paramNoLoadSpeed',
};

const UNIT_KEYS: Readonly<Record<MotorCurveEditable, string>> = {
  stallTorque_Nm: 'widgets.MotorCurveWidget.unitNm',
  noLoadSpeed_rpm: 'widgets.MotorCurveWidget.unitRpm',
};

/** The rows that only exist with currents and a supply: `I`, `V I` and `η_motor`. */
function electricalRows(
  { motor, speed_rpm }: MotorState,
  electrical: MotorElectrical,
  t: Translate,
): readonly ReadoutRow[] {
  return [
    [
      t('widgets.MotorCurveWidget.current'),
      reading(
        currentAt_A(motor, electrical, speed_rpm),
        electrical.stallCurrent_A,
        t('widgets.MotorCurveWidget.unitA'),
      ),
    ],
    [
      t('widgets.MotorCurveWidget.electricalPower'),
      reading(
        electricalPowerAt_W(motor, electrical, speed_rpm),
        electrical.voltage_V * electrical.stallCurrent_A,
        t('widgets.MotorCurveWidget.unitW'),
      ),
    ],
    [
      t('widgets.MotorCurveWidget.efficiency'),
      reading(motorEfficiency(motor, electrical, speed_rpm), 1, ''),
    ],
  ];
}

/** The lines of the values panel; `ω` goes last so the electrical lines stay in view (v1.5). */
export function panelRows(
  state: MotorState,
  electrical: MotorElectrical | undefined,
  t: Translate,
): readonly ReadoutRow[] {
  const { motor, speed_rpm } = state;
  return [
    [t('widgets.MotorCurveWidget.speed'), speedReading(speed_rpm, t)],
    [
      t('widgets.MotorCurveWidget.torque'),
      reading(
        torqueAt_Nm(motor, speed_rpm),
        motor.stallTorque_Nm,
        t('widgets.MotorCurveWidget.unitNm'),
      ),
    ],
    [
      t('widgets.MotorCurveWidget.power'),
      reading(powerAt_W(motor, speed_rpm), maxPower_W(motor), t('widgets.MotorCurveWidget.unitW')),
    ],
    ...(electrical === undefined ? [] : electricalRows(state, electrical, t)),
    [
      t('widgets.MotorCurveWidget.omega'),
      format(rpmToRadps(speed_rpm), t('widgets.MotorCurveWidget.unitRadps')),
    ],
  ];
}

/** The «Velocidad» slider first, then the sliders of `editable` in the order given. */
export function paramsOf(
  { motor, speed_rpm }: MotorState,
  editable: readonly MotorCurveEditable[],
  t: Translate,
): readonly ParamPanelParam[] {
  const speed: ParamPanelParam = {
    key: SPEED_KEY,
    label: t('widgets.MotorCurveWidget.paramSpeed'),
    unit: t('widgets.MotorCurveWidget.unitRpm'),
    min: 0,
    max: motor.noLoadSpeed_rpm,
    step: 1,
    value: speed_rpm,
  };
  return [
    speed,
    ...editable.map((key) => ({
      key,
      label: t(LABEL_KEYS[key]),
      unit: t(UNIT_KEYS[key]),
      value: motor[key],
      ...RANGES[key],
    })),
  ];
}

/**
 * Applies one slider change. A new `n₀` below the working point pulls the point back to `n₀`
 * (#611); the speed is always kept on the line.
 */
export function applyChange(state: MotorState, key: string, value: number): MotorState {
  if (key === SPEED_KEY) {
    return { ...state, speed_rpm: clampSpeed_rpm(state.motor, value) };
  }
  if (key === 'stallTorque_Nm') {
    return { ...state, motor: { ...state.motor, stallTorque_Nm: value } };
  }
  if (key === 'noLoadSpeed_rpm') {
    const motor: Motor = { ...state.motor, noLoadSpeed_rpm: value };
    return { motor, speed_rpm: clampSpeed_rpm(motor, state.speed_rpm) };
  }
  return state;
}

/** The label of the `P_max` reference line of the power chart. */
export function maxPowerLabel(motor: Motor, t: Translate): string {
  return t('widgets.MotorCurveWidget.maxPowerLabel', {
    value: format(maxPower_W(motor), t('widgets.MotorCurveWidget.unitW')),
  });
}

/** «A n rpm el motor da τ y P», plus «con I» with currents (docs/WIDGETS.md). */
export function statusOf(
  { motor, speed_rpm }: MotorState,
  electrical: MotorElectrical | undefined,
  t: Translate,
): string {
  const values = {
    speed: speedReading(speed_rpm, t),
    torque: reading(
      torqueAt_Nm(motor, speed_rpm),
      motor.stallTorque_Nm,
      t('widgets.MotorCurveWidget.unitNm'),
    ),
    power: reading(
      powerAt_W(motor, speed_rpm),
      maxPower_W(motor),
      t('widgets.MotorCurveWidget.unitW'),
    ),
  };
  if (electrical === undefined) return t('widgets.MotorCurveWidget.status', values);
  return t('widgets.MotorCurveWidget.statusCurrent', {
    ...values,
    current: reading(
      currentAt_A(motor, electrical, speed_rpm),
      electrical.stallCurrent_A,
      t('widgets.MotorCurveWidget.unitA'),
    ),
  });
}
