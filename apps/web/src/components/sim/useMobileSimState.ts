import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ControllerParams,
  SimConfig,
  StartPose,
  TrackJson,
  TrackPreset,
} from '@trayectoria/sims';
import type { RobotSpec } from '@trayectoria/widgets';

import { MY_ROBOT_ID } from './RobotSource';

// F4-02b (#128): estado de `/simuladores/movil`, separado de la presentación de
// `MobileSimIsland.tsx` para mantener cada archivo bajo el límite de docs/STANDARDS.md §4.

/** Preset con el que abre la página (criterio del ticket: óvalo). */
export const DEFAULT_PRESET: TrackPreset = 'oval';

// F4-05 (#131, decisiones 6 y 7): el controlador, sus parámetros y la semilla pasan a ser estado
// de la página, no solo del widget: son lo que «Guardar y compartir» escribe en una `SimConfig` y
// lo que un enlace `?c=` vuelve a aplicar. El widget los recibe como `controller`, `initialParams`
// y `seed`; `useControllerChoice` los lee al montar, así que cargar una configuración cambia
// también `configKey`, y con ella el `key` del widget, para que adopte los nuevos.

/**
 * Controlador con el que abre el widget. `LineFollowerWidget` solo admite los tres con ley de
 * control en su prop `controller`; «Manual» sigue siendo una pestaña del selector, pero no un
 * valor con el que la página pueda arrancarlo, así que una configuración con `manual` abre con el
 * PID y el estudiante vuelve a la pestaña manual con un clic.
 */
export type PageController = 'onoff' | 'p' | 'pid';

/** Controlador con el que abre la página (criterio de F4-02b: PID). */
export const DEFAULT_CONTROLLER: PageController = 'pid';

/** Semilla con la que abre la página; es la del widget, y viaja en el enlace compartido. */
export const DEFAULT_SEED = 7;

/** Si el primer render ya ocurrió en el navegador. `useMediaQuery` consulta `matchMedia`, que en
 * el servidor no existe: esta isla es `client:visible` (#128, decisión 1), así que Astro la
 * renderiza también en build y el primer render del cliente debe coincidir con aquel. Hasta que
 * monta, la página se dibuja con la maqueta de escritorio, que es la que el servidor produjo. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

/** La pista efectiva y el preset del selector; el editor y «Cargar JSON» solo cambian la pista. */
export interface TrackChoice {
  readonly preset: TrackPreset;
  readonly track: TrackJson;
}

/**
 * La pose inicial de una pista: el arranque del recorrido mientras nadie arrastre el asa. Se
 * resuelve con el módulo ya cargado, así que devuelve `null` hasta que `@trayectoria/sims` esté
 * en memoria; mientras tanto el widget arranca el robot donde empieza la pista, que es lo mismo.
 */
export async function initialPose(track: TrackJson): Promise<StartPose> {
  const { poseOnTrack, resolveTrack } = await import('@trayectoria/sims');
  return poseOnTrack(resolveTrack(track), null, 0);
}

/**
 * Qué ocupa la caja del visor: la simulación o el editor de pista (#158, decisión 1). El editor
 * sustituye al visor en la misma caja; no es un panel que se despliegue bajo la columna derecha.
 */
export type SimView = 'sim' | 'editor';

/** El controlador, sus parámetros y la semilla de la carrera; lo que el enlace reproduce. */
export interface ControllerChoice {
  readonly controller: PageController;
  readonly params: ControllerParams;
  readonly seed: number;
}

/** Lo que la isla elige y publica; un solo objeto para no repartir seis `useState` por la vista. */
export interface PageState {
  readonly robotId: string;
  readonly setRobotId: (id: string) => void;
  readonly robot: RobotSpec | null;
  readonly setRobot: (spec: RobotSpec) => void;
  readonly choice: TrackChoice;
  readonly startPose: StartPose | null;
  readonly setStartPose: (pose: StartPose) => void;
  readonly onTrack: (track: TrackJson) => void;
  readonly onPreset: (preset: TrackPreset) => void;
  readonly view: SimView;
  readonly openEditor: () => void;
  readonly closeEditor: () => void;
  /** El controlador, los parámetros y la semilla con los que el widget arranca (F4-05). */
  readonly run: ControllerChoice;
  /** Cambia con cada configuración aplicada; es el `key` que remonta el widget (F4-05). */
  readonly configKey: number;
  /** Aplica una configuración guardada o la de un enlace: pista, controlador, params y semilla. */
  readonly applyConfig: (config: SimConfig) => void;
}

/** Aplica la pose de apertura en cuanto el módulo del simulador está cargado. */
export function useOpeningPose(setStartPose: (pose: StartPose) => void): void {
  useEffect(() => {
    let live = true;
    void initialPose(DEFAULT_PRESET).then((pose) => {
      if (live) setStartPose(pose);
    });
    return () => {
      live = false;
    };
  }, [setStartPose]);
}

/**
 * Qué ocupa la caja del visor y cómo se cambia (#158, decisiones 1 y 3). «Volver a la simulación»
 * solo devuelve la caja al visor: la pista editada ya llegó por `onTrack` en cada cambio del
 * editor, y el reinicio a `t = 0` en pausa lo pide la isla, que es quien tiene la api del widget.
 */
export function useSimView(): {
  view: SimView;
  openEditor: () => void;
  closeEditor: () => void;
} {
  const [view, setView] = useState<SimView>('sim');
  const openEditor = useCallback((): void => {
    setView('editor');
  }, []);
  const closeEditor = useCallback((): void => {
    setView('sim');
  }, []);
  return { view, openEditor, closeEditor };
}

/**
 * La pista de una `SimConfig`: el preset con su nombre o el JSON del editor. Un `track` que no es
 * ninguna de las dos formas deja la pista como está, que es lo que la página ya mostraba.
 */
export function trackOf(config: SimConfig): TrackFromConfig | null {
  const { track } = config;
  if (typeof track === 'string') return { track };
  if (typeof track !== 'object' || track === null || !('preset' in track)) return null;
  const { preset } = track;
  const named = PRESETS.find((candidate) => candidate === preset);
  return named === undefined ? null : { preset: named, track: named };
}

/** La pista que sale de una configuración: el JSON, o el preset y su nombre. */
export interface TrackFromConfig {
  readonly preset?: TrackPreset;
  readonly track: TrackJson;
}

/** Los cuatro presets que `LineFollowerWidget` resuelve por su nombre. */
const PRESETS: readonly TrackPreset[] = ['oval', 's', 'tight', 'cross'];

/** La pista elegida y los dos callbacks que la cambian (preset o JSON del editor). */
function useTrackChoice(setStartPose: (pose: StartPose) => void): {
  choice: TrackChoice;
  setChoice: (update: (current: TrackChoice) => TrackChoice) => void;
  onTrack: (track: TrackJson) => void;
  onPreset: (preset: TrackPreset) => void;
} {
  const [choice, setChoice] = useState<TrackChoice>({
    preset: DEFAULT_PRESET,
    track: DEFAULT_PRESET,
  });

  // Cambiar la pista reinicia la simulación (el widget la reconstruye) y devuelve la pose inicial
  // al arranque del nuevo recorrido: la de la pista anterior no tiene sentido sobre esta.
  const onTrack = useCallback(
    (track: TrackJson): void => {
      setChoice((current) => ({ ...current, track }));
      void initialPose(track).then(setStartPose);
    },
    [setStartPose],
  );

  const onPreset = useCallback((preset: TrackPreset): void => {
    setChoice((current) => ({ ...current, preset }));
  }, []);

  return { choice, setChoice, onTrack, onPreset };
}

/**
 * El controlador, los parámetros y la semilla de la carrera, y cómo los cambia una configuración
 * cargada (F4-05). `configKey` sube con cada una: es el `key` con el que la isla remonta el
 * widget, porque `useControllerChoice` lee el controlador y las ganancias solo al montar.
 */
function useRunChoice(applyTrack: (config: SimConfig) => void): {
  run: ControllerChoice;
  configKey: number;
  applyConfig: (config: SimConfig) => void;
} {
  const [run, setRun] = useState<ControllerChoice>({
    controller: DEFAULT_CONTROLLER,
    params: {},
    seed: DEFAULT_SEED,
  });
  const [configKey, setConfigKey] = useState(0);

  const applyConfig = useCallback(
    (config: SimConfig): void => {
      applyTrack(config);
      setRun({
        controller: config.controller === 'manual' ? DEFAULT_CONTROLLER : config.controller,
        params: config.params,
        seed: config.seed,
      });
      setConfigKey((current) => current + 1);
    },
    [applyTrack],
  );

  return { run, configKey, applyConfig };
}

/** El estado de la página: el robot, la pista, la pose inicial y la simulación en curso. */
export function usePageState(): PageState {
  const [robotId, setRobotId] = useState(MY_ROBOT_ID);
  const [robot, setRobot] = useState<RobotSpec | null>(null);
  const [startPose, setStartPose] = useState<StartPose | null>(null);
  const { view, openEditor, closeEditor } = useSimView();
  const { choice, setChoice, onTrack, onPreset } = useTrackChoice(setStartPose);
  useOpeningPose(setStartPose);

  // Cargar una configuración cambia la pista de una vez, sin pasar por `onTrack`: el preset del
  // selector y la pista efectiva salen ambos de la configuración.
  const applyTrack = useCallback(
    (config: SimConfig): void => {
      const resolved = trackOf(config);
      if (resolved === null) return;
      setChoice((current) => ({
        preset: resolved.preset ?? current.preset,
        track: resolved.track,
      }));
      void initialPose(resolved.track).then(setStartPose);
    },
    [setChoice],
  );
  const { run, configKey, applyConfig } = useRunChoice(applyTrack);

  return usePageStateObject({
    robotId,
    setRobotId,
    robot,
    setRobot,
    choice,
    startPose,
    setStartPose,
    onTrack,
    onPreset,
    view,
    openEditor,
    closeEditor,
    run,
    configKey,
    applyConfig,
  });
}

/**
 * El mismo objeto mientras nada cambie. `renderPanel` de la isla depende de él, y uno nuevo en
 * cada render hacía un bucle (nuevo `renderPanel` → el widget se vuelve a renderizar → `onApi` →
 * otro objeto). Los `set*` de `useState` y los `useCallback` de arriba ya son estables.
 */
function usePageStateObject(state: PageState): PageState {
  const { robotId, robot, choice, startPose, onTrack, onPreset } = state;
  const { view, openEditor, closeEditor, run, configKey, applyConfig } = state;
  const kept = useRef(state);
  kept.current = state;
  return useMemo(
    () => ({ ...kept.current }),
    [
      robotId,
      robot,
      choice,
      startPose,
      onTrack,
      onPreset,
      view,
      openEditor,
      closeEditor,
      run,
      configKey,
      applyConfig,
    ],
  );
}
