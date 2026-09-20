import { Suspense, lazy, useCallback, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useT } from '@trayectoria/i18n';
import type { LineFollowerApi } from '@trayectoria/sims';

import { useApiStore } from './apiStore';
import type { ApiStore } from './apiStore';
import { BOTTOM_BAR_HEIGHT_PX } from './BottomBar';
import { LiveBottomBar, SidePanels } from './MobileSimPanels';
import type { OpenPanelId } from './MobileSimPanels';
import { TrackEditorBox } from './TrackEditorBox';
import { MOBILE_MEDIA_QUERY, useMediaQuery } from './useMediaQuery';
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

/** El simulador de F4-02a, resuelto solo cuando el navegador lo renderiza. */
const LazyLineFollowerWidget = lazy(async () => {
  const module = await import('@trayectoria/sims');
  return { default: module.LineFollowerWidget };
});

/** El simulador: el `LineFollowerWidget` de F4-02a con la pista, el robot y la pose de la página. */
function Simulator({
  page,
  mobile,
  renderPanel,
  onApi,
}: {
  page: ReturnType<typeof usePageState>;
  mobile: boolean;
  renderPanel: (panel: ReactNode) => ReactNode;
  onApi: (api: LineFollowerApi) => void;
}): JSX.Element {
  const t = useT();
  return (
    <div className="min-w-0">
      <Suspense
        fallback={
          <p className="text-fg-muted text-sm" role="status" aria-live="polite">
            {t('sims.mobilePage.loading')}
          </p>
        }
      >
        <LazyLineFollowerWidget
          track={page.choice.track}
          controller="pid"
          initialParams={{}}
          {...(page.robot === null ? {} : { robot: page.robot })}
          {...(page.startPose === null ? {} : { startPose: page.startPose })}
          onStartPoseChange={page.setStartPose}
          onApi={onApi}
          renderPanel={renderPanel}
          hideControls={mobile}
        />
      </Suspense>
    </div>
  );
}

/**
 * El editor de pista en la caja del visor (#158). «Volver a la simulación» reinicia la simulación
 * pausada en `t = 0`: la pista editada ya llegó al widget por `onTrack`, y el reinicio lo pide la
 * api que el widget publica, que es quien tiene el driver.
 */
function LiveTrackEditorBox({
  page,
  store,
}: {
  page: ReturnType<typeof usePageState>;
  store: ApiStore;
}): JSX.Element | null {
  const { closeEditor } = page;
  const onBack = useCallback((): void => {
    store.read()?.driver.reset();
    closeEditor();
  }, [store, closeEditor]);
  return (
    <TrackEditorBox
      open={page.view === 'editor'}
      track={page.choice.track}
      onTrack={page.onTrack}
      onBack={onBack}
    />
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

  // El widget entrega su panel del controlador aquí y la página lo devuelve dentro de la columna
  // derecha completa (maqueta 04), con Robot, Pista y Lecturas debajo.
  //
  // `renderPanel` es una prop del widget, así que un `renderController` nuevo lo vuelve a
  // renderizar; y el widget publica su estado con `onApi`, que actualiza esta página. Si el
  // callback dependiera de `page`, cada estado publicado produciría un callback nuevo y con él
  // otro render, es decir un bucle. Lo que cambia en cada estado se lee de un ref dentro del
  // propio callback, de modo que su identidad solo depende de lo que cambia la maqueta.
  const latest = useRef({ page, t });
  latest.current = { page, t };
  const renderController = useCallback(
    (panel: ReactNode): ReactNode => (
      <SidePanels
        page={latest.current.page}
        mobile={mobile}
        openId={openId}
        setOpenId={setOpenId}
        t={latest.current.t}
        controller={panel}
        store={store}
      />
    ),
    [mobile, openId, store],
  );

  // Maqueta 04: el visor a la izquierda y la columna de tarjetas a la derecha. El widget ocupa
  // la rejilla entera porque su propia fila ya coloca el visor y el panel del controlador; las
  // tarjetas Robot, Pista y Lecturas van bajo el controlador, en esa misma columna derecha.
  //
  // `TrackEditorBox` se monta en la caja del visor con un portal (#158, decisión 1), así que va
  // después del simulador: cuando se renderiza, el visor ya está en el DOM.
  return (
    <div
      className="mt-6 flex flex-col gap-5"
      style={mobile ? { paddingBottom: `${String(BOTTOM_BAR_HEIGHT_PX)}px` } : undefined}
    >
      <Simulator page={page} mobile={mobile} renderPanel={renderController} onApi={store.publish} />
      <LiveTrackEditorBox page={page} store={store} />
      {mobile ? <LiveBottomBar store={store} /> : null}
    </div>
  );
}
