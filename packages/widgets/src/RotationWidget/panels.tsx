import type { JSX } from 'react';
import type { Translate } from '@trayectoria/i18n';

import { ParamPanel } from '../ParamPanel/ParamPanel';
import type { ParamPanelParam } from '../ParamPanel/ParamPanel';
import { ReadoutPanel } from '../shared/ReadoutPanel';
import { omegaFor, radpsToRpm, rimSpeed, rpmToRadps } from './compute';
import type { Curve, Rotation, RotationInputUnit, RotationMode } from './compute';
import { CurveScene, slips } from './curveScene';
import { curveRows, panelRows } from './rows';

export { TARGET_RPM, curveRows, panelRows, statusOf } from './rows';

/** Which value of the rotation a slider edits (#89, decisions 4 and 6). */
export type RotationParam = 'omega' | 'r' | 'alpha' | 'v';

/** Slider ranges of decision 4 of #89; `ω` takes the range of the unit it is edited in. */
const RANGES: Readonly<Record<RotationParam, { min: number; max: number; step: number }>> = {
  omega: { min: 0, max: 600, step: 1 },
  r: { min: 0.015, max: 0.1, step: 0.001 },
  alpha: { min: 0, max: 100, step: 0.01 },
  v: { min: 0.1, max: 2, step: 0.01 },
};

/** Range of `ω` when it is edited in rad/s: the same physical span, [0, 62.83] (decision 4). */
const OMEGA_RADPS_RANGE = { min: 0, max: Number(rpmToRadps(600).toFixed(2)), step: 0.01 };

/** Values the learner may edit in each mode (#89, decisions 4, 6 and 7). */
const EDITABLE: Readonly<Record<RotationMode, readonly RotationParam[]>> = {
  disc: ['omega', 'r'],
  rolling: ['omega', 'r', 'v'],
  angularAccel: ['omega', 'r', 'alpha'],
};

/** The `ω` slider, in the unit the learner chose, with the range of that unit (decision 4). */
function omegaParam(
  rotation: Rotation,
  inputUnit: RotationInputUnit,
  t: Translate,
): ParamPanelParam {
  const inRpm = inputUnit === 'rpm';
  const value = inRpm ? radpsToRpm(rotation.omega_radps) : rotation.omega_radps;
  return {
    key: 'omega',
    label: t('widgets.RotationWidget.paramOmega'),
    unit: t(inRpm ? 'widgets.RotationWidget.unitRpm' : 'widgets.RotationWidget.unitRadps'),
    value: Number(value.toFixed(inRpm ? 0 : 2)),
    ...(inRpm ? RANGES.omega : OMEGA_RADPS_RANGE),
  };
}

/** The sliders of the mode, with `ω` in the unit the learner chose (#89, decision 4). */
export function paramsOf(
  mode: RotationMode,
  rotation: Rotation,
  inputUnit: RotationInputUnit,
  t: Translate,
): readonly ParamPanelParam[] {
  const values: Record<RotationParam, ParamPanelParam> = {
    omega: omegaParam(rotation, inputUnit, t),
    r: {
      key: 'r',
      label: t('widgets.RotationWidget.paramR'),
      unit: t('widgets.RotationWidget.unitM'),
      value: rotation.r_m,
      ...RANGES.r,
    },
    alpha: {
      key: 'alpha',
      label: t('widgets.RotationWidget.paramAlpha'),
      unit: t('widgets.RotationWidget.unitRadps2'),
      value: rotation.alpha_radps2,
      ...RANGES.alpha,
    },
    v: {
      key: 'v',
      label: t('widgets.RotationWidget.paramV'),
      unit: t('widgets.RotationWidget.unitMps'),
      value: Number(rimSpeed(rotation.omega_radps, rotation.r_m).toFixed(2)),
      ...RANGES.v,
    },
  };
  return EDITABLE[mode].map((key) => values[key]);
}

/**
 * Applies one slider change. `ω` arrives in the unit of the panel; editing `v` sets
 * `ω = v/r`, the two-way link of decision 6 of #89.
 */
export function applyChange(
  rotation: Rotation,
  key: string,
  value: number,
  inputUnit: RotationInputUnit,
): Rotation {
  if (key === 'omega') {
    return { ...rotation, omega_radps: inputUnit === 'rpm' ? rpmToRadps(value) : value };
  }
  if (key === 'r') return { ...rotation, r_m: value };
  if (key === 'alpha') return { ...rotation, alpha_radps2: value };
  if (key === 'v') return { ...rotation, omega_radps: omegaFor(value, rotation.r_m) };
  return rotation;
}

/** Slider ranges of the curve panel of `angularAccel` (#89, decision 7). */
const CURVE_RANGES = {
  radius: { min: 0.1, max: 2, step: 0.01 },
  vCurve: { min: 0.2, max: 1.5, step: 0.01 },
  mu: { min: 0.1, max: 1, step: 0.01 },
} as const;

/** The three sliders of the curve panel: `R`, `v` and `μs` (#89, decision 7). */
export function curveParamsOf(curve: Curve, t: Translate): readonly ParamPanelParam[] {
  const params: readonly ParamPanelParam[] = [
    {
      key: 'radius',
      label: t('widgets.RotationWidget.paramCurveRadius'),
      unit: t('widgets.RotationWidget.unitM'),
      value: curve.radius_m,
      ...CURVE_RANGES.radius,
    },
    {
      key: 'vCurve',
      label: t('widgets.RotationWidget.paramCurveV'),
      unit: t('widgets.RotationWidget.unitMps'),
      value: curve.v_mps,
      ...CURVE_RANGES.vCurve,
    },
    {
      key: 'mu',
      label: t('widgets.RotationWidget.paramMu'),
      unit: '',
      value: curve.mu_s,
      ...CURVE_RANGES.mu,
    },
  ];
  return params;
}

/** Applies one slider change of the curve panel (#89, decision 7). */
export function applyCurveChange(curve: Curve, key: string, value: number): Curve {
  if (key === 'radius') return { ...curve, radius_m: value };
  if (key === 'vCurve') return { ...curve, v_mps: value };
  if (key === 'mu') return { ...curve, mu_s: value };
  return curve;
}

/** The values panel of the mode. */
export function ResultsPanel({
  mode,
  rotation,
  t_s,
  t,
}: {
  mode: RotationMode;
  rotation: Rotation;
  t_s: number;
  t: Translate;
}): JSX.Element {
  return (
    <ReadoutPanel
      title={t('widgets.RotationWidget.panel')}
      rows={panelRows(mode, rotation, t_s, t)}
    />
  );
}

/**
 * The curve panel of `angularAccel` (docs/WIDGETS.md, RotationWidget; DESIGN §6, point 3): from
 * the breakpoint of the widget, a row with the animated view on the left (at most 50 vh high,
 * like the main viewer) and its two values on the right (`w-panel`), then its three sliders in
 * one column of a 2 column grid. On mobile, one column: legend, view, values and sliders.
 */
export function CurvePanel({
  curve,
  t_s,
  onChange,
  t,
}: {
  curve: Curve;
  t_s: number;
  onChange: (key: string, value: number) => void;
  t: Translate;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-4" data-curve-panel="">
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 flex-col gap-2 lg:mx-auto lg:w-full lg:max-w-[calc(50vh*16/9)]">
          <div className="flex flex-col gap-1 font-mono text-xs tracking-[0.06em]">
            <p className="text-fg-muted uppercase">{t('widgets.RotationWidget.curveLegend')}</p>
            {slips(curve) ? (
              <p className="text-error" role="status">
                {t('widgets.RotationWidget.slipWarning')}
              </p>
            ) : null}
          </div>
          <CurveScene curve={curve} t_s={t_s} t={t} />
        </div>
        <div className="lg:w-panel">
          <ReadoutPanel title={t('widgets.RotationWidget.curvePanel')} rows={curveRows(curve, t)} />
        </div>
      </div>
      <div className="lg:grid lg:grid-cols-2 lg:gap-4">
        <ParamPanel params={curveParamsOf(curve, t)} onChange={onChange} />
      </div>
    </div>
  );
}
