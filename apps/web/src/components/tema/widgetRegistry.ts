import type { JSX } from 'react';

/**
 * Registro nombre → entrada propia de `@trayectoria/widgets` para la página de tema (ADR-0009,
 * #188). Cada valor es un `import()` dinámico de `@trayectoria/widgets/<Widget>`, no del barrel:
 * así el tema solo descarga los widgets que su MDX declara, y no el catálogo entero.
 *
 * Los especificadores son literales, uno por widget, porque un `import()` con plantilla
 * (`import(\`@trayectoria/widgets/${name}\`)`) no lo puede analizar el empaquetador y acabaría
 * emitiendo un chunk por cada widget en la tabla de dependencias de toda página de tema, que es
 * justo lo que #188 arregla.
 *
 * `ParamPanel`, `Formula` y `Plot` son componentes de interfaz comunes a casi todos los widgets
 * (ADR-0009): comparten chunk y no se separan porque separarlos no ahorra nada.
 */
export type WidgetModule = Readonly<Record<string, unknown>>;

/** Carga perezosa de un widget: devuelve el módulo de su entrada propia. */
export type WidgetLoader = () => Promise<WidgetModule>;

/**
 * Un widget montado por la página de tema. Las props llegan ya serializadas por Astro (solo
 * valores JSON), así que el componente se tipa por esa forma y no por la de cada widget: la
 * forma concreta la valida `astro check` en el `.astro` que pasa las props.
 */
export type TopicWidgetComponent = (props: Readonly<Record<string, unknown>>) => JSX.Element;

/**
 * Un módulo de widget expone su componente bajo su propio nombre (docs/STANDARDS.md §4). El
 * guard estrecha el `unknown` del módulo sin aserción: React llama al componente con las props
 * que Astro ya serializó, y su firma concreta la valida `astro check` en el `.astro` que lo usa.
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
  LineSensorWidget: () => import('@trayectoria/widgets/LineSensorWidget'),
  MyRobotWidget: () => import('@trayectoria/widgets/MyRobotWidget'),
  ParamPanel: () => import('@trayectoria/widgets/ParamPanel'),
  Plot: () => import('@trayectoria/widgets/Plot'),
  PowerWidget: () => import('@trayectoria/widgets/PowerWidget'),
  ProjectileWidget: () => import('@trayectoria/widgets/ProjectileWidget'),
  RotationWidget: () => import('@trayectoria/widgets/RotationWidget'),
  VectorWidget: () => import('@trayectoria/widgets/VectorWidget'),
};

/** Nombres que un `widgets:` del frontmatter puede declarar, para el error de build del tema. */
export function widgetNames(): readonly string[] {
  return Object.keys(LOADERS);
}

/**
 * Topic widgets a topic MDX writes by name, with the props of docs/WIDGETS.md (#243, decision 1;
 * #246). Only the ones whose props are all serializable to an island: `Formula` has its own
 * block component, `ExerciseWidget` is mounted by `Verifica`, `ParamPanel` and `Plot` are pieces
 * of other widgets. `LineSensorWidget` comes with T-6.1 and reads the robot from `useMyRobot()`.
 */
export const TOPIC_WIDGETS = [
  'DiffDriveWidget',
  'EnergyWidget',
  'FreeBodyWidget',
  'GearWidget',
  'KinematicsWidget',
  'LineSensorWidget',
  'MyRobotWidget',
  'PowerWidget',
  'ProjectileWidget',
  'RotationWidget',
  'VectorWidget',
] as const;

/** El cargador de un widget, o `undefined` si el nombre no está en el registro. */
export function findWidgetLoader(name: string): WidgetLoader | undefined {
  return LOADERS[name];
}

/**
 * Resuelve el componente de un widget desde su entrada propia. El módulo exporta el componente
 * bajo su propio nombre (`Formula` en `@trayectoria/widgets/Formula`), que es la convención de
 * `docs/STANDARDS.md` §4 para el `index.ts` de un widget.
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
    throw new Error(`@trayectoria/widgets/${name} does not export a component named "${name}"`);
  }
  return component;
}
