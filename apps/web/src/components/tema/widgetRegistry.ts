import type { JSX } from 'react';

/**
 * Registry name → own entry of `@trayectoria/widgets` for the topic page (ADR-0009,
 * #188). Each value is a dynamic `import()` of `@trayectoria/widgets/<Widget>`, not of the barrel:
 * that way the topic only downloads the widgets its MDX declares, and not the whole catalogue.
 *
 * The specifiers are literals, one per widget, because an `import()` with a template
 * (`import(\`@trayectoria/widgets/${name}\`)`) cannot be analysed by the bundler and would end up
 * emitting a chunk per widget in the dependency table of every topic page, which is
 * exactly what #188 fixes.
 *
 * `ParamPanel`, `Formula` and `Plot` are interface components common to almost every widget
 * (ADR-0009): they share a chunk and are not split because splitting them saves nothing.
 */
export type WidgetModule = Readonly<Record<string, unknown>>;

/** Lazy loading of a widget: returns the module of its own entry. */
export type WidgetLoader = () => Promise<WidgetModule>;

/**
 * A widget mounted by the topic page. The props arrive already serialized by Astro (only
 * JSON values), so the component is typed by that shape and not by each widget's: the
 * concrete shape is validated by `astro check` in the `.astro` that passes the props.
 */
export type TopicWidgetComponent = (props: Readonly<Record<string, unknown>>) => JSX.Element;

/**
 * A widget module exposes its component under its own name (docs/STANDARDS.md §4). The
 * guard narrows the module's `unknown` without an assertion: React calls the component with the props
 * Astro already serialized, and its concrete signature is validated by `astro check` in the `.astro` that uses it.
 */
function isTopicWidget(exported: unknown): exported is TopicWidgetComponent {
  return typeof exported === 'function';
}

const LOADERS: Readonly<Record<string, WidgetLoader>> = {
  DiffDriveWidget: () => import('@trayectoria/widgets/DiffDriveWidget'),
  EnergyWidget: () => import('@trayectoria/widgets/EnergyWidget'),
  ExerciseWidget: () => import('@trayectoria/widgets/ExerciseWidget'),
  Formula: () => import('@trayectoria/widgets/Formula'),
  FreeBodyWidget: () => import('@trayectoria/widgets/FreeBodyWidget'),
  GearWidget: () => import('@trayectoria/widgets/GearWidget'),
  KinematicsWidget: () => import('@trayectoria/widgets/KinematicsWidget'),
  // The one topic widget that lives in `packages/sims`, with an entry of its own there (#409).
  LineFollowerWidget: () => import('@trayectoria/sims/LineFollowerWidget'),
  LineSensorWidget: () => import('@trayectoria/widgets/LineSensorWidget'),
  MotorCurveWidget: () => import('@trayectoria/widgets/MotorCurveWidget'),
  MyRobotWidget: () => import('@trayectoria/widgets/MyRobotWidget'),
  ParamPanel: () => import('@trayectoria/widgets/ParamPanel'),
  Plot: () => import('@trayectoria/widgets/Plot'),
  PowerWidget: () => import('@trayectoria/widgets/PowerWidget'),
  ProjectileWidget: () => import('@trayectoria/widgets/ProjectileWidget'),
  RotationWidget: () => import('@trayectoria/widgets/RotationWidget'),
  VectorWidget: () => import('@trayectoria/widgets/VectorWidget'),
};

/** Names a frontmatter `widgets:` may declare, for the topic's build error. */
export function widgetNames(): readonly string[] {
  return Object.keys(LOADERS);
}

/**
 * Topic widgets a topic MDX writes by name, with the props of docs/WIDGETS.md (#243, decision 1;
 * #246). Only the ones whose props are all serializable to an island: `Formula` has its own
 * block component, `ExerciseWidget` is mounted by `Verifica` and `ParamPanel` and `Plot` are pieces
 * of other widgets. `LineFollowerWidget` (#409) and `LineSensorWidget` (T-6.1) take only their
 * serializable props and read the robot from `useMyRobot()`.
 */
export const TOPIC_WIDGETS = [
  'DiffDriveWidget',
  'EnergyWidget',
  'FreeBodyWidget',
  'GearWidget',
  'KinematicsWidget',
  'LineFollowerWidget',
  'LineSensorWidget',
  'MotorCurveWidget',
  'MyRobotWidget',
  'PowerWidget',
  'ProjectileWidget',
  'RotationWidget',
  'VectorWidget',
] as const;

/** The loader of a widget, or `undefined` if the name is not in the registry. */
export function findWidgetLoader(name: string): WidgetLoader | undefined {
  return LOADERS[name];
}

/**
 * Resolves a widget's component from its own entry. The module exports the component
 * under its own name (`Formula` in `@trayectoria/widgets/Formula`), which is the convention of
 * `docs/STANDARDS.md` §4 for a widget's `index.ts`.
 */
export async function loadWidget(name: string): Promise<TopicWidgetComponent> {
  const loader = findWidgetLoader(name);
  if (loader === undefined) {
    throw new Error(
      `unknown widget "${name}" (components/tema/widgetRegistry); ` +
        `known widgets: ${widgetNames().join(', ')}`,
    );
  }
  const component = (await loader())[name];
  if (!isTopicWidget(component)) {
    throw new Error(`the entry of ${name} does not export a component named "${name}"`);
  }
  return component;
}
