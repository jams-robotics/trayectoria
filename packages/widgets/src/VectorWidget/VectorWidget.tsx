import { useMemo, useState } from 'react';
import type { JSX } from 'react';
import { format } from '@trayectoria/sim-core';
import type { Vec2 } from '@trayectoria/sim-core';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

import { Scene2D } from '../Scene2D/Scene2D';
import { Axes } from '../Scene2D/primitives/Axes';
import { Grid } from '../Scene2D/primitives/Grid';
import { Vector } from '../Scene2D/primitives/Vector';
import { createTransform } from '../Scene2D/transform';
import type { Transform } from '../Scene2D/transform';
import { DragHandle, SceneOverlay } from '../shared/SceneOverlay';
import { LiveStatus, ReadoutPanel } from '../shared/ReadoutPanel';
import { VIEW_ASPECT, VIEW_CENTER, readVectors, viewWidth } from './compute';
import type { Polar, VectorReadout } from './compute';

/** What the panel may show, as docs/WIDGETS.md declares it. */
export type VectorShow = 'sum' | 'components' | 'dot' | 'angle';

export interface VectorWidgetProps {
  initialA: [number, number];
  initialB?: [number, number];
  show: Array<VectorShow>;
  /** Unit of the components, for display: `m/s`, `m`… */
  unit: string;
}

/** Decimals of an angle in degrees (#86, decision 6). */
const ANGLE_DECIMALS = 2;

interface RowContext {
  show: readonly VectorShow[];
  unit: string;
  t: Translate;
}

/** The three lines a single vector contributes to the panel, per `show`. */
function vectorRows(
  name: string,
  polar: Polar,
  components: Vec2,
  { show, unit, t }: RowContext,
): ReadonlyArray<readonly [string, string]> {
  const angle = t('widgets.VectorWidget.degrees', {
    value: polar.angle_deg.toFixed(ANGLE_DECIMALS),
  });
  const rows: Array<readonly [string, string]> = [];
  if (show.includes('components')) {
    rows.push([
      t('widgets.VectorWidget.components', { name }),
      t('widgets.VectorWidget.pair', {
        x: format(components[0], unit),
        y: format(components[1], unit),
      }),
    ]);
  }
  rows.push([t('widgets.VectorWidget.magnitude', { name }), format(polar.magnitude, unit)]);
  if (show.includes('angle')) rows.push([t('widgets.VectorWidget.angle', { name }), angle]);
  return rows;
}

/** Every line of the panel: the two vectors, then the sum, the dot product and the angle. */
function panelRows(
  readout: VectorReadout,
  a: Vec2,
  b: Vec2,
  context: RowContext,
): ReadonlyArray<readonly [string, string]> {
  const { show, unit, t } = context;
  const rows = [
    ...vectorRows(t('widgets.VectorWidget.nameA'), readout.a, a, context),
    ...vectorRows(t('widgets.VectorWidget.nameB'), readout.b, b, context),
  ];
  if (show.includes('sum')) {
    rows.push(
      ...vectorRows(t('widgets.VectorWidget.nameSum'), readout.sum, readout.sum_components, context),
    );
  }
  if (show.includes('dot')) {
    rows.push([
      t('widgets.VectorWidget.dot'),
      format(readout.dot, t('widgets.VectorWidget.squareUnit', { unit })),
    ]);
  }
  if (show.includes('angle')) {
    rows.push([
      t('widgets.VectorWidget.between'),
      t('widgets.VectorWidget.degrees', { value: readout.between_deg.toFixed(ANGLE_DECIMALS) }),
    ]);
  }
  return rows;
}

/** The arrows of the scene: a, b and, with `sum`, the parallelogram rule and the sum itself. */
function Arrows({
  a,
  b,
  sum,
  withSum,
  t,
}: {
  a: Vec2;
  b: Vec2;
  sum: Vec2;
  withSum: boolean;
  t: Translate;
}): JSX.Element {
  return (
    <>
      <Vector to_m={[a[0], a[1]]} color="color-data-1" label={t('widgets.VectorWidget.nameA')} />
      <Vector to_m={[b[0], b[1]]} color="color-data-2" label={t('widgets.VectorWidget.nameB')} />
      {withSum ? (
        <>
          {/* The parallelogram rule: each vector translated to the tip of the other. */}
          <Vector from_m={[a[0], a[1]]} to_m={[sum[0], sum[1]]} color="color-border" />
          <Vector from_m={[b[0], b[1]]} to_m={[sum[0], sum[1]]} color="color-border" />
          <Vector
            to_m={[sum[0], sum[1]]}
            color="color-data-3"
            label={t('widgets.VectorWidget.nameSum')}
          />
        </>
      ) : null}
    </>
  );
}

/**
 * The mapping of the current view for the handles. The overlay re-reads the mapping of the scene
 * only when it is resized, so once the view refits to the tips (#285) its copy is stale and a
 * handle would sit away from the tip drawn on the canvas; this rebuilds it with the current width.
 */
function currentView(overlay: Transform | null, worldWidth_m: number): Transform | null {
  if (overlay === null) return null;
  const { widthPx, heightPx, dpr } = overlay;
  return createTransform({ widthPx, heightPx, worldWidth_m, center_m: VIEW_CENTER, dpr });
}

/** A draggable tip: the vector it moves, its accessible name and where it reports a move. */
interface Tip {
  value: Vec2;
  label: string;
  onChange: (next: Vec2) => void;
}

/** The overlay with the two draggable tips, one per vector (#86, decisions 3 and 4). */
function Handles({
  tips,
  worldWidth_m,
}: {
  tips: readonly Tip[];
  worldWidth_m: number;
}): JSX.Element {
  return (
    <SceneOverlay>
      {({ transform: overlay, hostRef }) => {
        const transform = currentView(overlay, worldWidth_m);
        return tips.map((tip) => (
          <DragHandle key={tip.label} {...tip} transform={transform} hostRef={hostRef} />
        ));
      }}
    </SceneOverlay>
  );
}

/** The scene: grid, axes, the arrows and the handles, in a view fitted to the tips (#285). */
function VectorScene({
  a,
  b,
  sum,
  setA,
  setB,
  withSum,
  t,
}: {
  a: Vec2;
  b: Vec2;
  sum: Vec2;
  setA: (next: Vec2) => void;
  setB: (next: Vec2) => void;
  withSum: boolean;
  t: Translate;
}): JSX.Element {
  const worldWidth_m = viewWidth([a, b, sum], VIEW_ASPECT);
  const tips: Tip[] = [
    { value: a, label: t('widgets.VectorWidget.handleA'), onChange: setA },
    { value: b, label: t('widgets.VectorWidget.handleB'), onChange: setB },
  ];
  return (
    <Scene2D
      worldWidth_m={worldWidth_m}
      center_m={[VIEW_CENTER[0], VIEW_CENTER[1]]}
      aspect={VIEW_ASPECT}
      description={t('widgets.VectorWidget.scene')}
    >
      <Grid />
      <Axes />
      <Arrows a={a} b={b} sum={sum} withSum={withSum} t={t} />
      <Handles tips={tips} worldWidth_m={worldWidth_m} />
    </Scene2D>
  );
}

/**
 * Two draggable vectors with their components, magnitude, angle, sum and dot product
 * (docs/WIDGETS.md, VectorWidget; docs/CURRICULUM.md T-0.2). Every number comes from
 * `compute.ts`, which delegates to `vec2` of sim-core; the widget only draws and reads.
 */
export function VectorWidget({
  initialA,
  initialB = [0, 0],
  show,
  unit,
}: VectorWidgetProps): JSX.Element {
  const t = useT();
  const [a, setA] = useState<Vec2>(initialA);
  const [b, setB] = useState<Vec2>(initialB);
  const readout = useMemo(() => readVectors(a, b), [a, b]);
  const context: RowContext = { show, unit, t };
  const status = t('widgets.VectorWidget.status', {
    magnitude: format(readout.sum.magnitude, unit),
    angle: readout.sum.angle_deg.toFixed(ANGLE_DECIMALS),
  });

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start">
      <div className="min-w-0 flex-1">
        <VectorScene
          a={a}
          b={b}
          sum={readout.sum_components}
          setA={setA}
          setB={setB}
          withSum={show.includes('sum')}
          t={t}
        />
      </div>
      <div className="md:w-panel">
        <ReadoutPanel
          title={t('widgets.VectorWidget.panel')}
          rows={panelRows(readout, a, b, context)}
        />
        <LiveStatus text={status} />
      </div>
    </div>
  );
}
