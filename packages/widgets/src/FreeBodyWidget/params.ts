import { degToRad, radToDeg } from '@trayectoria/sim-core';
import type { Translate } from '@trayectoria/i18n';

import type { ParamPanelParam } from '../ParamPanel/ParamPanel';

/** A parameter of the body the topic may open to a slider (#305). */
export type BodyParam = 'mass' | 'slope' | 'mu_s';

/** Mass, slope and `μs` of the body; `mu_s` is null while the friction model is off. */
export interface Body {
  mass_kg: number;
  slope_rad: number;
  mu_s: number | null;
}

/** Slider ranges of #305; `φ` is edited in degrees. */
const BODY_RANGES = {
  mass: { min: 0.2, max: 3, step: 0.01 },
  slope: { min: 0, max: 45, step: 1 },
  mu_s: { min: 0.1, max: 1, step: 0.01 },
} as const;

/** One slider of the body, in the fixed order mass, slope, `μs`. */
function paramOf(param: BodyParam, body: Body, t: Translate): ParamPanelParam | null {
  if (param === 'mass') {
    const unit = t('widgets.FreeBodyWidget.unitKg');
    const label = t('widgets.FreeBodyWidget.mass');
    return { key: param, label, unit, value: body.mass_kg, ...BODY_RANGES.mass };
  }
  if (param === 'slope') {
    const value = Number(radToDeg(body.slope_rad).toFixed(0));
    const unit = t('widgets.FreeBodyWidget.unitDeg');
    const label = t('widgets.FreeBodyWidget.slope');
    return { key: param, label, unit, value, ...BODY_RANGES.slope };
  }
  // `μs` only has a slider while the friction model is on.
  if (body.mu_s === null) return null;
  const label = t('widgets.FreeBodyWidget.muS');
  return { key: param, label, unit: '', value: body.mu_s, ...BODY_RANGES.mu_s };
}

/** The sliders of the body listed in `editableParams`, in the fixed order of #305. */
export function bodyParamsOf(
  editable: readonly BodyParam[],
  body: Body,
  t: Translate,
): readonly ParamPanelParam[] {
  return (['mass', 'slope', 'mu_s'] as const)
    .filter((param) => editable.includes(param))
    .map((param) => paramOf(param, body, t))
    .filter((param): param is ParamPanelParam => param !== null);
}

/** Whether a slider key belongs to the body rather than to a force. */
export function isBodyParam(key: string): key is BodyParam {
  return key === 'mass' || key === 'slope' || key === 'mu_s';
}

/** Applies one slider change of the body; `φ` arrives in degrees. */
export function applyBodyChange(body: Body, key: BodyParam, value: number): Body {
  if (key === 'mass') return { ...body, mass_kg: value };
  if (key === 'slope') return { ...body, slope_rad: degToRad(value) };
  return { ...body, mu_s: value };
}
