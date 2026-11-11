import type { JSX } from 'react';
import type { Translate } from '@trayectoria/i18n';

/** Form field (path in `MobileSpec`) → the dimension of the drawing that measures it. */
const DIMENSION_OF: Readonly<Record<string, string>> = {
  length_m: 'length',
  width_m: 'width',
  wheelBase_m: 'wheelBase',
  wheelRadius_m: 'wheelRadius',
  'lineSensors.spacing_m': 'spacing',
  'lineSensors.forwardOffset_m': 'forwardOffset',
  'lineSensors.footprint_m': 'footprint',
  'lineSensors.count': 'sensors',
};

/** True when `key` is a field the drawing can point at. */
export function isDrawn(key: string): boolean {
  return key in DIMENSION_OF;
}

type Point = readonly [number, number];

/** One dimension line of the drawing: where it runs, its label and where the label sits. */
interface DimensionSpec {
  id: string;
  from: Point;
  to: Point;
  at: Point;
  anchor: 'start' | 'middle' | 'end';
}

const DIMENSIONS: readonly DimensionSpec[] = [
  { id: 'length', from: [70, 20], to: [250, 20], at: [160, 12], anchor: 'middle' },
  { id: 'width', from: [52, 55], to: [52, 145], at: [46, 104], anchor: 'end' },
  { id: 'wheelBase', from: [130, 49], to: [130, 151], at: [136, 104], anchor: 'start' },
  { id: 'wheelRadius', from: [130, 170], to: [155, 170], at: [160, 174], anchor: 'start' },
  { id: 'forwardOffset', from: [130, 190], to: [227, 190], at: [178, 204], anchor: 'middle' },
  { id: 'spacing', from: [262, 85], to: [262, 100], at: [268, 96], anchor: 'start' },
  { id: 'footprint', from: [262, 110], to: [262, 120], at: [268, 118], anchor: 'start' },
];

/** The end ticks of a dimension line, across it. */
function Ticks({ from, to }: { from: Point; to: Point }): JSX.Element {
  const [dx, dy] = from[0] === to[0] ? [4, 0] : [0, 4];
  return (
    <>
      {[from, to].map(([x, y]) => (
        <line key={`${String(x)}-${String(y)}`} x1={x - dx} y1={y - dy} x2={x + dx} y2={y + dy} />
      ))}
    </>
  );
}

/** A dimension line with its label; `active` marks the focused field. */
function Dimension({
  spec,
  active,
  label,
}: {
  spec: DimensionSpec;
  active: boolean;
  label: string;
}): JSX.Element {
  const { id, from, to, at, anchor } = spec;
  return (
    <g
      data-dimension={id}
      data-active={active}
      className={active ? 'text-primary' : 'text-fg-muted'}
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 1.25}
    >
      <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} />
      <Ticks from={from} to={to} />
      <text
        x={at[0]}
        y={at[1]}
        textAnchor={anchor}
        fill="currentColor"
        stroke="none"
        fontSize={11}
        fontWeight={active ? 700 : 400}
        className="font-mono"
      >
        {label}
      </text>
    </g>
  );
}

const SENSOR_YS = [70, 85, 100, 115, 130] as const;

/** Chassis, the two wheels, the axle and the row of line sensors. */
function Body({ sensorsOn }: { sensorsOn: boolean }): JSX.Element {
  return (
    <>
      <rect
        x={70}
        y={55}
        width={180}
        height={90}
        rx={8}
        className="fill-bg stroke-border"
        strokeWidth={2}
      />
      <rect x={105} y={43} width={50} height={12} rx={2} className="fill-fg-muted" />
      <rect x={105} y={145} width={50} height={12} rx={2} className="fill-fg-muted" />
      <line x1={130} y1={49} x2={130} y2={151} className="stroke-border" strokeDasharray="3 3" />
      {SENSOR_YS.map((y) => (
        <rect
          key={y}
          x={222}
          y={y - 5}
          width={10}
          height={10}
          className={sensorsOn ? 'fill-primary' : 'fill-fg-muted'}
        />
      ))}
    </>
  );
}

/**
 * Top view of the robot, nose to the right, with each measure of the form drawn as a dimension
 * line. The one whose field has the focus is highlighted (v1.5). It is a schematic, not to scale.
 */
export function RobotDiagram({
  focusedKey,
  t,
}: {
  focusedKey: string | null;
  t: Translate;
}): JSX.Element {
  const active = focusedKey === null ? undefined : DIMENSION_OF[focusedKey];
  return (
    <svg
      viewBox="0 0 360 210"
      role="img"
      aria-label={t('widgets.MyRobotWidget.diagram.title')}
      className="mx-auto h-auto w-full max-w-[360px]"
      data-testid="robot-diagram"
    >
      <Body sensorsOn={active === 'sensors' || active === 'footprint'} />
      {DIMENSIONS.map((spec) => (
        <Dimension
          key={spec.id}
          spec={spec}
          active={active === spec.id}
          label={t(`widgets.MyRobotWidget.diagram.${spec.id}`)}
        />
      ))}
    </svg>
  );
}
