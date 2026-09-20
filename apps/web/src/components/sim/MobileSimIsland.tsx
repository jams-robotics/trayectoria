import { Suspense, lazy, useCallback, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useT } from '@trayectoria/i18n';
import { Toast } from '@trayectoria/widgets';
import type { LineFollowerApi, LiveInstruments, SimConfig } from '@trayectoria/sims';

import { useApiStore } from './apiStore';
import type { ApiStore } from './apiStore';
import { useEditorPanelStore } from './editorPanelStore';
import type { EditorPanelStore } from './editorPanelStore';
import { EmptyTrackToast, useEmptyTrackNotice } from './EmptyTrackNotice';
import { useInstruments } from './instrumentsStore';
import { BOTTOM_BAR_HEIGHT_PX } from './BottomBar';
import { LiveBottomBar, SidePanels } from './MobileSimPanels';
import type { OpenPanelId, SidePanelsProps } from './MobileSimPanels';
import { ViewerBox } from './ViewerBox';
import { MOBILE_MEDIA_QUERY, useMediaQuery } from './useMediaQuery';
import { useSavedTracks } from './useSavedTracks';
import type { SavedTracksApi } from './useSavedTracks';
import { useSimConfigs } from './useSimConfigs';
import type { SimConfigsApi } from './useSimConfigs';
import type { ControllerChoice, PageState } from './useMobileSimState';
import { useMounted, usePageState } from './useMobileSimState';

// F4-02b (#128, decisiones 1, 2 y 4): la isla de `/simuladores/movil`. Es `client:visible` y no
// importa `three`: el simulador es el `LineFollowerWidget` de F4-02a tal cual, y esta isla solo
// compone a su alrededor el origen del robot, el de la pista, la pose inicial y la maqueta de
// escritorio (04) y móvil (08).
//
// `@trayectoria/sims` se carga con `import()`, no de forma estática (mismo patrón que
// `ArmSimIsland` de F5-01b): su `index.ts` reexporta también `SimGallery` con las stories del
// playground, y traerlas en el chunk inicial dejaba la página en 252 kB comprimidos, por encima
// del presupuesto de docs/ARCHITECTURE.md §8. Cargado aparte, el JS inicial baja a lo que la
// página necesita para pintarse y el simulador entra en cuanto resuelve su chunk.
//
// El estado de la página vive en `useMobileSimState.ts` y los paneles (Robot, Pista, Lecturas y
// la columna derecha que los agrupa) en `MobileSimPanels.tsx`; este archivo solo compone ambos
// con el `LineFollowerWidget` (docs/STANDARDS.md §4, límite de tamaño de archivo).

// F4-05 (#131, decisiones 6 y 7): la isla es además quien lee `?c=` al montar, quien compone la
// `SimConfig` en curso y quien decide dónde se guarda (local o la fila del robot), en
// `useSimConfigs.ts`. El panel «Guardar y compartir» es uno más de la columna derecha.

/** El simulador de F4-02a, resuelto solo cuando el navegador lo renderiza. */
const LazyLineFollowerWidget = lazy(async () => {
  const module = await import('@trayectoria/sims');
  return { default: module.LineFollowerWidget };
});

/**
 * La configuración en curso, estable mientras nada cambie de valor. `SaveConfigPanel` la usa para
 * codificar el enlace en un efecto, así que un objeto nuevo en cada render volvería a codificarlo
 * sin parar: se compara por su JSON y solo se devuelve otro cuando de verdad es otra.
 */
function useStableConfig(config: Omit<SimConfig, 'id' | 'name'>): Omit<SimConfig, 'id' | 'name'> {
  const kept = useRef(config);
  if (JSON.stringify(kept.current) !== JSON.stringify(config)) kept.current = config;
  return kept.current;
}

/**
 * Lo que «Guardar y compartir» guarda y comparte: la pista de la página y el controlador, los
 * parámetros y la semilla con los que corre el widget. La pista viaja como el preset elegido
 * mientras no se haya editado, y como el JSON del editor en cuanto sí (F4-05, decisión 2).
 */
function useCurrentConfig(
  page: ReturnType<typeof usePageState>,
  live: ControllerChoice,
): Omit<SimConfig, 'id' | 'name'> {
  const { preset, track } = page.choice;
  return useStableConfig({
    track: track === preset ? { preset } : track,
    controller: live.controller,
    params: live.params,
    seed: live.seed,
  });
}

/**
 * El `renderPanel` que la isla le da al widget: el widget entrega ahí su panel del controlador y
 * la página lo devuelve dentro de la columna derecha completa (maqueta 04), con Robot, Pista,
 * Lecturas y «Guardar y compartir» debajo.
 *
 * `renderPanel` es una prop del widget, así que un callback nuevo lo vuelve a renderizar; y el
 * widget publica su estado con `onApi`, que actualiza esta página. Si el callback dependiera del
 * estado, cada estado publicado produciría un callback nuevo y con él otro render, es decir un
 * bucle. Lo que cambia en cada estado se lee de un ref dentro del propio callback, de modo que su
 * identidad solo depende de lo que cambia la maqueta.
 */
function useSidePanels(
  props: Omit<SidePanelsProps, 'controller'>,
): (panel: ReactNode) => ReactNode {
  const { mobile, openId, setOpenId, store, onChoice, instruments, panels } = props;
  const latest = useRef(props);
  latest.current = props;
  return useCallback(
    (panel: ReactNode): ReactNode => (
      <SidePanels
        page={latest.current.page}
        mobile={mobile}
        openId={openId}
        setOpenId={setOpenId}
        t={latest.current.t}
        controller={panel}
        store={store}
        configs={latest.current.configs}
        current={latest.current.current}
        onChoice={onChoice}
        instruments={instruments}
        panels={panels}
        tracks={latest.current.tracks}
      />
    ),
    [mobile, openId, setOpenId, store, onChoice, instruments, panels],
  );
}

/**
 * The notice the page is showing: the one of «Guardar y compartir» (copied, invalid link, failed
 * save) or the one of the saved tracks (#191). There is a single `Toast` at a time, and the one
 * of the tracks goes first: it answers the last thing the learner did.
 */
function Notices({
  configs,
  tracks,
}: {
  configs: SimConfigsApi;
  tracks: SavedTracksApi;
}): JSX.Element | null {
  const shown = tracks.notice === null ? configs : tracks;
  if (shown.notice === null) return null;
  return <Toast message={shown.notice.message} tone={shown.notice.tone} onClose={shown.dismiss} />;
}

/** La pista, el controlador, el robot y la pose con los que la página abre la carrera. */
function runProps(page: ReturnType<typeof usePageState>): {
  track: PageState['choice']['track'];
  controller: ControllerChoice['controller'];
  initialParams: ControllerChoice['params'];
  seed: number;
  robot?: NonNullable<PageState['robot']>;
  startPose?: NonNullable<PageState['startPose']>;
} {
  return {
    track: page.choice.track,
    controller: page.run.controller,
    initialParams: page.run.params,
    seed: page.run.seed,
    ...(page.robot === null ? {} : { robot: page.robot }),
    ...(page.startPose === null ? {} : { startPose: page.startPose }),
  };
}

/** Lo que la isla le pasa al simulador: la página, la maqueta y los tres canales de salida. */
interface SimulatorProps {
  readonly page: ReturnType<typeof usePageState>;
  readonly mobile: boolean;
  readonly renderPanel: (panel: ReactNode) => ReactNode;
  readonly onApi: (api: LineFollowerApi) => void;
  readonly onInstruments: (instruments: LiveInstruments) => void;
  readonly store: ApiStore;
  readonly panels: EditorPanelStore;
  /** Se llama al volver del editor con el lienzo sin segmentos (#190, decisión 3). */
  readonly onEmptyTrack: () => void;
  /** «Guardar» of the editor: the track goes to the account or to the browser (#191, decision 3). */
  readonly onSaveTrack: SavedTracksApi['onSave'];
}

/** El aviso mientras el chunk del simulador se resuelve. */
function SimulatorFallback(): JSX.Element {
  const t = useT();
  return (
    <p className="text-fg-muted text-sm" role="status" aria-live="polite">
      {t('sims.mobilePage.loading')}
    </p>
  );
}

/** El simulador: el `LineFollowerWidget` de F4-02a con la pista, el robot y la pose de la página. */
function Simulator({
  page,
  mobile,
  renderPanel,
  onApi,
  onInstruments,
  store,
  panels,
  onEmptyTrack,
  onSaveTrack,
}: SimulatorProps): JSX.Element {
  return (
    <Suspense fallback={<SimulatorFallback />}>
      <LazyLineFollowerWidget
        // F4-05: cargar una configuración sube `configKey` y el widget se remonta con el
        // controlador, los parámetros y la semilla nuevos; `useControllerChoice` los lee al
        // montar, así que sin el `key` la configuración cargada no llegaría a los mandos.
        key={page.configKey}
        {...runProps(page)}
        onStartPoseChange={page.setStartPose}
        onApi={onApi}
        onInstruments={onInstruments}
        renderPanel={renderPanel}
        renderViewer={(viewer) => (
          <ViewerBox
            viewer={viewer}
            page={page}
            store={store}
            panels={panels}
            onEmptyTrack={onEmptyTrack}
            onSaveTrack={onSaveTrack}
          />
        )}
        hideControls={mobile}
      />
    </Suspense>
  );
}

/**
 * Página del simulador móvil 2D: el robot, la pista, la pose inicial y el `LineFollowerWidget`.
 * En escritorio el visor va a la izquierda y los paneles a la derecha (maqueta 04); en móvil los
 * paneles son acordeones y los controles van en la barra inferior fija (maqueta 08).
 */
export function MobileSimIsland(): JSX.Element {
  const t = useT();
  const narrow = useMediaQuery(MOBILE_MEDIA_QUERY);
  const mobile = useMounted() && narrow;
  const [openId, setOpenId] = useState<OpenPanelId>('robot');
  const page = usePageState();
  const store = useApiStore();
  // F4-03 (#129, decisión 6): las gráficas y la tarjeta de vuelta salen del widget por
  // `onInstruments` y llegan al panel «Gráficas» por su propio store, como la api por `apiStore`.
  const instruments = useInstruments();
  // #189 (decisión 2): el panel del editor viaja de la caja del visor a la columna derecha.
  const panels = useEditorPanelStore();
  const configs = useSimConfigs(page.robotId, page.applyConfig);
  // #191 (decisions 2 and 4): the saved tracks of the «Mis pistas» group. Picking one loads it as
  // the current track down the same path as a preset, and saving from the editor leaves it
  // selected.
  const tracks = useSavedTracks(page.onTrack);
  const emptyTrack = useEmptyTrackNotice();
  const [live, setLive] = useState<ControllerChoice>(page.run);
  const current = useCurrentConfig(page, live);
  const renderController = useSidePanels({
    page, t, configs, current, store, mobile, openId, setOpenId, onChoice: setLive, instruments,
    panels, tracks,
  });

  // Maqueta 04: el visor a la izquierda y la columna de tarjetas a la derecha. El widget ocupa
  // la rejilla entera porque su propia fila ya coloca el visor y el panel del controlador; las
  // tarjetas Robot, Pista y Lecturas van bajo el controlador, en esa misma columna derecha.
  //
  // `ViewerBox` entra por `renderViewer` (#158, enmienda tras auditoría de PR #169): la página
  // decide qué ocupa la caja del visor sin que `TrackEditorBox` toque el DOM interno del widget.
  return (
    <div
      className="mt-6 flex flex-col gap-5"
      style={mobile ? { paddingBottom: `${String(BOTTOM_BAR_HEIGHT_PX)}px` } : undefined}
    >
      <Simulator
        page={page}
        mobile={mobile}
        renderPanel={renderController}
        onApi={store.publish}
        onInstruments={instruments.publish}
        store={store}
        panels={panels}
        onEmptyTrack={emptyTrack.show}
        onSaveTrack={tracks.onSave}
      />
      {mobile ? <LiveBottomBar store={store} /> : null}
      <Notices configs={configs} tracks={tracks} />
      <EmptyTrackToast notice={emptyTrack} />
    </div>
  );
}
