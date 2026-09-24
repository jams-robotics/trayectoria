# Catálogo de widgets

Componentes React reutilizables en `packages/widgets`. Un tema solo compone widgets de este catálogo. Un widget nuevo requiere un ticket de tipo `widget` y una entrada aquí antes de usarse.

## Reglas comunes

- Props tipadas; todo valor físico con sufijo de unidad (`STANDARDS.md` §3).
- Cada widget: `index.ts`, `X.tsx`, `X.test.tsx`, `X.stories.tsx` (demo en `/dev/widgets`), captura en `apps/web/e2e/visual/X.png`.
- Textos por claves i18n en `locales/es/widgets.json`.
- Operable con teclado; `aria-label` en cada control; descripción textual del estado en `aria-live="polite"` como máximo cada 2 s.
- Props `initial*` para valores iniciales; `onChange` para exponer estado al tema (rara vez necesario).
- Ninguno importa `three`, `uplot` ni `katex` salvo su envoltorio designado.
- Estilo: solo tokens y componentes base de `docs/DESIGN.md`. Sin colores, tamaños ni sombras literales. Colores de series de gráficas y de vectores desde la paleta de datos de `DESIGN.md`.

## Base

### ParamPanel
Sliders y campos numéricos con unidad y rango.
```ts
interface ParamPanelProps {
  params: Array<{ key: string; label: string; unit: string; min: number; max: number; step: number; value: number; description?: string }>;
  onChange(key: string, value: number): void;
  layout?: 'stack' | 'inline';
}
```

### Formula
Fórmula LaTeX con KaTeX; opción de resaltar una variable y de mostrar la versión sustituida con valores.
```ts
interface FormulaProps { latex: string; block?: boolean; highlight?: string; substituted?: string; }
```

### Plot
Gráficas estáticas o en vivo sobre uPlot.
```ts
interface Series { key: string; label: string; unit: string; color?: string; data?: number[] }
interface PlotProps {
  x: { label: string; unit: string; data?: number[] };
  series: Series[];
  live?: { buffer: RingBuffer; windowSeconds: number };
  refLines?: Array<{ y: number; label: string }>;
  height?: number;
  marker?: { x: number; onDrag?(x: number): void };
}
```

### Scene2D
Canvas 2D en coordenadas físicas (m, Y hacia arriba). Hijos declarativos: `Grid`, `Axes`, `Vector`, `Trace`, `Circle`, `Rect`, `RobotBody` (desde `RobotSpec`), `Label`, `TrackLayer`.
```ts
interface Scene2DProps { worldWidth_m: number; center_m?: [number, number]; aspect?: number; description: string; children: ReactNode }
```
`description` es obligatoria: texto accesible ya traducido que el escenario usa como `aria-label`.
Hook asociado: `useSimulationDriver(sim: Simulation, { fps?: number })` enlaza el bucle con `requestAnimationFrame` y expone `state`.

### Scene3D
Canvas React Three Fiber con luces, grid, ejes, órbita. Hijos: `Frame` (tríada con etiqueta), `Mesh` genérico. Carga perezosa obligatoria (`client:only="react"`).
```ts
interface Scene3DProps { up?: 'z' | 'y'; showGrid?: boolean; children: ReactNode }
```

### ExerciseWidget
UI de un ejercicio de `defineExercise`. Registra intentos si hay sesión.
```ts
interface ExerciseWidgetProps { exercise: Exercise; topicId: string; required?: boolean; index?: number; seed?: number }
```
`index` pinta el prefijo `E1`, `E2`… del ejercicio dentro del tema; `seed` fija la instancia para stories, tests y e2e (si no, sale de la sesión).

### MyRobotWidget
Formulario del perfil móvil y tarjeta compacta.
```ts
interface MyRobotWidgetProps { mode: 'form' | 'card' }
```
Hook asociado: `useMyRobot(): RobotSpec` (siempre devuelve un spec: el del usuario o el robot de referencia).

## Física y matemática

### VectorWidget
Dos vectores arrastrables; suma, componentes, magnitud, ángulo, producto escalar.
```ts
interface VectorWidgetProps { initialA: [number, number]; initialB?: [number, number]; show: Array<'sum' | 'components' | 'dot' | 'angle'>; unit: string }
```

### FreeBodyWidget
Cuerpo con fuerzas editables, resultante, plano inclinado opcional.
```ts
interface FreeBodyWidgetProps { mass_kg: number; forces: Array<{ key: string; label: string; magnitude_N: number; angle_rad: number; editable?: boolean }>; slope_rad?: number; showResultant?: boolean }
```

### KinematicsWidget
Partícula 1D con `x–t`, `v–t`, `a–t` sincronizadas; modo tangente.
```ts
interface KinematicsWidgetProps { initial: { x0_m: number; v0_mps: number; a_mps2: number }; editable: Array<'x0' | 'v0' | 'a'>; duration_s: number; showTangent?: boolean }
```

### ProjectileWidget
Tiro parabólico, caída libre y objeto soltado desde un robot en movimiento. `mode` es el modo inicial; con más de un modo en `modes`, un selector segmentado cambia entre ellos (vuelve a `t = 0` en pausa y conserva `h_m`). `overlay` superpone dos trayectorias A y B en `launch` y también en `drop`, donde B empieza con 4 veces la altura de A (#304).
```ts
interface ProjectileWidgetProps { mode: 'launch' | 'drop' | 'dropFromRobot'; modes?: Array<'launch' | 'drop' | 'dropFromRobot'>; initial: { v0_mps?: number; launchAngle_rad?: number; h_m: number; vRobot_mps?: number }; overlay?: boolean; showVectors?: Array<'v' | 'vx' | 'vy'> }
```

### RotationWidget
Disco o rueda con ω, punto en el borde, `v = ω·r`, período, vueltas; modos rodadura y aceleración angular.
```ts
interface RotationWidgetProps { mode: 'disc' | 'rolling' | 'angularAccel'; initial: { omega_radps: number; r_m: number; alpha_radps2?: number }; inputUnit?: 'rpm' | 'radps' }
```

### EnergyWidget
Robot en pista con rampa; barras de energía; modo potencia y autonomía.
```ts
interface EnergyWidgetProps { mode: 'ramp' | 'power'; initial: { mass_kg: number; v0_mps: number; slope_rad: number; mu_k?: number }; power?: { torque_Nm: number; omega_radps: number; voltage_V: number; current_A: number; battery_Wh: number } }
```

### GearWidget
Par de engranajes o tren de dos etapas; relación, sentidos, torque y velocidad.
```ts
interface GearWidgetProps { stages: 1 | 2; initial: { z1: number; z2: number; z3?: number; z4?: number; nIn_rpm: number; torqueIn_Nm: number; efficiency?: number } }
```

## Robot móvil

### DiffDriveWidget
Mini simulador del robot diferencial: `ω_L, ω_R` o `v, ω`, CIR, radio, trayectoria, marcos, odometría.
```ts
interface DiffDriveWidgetProps {
  mode: 'forward' | 'inverse' | 'odometry';
  robot?: RobotSpec;                 // default: useMyRobot()
  show: Array<'icr' | 'frames' | 'trace' | 'radius' | 'wheelVelocities'>;
  initial: { omegaL_radps?: number; omegaR_radps?: number; v_mps?: number; omega_radps?: number };
  duration_s?: number;
}
```

### LineSensorWidget
Arreglo de sensores sobre un tramo de línea desplazable; lecturas, posición ponderada, umbral.
```ts
interface LineSensorWidgetProps { robot?: RobotSpec; initialOffset_m: number; initialAngle_rad?: number; showBinary?: boolean; noiseSigma?: number }
```
(Nota: este widget se construye en el ticket T-6.1 como excepción documentada, porque solo M6 lo usa; su spec vive aquí para que el catálogo esté completo.)

### LineFollowerWidget
El simulador móvil completo embebido (pista preset, controlador seleccionable, instrumentación reducida). Es el mismo componente que la página `/simuladores/movil` con `compact`.
```ts
interface LineFollowerWidgetProps {
  track: 'oval' | 's' | 'tight' | 'cross' | TrackJson;
  controller: 'onoff' | 'p' | 'pid';
  initialParams: Record<string, number>;
  robot?: RobotSpec;
  compact?: boolean;
  showPlots?: Array<'error' | 'v' | 'omega' | 'pid'>;
  noiseSigma?: number;
  startPose?: StartPose;
  onStartPoseChange?: (pose: StartPose) => void;
  onApi?: (api: LineFollowerApi) => void;
  renderPanel?: (panel: ReactNode) => ReactNode;
  renderViewer?: (viewer: ReactNode) => ReactNode;
  hideControls?: boolean;
  seed?: number;
}
```
`renderPanel` envuelve la columna del panel de controlador y `renderViewer` la del visor, para que una página decida qué las rodea sin tocar el DOM del widget: es lo que permite plegar el panel en un acordeón móvil (F4-02b) y alternar visor y editor de pista en la misma caja (#158). `hideControls` oculta los controles de reproducción cuando la página los pone en su barra inferior fija (F4-02b). `seed` fija la semilla del ruido del sensor y es la que viaja en el enlace compartido (#131); cambiarla reconstruye la simulación pausada en `t = 0`. `showPlots` es operativa desde F4-03 (#129): elige cuáles de las cuatro gráficas en vivo se pintan (`'error'`, `'v'`, `'omega'`, `'pid'`); sin la prop no se dibuja ninguna.

### TrackEditor
Editor de pista de F4-01b, embebido en la caja del visor del simulador móvil (#158). Vive en `packages/sims`; no es un widget del catálogo de temas, pero su comportamiento se documenta aquí porque `LineFollowerWidget` lo aloja con `renderViewer`.
```ts
interface TrackEditorProps {
  initialTrack?: Track;
  onChange?: (track: Track) => void;
  renderPanel?: (panel: ReactNode) => ReactNode;
  canvasHeight_px?: number;
  onSaveTrack?: (name: string, track: Track) => Promise<void>;
}
```
`renderPanel` envuelve el panel numérico para que la página lo coloque donde quiera, con el lienzo a todo el ancho y la barra de herramientas en una fila encima; sin la prop, la maquetación del playground no cambia (#189). `canvasHeight_px` fija el alto del lienzo (#189). `onSaveTrack` añade el botón «Guardar» a la barra, con nombre en línea; sin la prop no hay botón. Los botones de archivo son «Exportar JSON» e «Importar JSON» siempre, con o sin `onSaveTrack` (#191).
Con la herramienta «Seleccionar» y un segmento seleccionado aparece una barra flotante junto a la pista con sus acciones frecuentes, y el segmento seleccionado se resalta en el lienzo (#159, #160). Con «Recta», «Arco» o «Borrar» la barra no se renderiza; la selección se conserva y la barra reaparece al volver a «Seleccionar» (#180). Atajos de teclado dentro del editor: `F` invierte el sentido del segmento y `Supr` lo borra; el control «Sentido» hace lo mismo desde la barra (#159). El panel numérico sigue siendo la ruta accesible a las mismas ediciones.

## Brazo

### ArmViewerWidget
Visor URDF con sliders, marcos, panel del efector y matrices; es el simulador de brazo embebido.
```ts
interface ArmViewerWidgetProps {
  catalogId?: string;
  source?: ArmSource;
  robot?: RobotSpec;
  initialQ?: number[];
  show: Array<'frames' | 'matrices' | 'workspace'>;
  compact?: boolean;
  renderPanel?: (panel: ArmViewerPanel) => ReactNode;
}
```
Las tres capas de `show` son operativas: `frames` (F5-01a), `matrices` (#135) y `workspace` (#136). `renderPanel` recibe un panel a la vez, en orden, y pinta lo que devuelve en lugar del panel suelto, para plegarlos en acordeones en móvil (F5-01b, DESIGN.md §9.4):
```ts
interface ArmViewerPanel { id: 'joints' | 'effector' | 'matrices' | 'workspace'; title: string; summary: string; content: ReactNode }
```
El panel de matrices (#135) resalta en 3D el eslabón elegido: `UrdfModel` gana `highlightLink?: string` y sin valor no resalta nada. El panel de espacio de trabajo (#136) es el de F5-03 dentro del visor.

De dónde sale el brazo lo decide `source`, que manda sobre `catalogId` cuando viene (#137); `loadArm` es la única vía de carga y las dos fuentes se exportan desde `sims`:
```ts
type ArmSource =
  | { readonly kind: 'catalog'; readonly catalogId: string }
  | { readonly kind: 'zip'; readonly bytes: Uint8Array; readonly urdfPath: string };
function loadArm(source: ArmSource, options: LoadUrdfOptions): Promise<LoadedArm>;
```
El formulario de subida de F3-04 se reutiliza para importar sin guardar: `UploadUrdfForm` gana `mode?: 'save' | 'parseOnly'`, con `'save'` por defecto (el comportamiento de F3-04); en `'parseOnly'` entrega el zip ya parseado a quien llama y no guarda nada, que es lo que usa el importador del simulador de brazo sin sesión (#137).

## Componentes MDX

El mapa MDX (`apps/web/src/components/tema/`, ARCHITECTURE §3.3) expone, con su nombre y sus props, solo los widgets de tema con props serializables (#246): `Formula`, `VectorWidget`, `KinematicsWidget`, `ProjectileWidget`, `FreeBodyWidget`, `RotationWidget`, `EnergyWidget`, `GearWidget`, `DiffDriveWidget` y `MyRobotWidget`. No se exponen `ParamPanel` ni `Plot`, que son piezas internas de otros widgets. `ExerciseWidget` se monta a través de `Verifica`. `LineSensorWidget` y `LineFollowerWidget` se resuelven en el Módulo 6.

Cada widget de tema llega al mapa por un envoltorio `.astro` de una línea, `catalog/<Widget>.astro`, que monta el único mecanismo genérico, `CatalogWidget`, con el nombre del widget (PR #248). La lista vive en `TOPIC_WIDGETS` (`widgetRegistry.ts`); si la lista y los envoltorios no coinciden, falla el build (`catalogWidgets.ts`) y también `pnpm test` (`catalogWidgets.test.ts`). Añadir un widget al mapa es añadir su entrada y su envoltorio.

Además expone componentes propios del tema, que no viven en `packages/widgets`.

### RobotFormula
`Formula` sustituida con los datos de «Mi robot» (#243). Resuelve `calc` entre los cálculos que exportan los `alrobot.ts` de los temas, lee `useMyRobot()` y pinta `Formula` con el `latex` y el `substituted` que devuelve el cálculo.
```ts
interface RobotFormulaProps { calc: string } // clave `<topicId>/<calcId>`, p. ej. "ruta-1/m00-t01/omega-rueda"
type RobotCalc = (spec: RobotSpec) => { latex: string; substituted: string }; // lo que exporta alrobot.ts
```

## Relación tema → widgets (v1)

| Módulo | Widgets |
|---|---|
| M0 | VectorWidget, KinematicsWidget, RotationWidget (unidades), MyRobotWidget |
| M1 | KinematicsWidget, ProjectileWidget |
| M2 | FreeBodyWidget, EnergyWidget (rampa), GearWidget (torque en rueda, modo 1 etapa) |
| M3 | EnergyWidget |
| M4 | RotationWidget, GearWidget, DiffDriveWidget, MyRobotWidget |
| M5 | DiffDriveWidget |
| M6 | LineSensorWidget, LineFollowerWidget, MyRobotWidget |
| Todos | Formula, ParamPanel, Plot, ExerciseWidget |
