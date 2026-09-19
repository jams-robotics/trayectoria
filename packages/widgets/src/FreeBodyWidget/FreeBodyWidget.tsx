import { useMemo, useState } from 'react';
import type { JSX } from 'react';
import { degToRad, format, radToDeg, rotate2 } from '@trayectoria/sim-core';
import type { Vec2 } from '@trayectoria/sim-core';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

import { ParamPanel } from '../ParamPanel/ParamPanel';
import type { ParamPanelParam } from '../ParamPanel/ParamPanel';
import { Scene2D } from '../Scene2D/Scene2D';
import { Rect } from '../Scene2D/primitives/Rect';
import { Vector } from '../Scene2D/primitives/Vector';
import { LiveStatus, ReadoutPanel } from '../shared/ReadoutPanel';
import { NORMAL_KEY, WEIGHT_KEY, readFreeBody } from './compute';
import type { ForceInput, FreeBodyReadout, ResolvedForce } from './compute';

export interface FreeBodyWidgetProps {
  mass_kg: number;
  forces: Array<ForceInput>;
  /** Inclination of the surface, in radians. Defaults to a flat plane. */
  slope_rad?: number;
  /** Draws the resultant and shows its magnitude and angle. Defaults to false. */
  showResultant?: boolean;
}

/** Width of the view, in metres of the scene; the diagram is drawn at this scale. */
const VIEW_WIDTH_M = 1.2;
/** Size of the body drawn at the origin, in metres of the scene. */
const BODY_WIDTH_M = 0.26;
const BODY_HEIGHT_M = 0.16;
/** Length of the ramp segment, in metres of the scene. */
const RAMP_LENGTH_M = 1.1;
/** Thickness of the ramp segment, in metres of the scene. */
const RAMP_THICKNESS_M = 0.05;
/** Scene metres per newton, so the weight of a ~1 kg body still fits in the view. */
const M_PER_N = 0.045;
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

/** The arrows of the diagram, drawn in world components over the inclined surface. */
function ForceArrows({
  forces,
  slope_rad,
  t,
}: {
  forces: readonly ResolvedForce[];
  slope_rad: number;
  t: Translate;
}): JSX.Element {
  return (
    <>
      {forces.map((force) => {
        const world = rotate2(force.components_N, slope_rad);
        return (
          <Vector
            key={force.key}
            to_m={[world[0] * M_PER_N, world[1] * M_PER_N]}
            color={colorOf(force)}
            label={labelOf(force, t)}
          />
        );
      })}
    </>
  );
}

/** The lines of the panel: weight, normal and, with `showResultant`, `|R|`, its angle and `a`. */
function panelRows(
  readout: FreeBodyReadout,
  mass_kg: number,
  showResultant: boolean,
  t: Translate,
): ReadonlyArray<readonly [string, string]> {
  const unit_N = t('widgets.FreeBodyWidget.unitN');
  const rows: Array<readonly [string, string]> = [
    [t('widgets.FreeBodyWidget.mass'), format(mass_kg, t('widgets.FreeBodyWidget.unitKg'))],
    [t('widgets.FreeBodyWidget.weight'), format(readout.weight_N, unit_N)],
    [t('widgets.FreeBodyWidget.weightAlong'), format(readout.weightAlong_N, unit_N)],
    [t('widgets.FreeBodyWidget.normal'), format(readout.normal_N, unit_N)],
  ];
  if (!showResultant) return rows;
  rows.push(
    [t('widgets.FreeBodyWidget.resultant'), format(readout.resultantMagnitude_N, unit_N)],
    [
      t('widgets.FreeBodyWidget.resultantAngle'),
      t('widgets.FreeBodyWidget.degrees', {
        value: readout.resultantAngle_deg.toFixed(ANGLE_DECIMALS),
      }),
    ],
    [
      t('widgets.FreeBodyWidget.accel'),
      format(readout.accel_mps2, t('widgets.FreeBodyWidget.unitMps2')),
    ],
  );
  return rows;
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

/** One sentence with the resultant and the acceleration, for the `aria-live` region. */
function statusOf(readout: FreeBodyReadout, t: Translate): string {
  return t('widgets.FreeBodyWidget.status', {
    magnitude: format(readout.resultantMagnitude_N, t('widgets.FreeBodyWidget.unitN')),
    angle: readout.resultantAngle_deg.toFixed(ANGLE_DECIMALS),
    accel: format(readout.accel_mps2, t('widgets.FreeBodyWidget.unitMps2')),
  });
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
  const resultantWorld: Vec2 = rotate2(readout.resultant_N, slope_rad);
  return (
    <Scene2D
      worldWidth_m={VIEW_WIDTH_M}
      aspect={1.4}
      description={t('widgets.FreeBodyWidget.scene')}
    >
      <Surface slope_rad={slope_rad} />
      <ForceArrows forces={readout.forces} slope_rad={slope_rad} t={t} />
      {showResultant ? (
        <Vector
          to_m={[resultantWorld[0] * M_PER_N, resultantWorld[1] * M_PER_N]}
          color="color-data-4"
          label={t('widgets.FreeBodyWidget.resultantLabel')}
        />
      ) : null}
    </Scene2D>
  );
}

/**
 * Free-body diagram of a body on a plane or a ramp (docs/WIDGETS.md, FreeBodyWidget;
 * docs/CURRICULUM.md T-2.1). Weight and normal come from `mass_kg` and `slope_rad` and are not
 * editable; the forces marked `editable` are adjusted with `ParamPanel` (#86, decision 5). Every
 * number comes from `compute.ts`, which delegates to `vec2` and `G_MPS2` of sim-core.
 */
export function FreeBodyWidget({
  mass_kg,
  forces: initialForces,
  slope_rad = 0,
  showResultant = false,
}: FreeBodyWidgetProps): JSX.Element {
  const t = useT();
  const [forces, setForces] = useState<readonly ForceInput[]>(initialForces);
  const readout = useMemo(
    () => readFreeBody(mass_kg, forces, slope_rad),
    [mass_kg, forces, slope_rad],
  );
  const params = paramsOf(forces, t);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">
          <Diagram readout={readout} slope_rad={slope_rad} showResultant={showResultant} t={t} />
        </div>
        <div className="md:w-72">
          <ReadoutPanel
            title={t('widgets.FreeBodyWidget.panel')}
            rows={panelRows(readout, mass_kg, showResultant, t)}
          />
          <LiveStatus text={statusOf(readout, t)} />
        </div>
      </div>
      {params.length === 0 ? null : (
        <ParamPanel
          params={params}
          onChange={(key, value) => {
            setForces((current) => applyChange(current, key, value));
          }}
        />
      )}
    </div>
  );
}
