import { useCallback, useEffect, useMemo, useState } from 'react';
import type { StartPose, TrackJson, TrackPreset } from '@trayectoria/sims';
import type { RobotSpec } from '@trayectoria/widgets';

import { MY_ROBOT_ID } from './RobotSource';

// F4-02b (#128): estado de `/simuladores/movil`, separado de la presentación de
// `MobileSimIsland.tsx` para mantener cada archivo bajo el límite de docs/STANDARDS.md §4.

/** Preset con el que abre la página (criterio del ticket: óvalo). */
export const DEFAULT_PRESET: TrackPreset = 'oval';

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

/** El estado de la página: el robot, la pista, la pose inicial y la simulación en curso. */
export function usePageState(): PageState {
  const [robotId, setRobotId] = useState(MY_ROBOT_ID);
  const [robot, setRobot] = useState<RobotSpec | null>(null);
  const [choice, setChoice] = useState<TrackChoice>({
    preset: DEFAULT_PRESET,
    track: DEFAULT_PRESET,
  });
  const [startPose, setStartPose] = useState<StartPose | null>(null);
  const { view, openEditor, closeEditor } = useSimView();
  useOpeningPose(setStartPose);

  // Cambiar la pista reinicia la simulación (el widget la reconstruye) y devuelve la pose inicial
  // al arranque del nuevo recorrido: la de la pista anterior no tiene sentido sobre esta.
  const onTrack = useCallback((track: TrackJson): void => {
    setChoice((current) => ({ ...current, track }));
    void initialPose(track).then(setStartPose);
  }, []);

  const onPreset = useCallback((preset: TrackPreset): void => {
    setChoice((current) => ({ ...current, preset }));
  }, []);

  // Memoizado: `renderPanel` depende de este objeto, y uno nuevo en cada render hacía un bucle
  // (nuevo `renderPanel` → el widget se vuelve a renderizar → `onApi` → `setApi` → otro objeto).
  // Los `set*` de `useState` y los `useCallback` de arriba ya son estables.
  return useMemo(
    () => ({
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
    }),
    [robotId, robot, choice, startPose, onTrack, onPreset, view, openEditor, closeEditor],
  );
}
