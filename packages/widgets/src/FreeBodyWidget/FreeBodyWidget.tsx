import { useMemo, useState } from 'react';
import type { JSX } from 'react';
import { degToRad, radToDeg, rotate2 } from '@trayectoria/sim-core';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

import { ParamPanel } from '../ParamPanel/ParamPanel';
import type { ParamPanelParam } from '../ParamPanel/ParamPanel';
import { Scene2D } from '../Scene2D/Scene2D';
import { Rect } from '../Scene2D/primitives/Rect';
import { Vector } from '../Scene2D/primitives/Vector';
import { SimLayout } from '../shared/SimLayout';
import { NORMAL_KEY, WEIGHT_KEY, readFreeBody } from './compute';
import type { ForceInput, FreeBodyReadout, ResolvedForce } from './compute';
import { applyBodyChange, bodyParamsOf, isBodyParam } from './params';
import type { Body, BodyParam } from './params';
import { Values } from './panels';
import { ArrowLabels } from './labels';
import type { ArrowLabel } from './labels';
import { VIEW_ASPECT, VIEW_WIDTH_M, arrowTips_m } from './layout';

export interface FreeBodyWidgetProps {
  mass_kg: number;
  forces: Array<ForceInput>;
  /** Inclination of the surface, in radians. Defaults to a flat plane. */
  slope_rad?: number;
  /** Draws the resultant and shows its magnitude and angle. Defaults to false. */
  showResultant?: boolean;
  /** Static friction coefficient of the wheels; turns on the friction model (#305). */
  mu_s?: number;
  /** Body parameters opened to a slider: mass, slope and `μs` (#305). */
  editableParams?: Array<BodyParam>;
}

/** Size of the body drawn at the origin, in metres of the scene. */
const BODY_WIDTH_M = 0.26;
const BODY_HEIGHT_M = 0.16;
/** Length of the ramp segment, in metres of the scene. */
const RAMP_LENGTH_M = 1.1;
/** Thickness of the ramp segment, in metres of the scene. */
const RAMP_THICKNESS_M = 0.05;
/** Decimals of an angle in degrees (#86, decision 6). */
const ANGLE_DECIMALS = 2;
/** Range and step of the magnitude sliders, in newtons. */
const MAGNITUDE_RANGE_N = { min: 0, max: 10, step: 0.1 };
/** Range and step of the angle sliders, in degrees. */
const ANGLE_RANGE_DEG = { min: -180, max: 180, step: 1 };

/** Palette token of each force, so the same quantity keeps its colour (docs/DESIGN.md §2.2). */
function colorOf(force: ResolvedForce): string {
  if (force.key === WEIGHT_KEY) return 'color-data-1';
  if (force.key === NORMAL_KEY) return 'color-data-3';
  return 'color-vector-force';
}

/** Translated name of a force: a derived one takes its name from its reserved key. */
function labelOf(force: ResolvedForce, t: Translate): string {
  return force.derived ? t(`widgets.FreeBodyWidget.${force.key}`) : force.label;
}

/** Palette token of the resultant arrow. */
const RESULTANT_COLOR = 'color-data-4';

/**
 * The arrows of the diagram, drawn in world components over the inclined surface, and their
 * labels, painted after them inside the view (#347). The resultant, when shown, goes last.
 */
function Arrows({
  readout,
  slope_rad,
  showResultant,
  t,
}: {
  readout: FreeBodyReadout;
  slope_rad: number;
  showResultant: boolean;
  t: Translate;
}): JSX.Element {
  const labels = useMemo<ArrowLabel[]>(() => {
    const tips = arrowTips_m(readout, slope_rad, showResultant);
    const named = readout.forces.map((force) => ({
      text: labelOf(force, t),
      color: colorOf(force),
    }));
    if (showResultant) {
      named.push({ text: t('widgets.FreeBodyWidget.resultantLabel'), color: RESULTANT_COLOR });
    }
    return named.map((label, index) => ({ ...label, tip_m: tips[index] ?? [0, 0] }));
  }, [readout, slope_rad, showResultant, t]);
  return (
    <>
      {labels.map((label, index) => (
        <Vector key={index} to_m={[label.tip_m[0], label.tip_m[1]]} color={label.color} />
      ))}
      <ArrowLabels labels={labels} />
    </>
  );
}

/** Two sliders per editable force: its magnitude in newtons and its angle in degrees. */
function paramsOf(forces: readonly ForceInput[], t: Translate): readonly ParamPanelParam[] {
  return forces
    .filter((force) => force.editable === true)
    .flatMap((force) => [
      {
        key: `${force.key}:magnitude`,
        label: t('widgets.FreeBodyWidget.magnitudeOf', { name: force.label }),
        unit: t('widgets.FreeBodyWidget.unitN'),
        ...MAGNITUDE_RANGE_N,
        value: force.magnitude_N,
      },
      {
        key: `${force.key}:angle`,
        label: t('widgets.FreeBodyWidget.angleOf', { name: force.label }),
        unit: t('widgets.FreeBodyWidget.unitDeg'),
        ...ANGLE_RANGE_DEG,
        value: Number(radToDeg(force.angle_rad).toFixed(ANGLE_DECIMALS)),
      },
    ]);
}

/** Applies one slider change to the matching force; the angle arrives in degrees. */
function applyChange(
  forces: readonly ForceInput[],
  key: string,
  value: number,
): readonly ForceInput[] {
  const [forceKey, field] = key.split(':');
  return forces.map((force) => {
    if (force.key !== forceKey) return force;
    return field === 'angle'
      ? { ...force, angle_rad: degToRad(value) }
      : { ...force, magnitude_N: value };
  });
}

/** The ramp under the body and the body itself, both rotated with the surface. */
function Surface({ slope_rad }: { slope_rad: number }): JSX.Element {
  const rampCentre = rotate2([0, -(BODY_HEIGHT_M + RAMP_THICKNESS_M) / 2], slope_rad);
  return (
    <>
      <Rect
        center_m={[rampCentre[0], rampCentre[1]]}
        width_m={RAMP_LENGTH_M}
        height_m={RAMP_THICKNESS_M}
        angle_rad={slope_rad}
        color="color-border"
        filled
      />
      <Rect
        center_m={[0, 0]}
        width_m={BODY_WIDTH_M}
        height_m={BODY_HEIGHT_M}
        angle_rad={slope_rad}
        color="color-physical"
        filled
      />
    </>
  );
}

/** The whole scene: the ramp, the body, one arrow per force and, optionally, the resultant. */
function Diagram({
  readout,
  slope_rad,
  showResultant,
  t,
}: {
  readout: FreeBodyReadout;
  slope_rad: number;
  showResultant: boolean;
  t: Translate;
}): JSX.Element {
  return (
    <Scene2D
      worldWidth_m={VIEW_WIDTH_M}
      aspect={VIEW_ASPECT}
      description={t('widgets.FreeBodyWidget.scene')}
    >
      <Surface slope_rad={slope_rad} />
      <Arrows readout={readout} slope_rad={slope_rad} showResultant={showResultant} t={t} />
    </Scene2D>
  );
}

/** The forces and the body, each edited by its own sliders of the shared `ParamPanel`. */
function useEditable(
  initialForces: readonly ForceInput[],
  initialBody: Body,
): { forces: readonly ForceInput[]; body: Body; onChange: (key: string, value: number) => void } {
  const [forces, setForces] = useState(initialForces);
  const [body, setBody] = useState(initialBody);
  const onChange = (key: string, value: number): void => {
    if (isBodyParam(key)) setBody((current) => applyBodyChange(current, key, value));
    else setForces((current) => applyChange(current, key, value));
  };
  return { forces, body, onChange };
}

/**
 * Free-body diagram of a body on a plane or a ramp (docs/WIDGETS.md, FreeBodyWidget;
 * docs/CURRICULUM.md T-2.1). Weight and normal come from `mass_kg` and `slope_rad` and are not
 * editable; the forces marked `editable` are adjusted with `ParamPanel` (#86, decision 5). With
 * `mu_s` the wheels have static friction and a «desliza» notice; `editableParams` opens mass,
 * slope and `μs` to sliders (#305). Every number comes from `compute.ts`, which delegates to
 * `vec2` and `G_MPS2` of sim-core.
 */
export function FreeBodyWidget({
  mass_kg,
  forces: initialForces,
  slope_rad = 0,
  showResultant = false,
  mu_s,
  editableParams = [],
}: FreeBodyWidgetProps): JSX.Element {
  const t = useT();
  const { forces, body, onChange } = useEditable(initialForces, {
    mass_kg,
    slope_rad,
    mu_s: mu_s ?? null,
  });
  const readout = useMemo(
    () => readFreeBody(body.mass_kg, forces, body.slope_rad, body.mu_s ?? undefined),
    [body, forces],
  );
  const params = [...bodyParamsOf(editableParams, body, t), ...paramsOf(forces, t)];

  return (
    <SimLayout
      from="md"
      viewer={
        <Diagram readout={readout} slope_rad={body.slope_rad} showResultant={showResultant} t={t} />
      }
      values={
        <Values readout={readout} mass_kg={body.mass_kg} showResultant={showResultant} t={t} />
      }
      params={params.length === 0 ? null : <ParamPanel params={params} onChange={onChange} />}
    />
  );
}
