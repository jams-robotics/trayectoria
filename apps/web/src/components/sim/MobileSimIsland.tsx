import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';
import type { LineFollowerApi, StartPose, TrackJson, TrackPreset } from '@trayectoria/sims';
import type { RobotSpec } from '@trayectoria/widgets';

import { BOTTOM_BAR_HEIGHT_PX, BottomBar } from './BottomBar';
import { MY_ROBOT_ID, RobotSource } from './RobotSource';
import { SimAccordion } from './SimAccordion';
import { TrackSource } from './TrackSource';
import { MOBILE_MEDIA_QUERY, useMediaQuery } from './useMediaQuery';

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

/**
 * Si el primer render ya ocurrió en el navegador. `useMediaQuery` consulta `matchMedia`, que en
 * el servidor no existe: esta isla es `client:visible` (#128, decisión 1), así que Astro la
 * renderiza también en build y el primer render del cliente debe coincidir con aquel. Hasta que
 * monta, la página se dibuja con la maqueta de escritorio, que es la que el servidor produjo.
 */
function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

/** El simulador de F4-02a, resuelto solo cuando el navegador lo renderiza. */
const LazyLineFollowerWidget = lazy(async () => {
  const module = await import('@trayectoria/sims');
  return { default: module.LineFollowerWidget };
});

/** Preset con el que abre la página (criterio del ticket: óvalo). */
const DEFAULT_PRESET: TrackPreset = 'oval';

/** Decimales del reloj en el resumen de un acordeón (docs/DESIGN.md §5). */
const CLOCK_DECIMALS = 2;

/** Qué acordeón está abierto en móvil; solo uno a la vez (docs/DESIGN.md §9.4). */
type OpenPanelId = 'robot' | 'track' | 'controller' | 'readouts' | null;

/** La pista efectiva y el preset del selector; el editor y «Cargar JSON» solo cambian la pista. */
interface TrackChoice {
  readonly preset: TrackPreset;
  readonly track: TrackJson;
}

/**
 * La pose inicial de una pista: el arranque del recorrido mientras nadie arrastre el asa. Se
 * resuelve con el módulo ya cargado, así que devuelve `null` hasta que `@trayectoria/sims` esté
 * en memoria; mientras tanto el widget arranca el robot donde empieza la pista, que es lo mismo.
 */
async function initialPose(track: TrackJson): Promise<StartPose> {
  const { poseOnTrack, resolveTrack } = await import('@trayectoria/sims');
  return poseOnTrack(resolveTrack(track), null, 0);
}

/** Un panel de la página: en móvil va en un acordeón del grupo, en escritorio en una tarjeta. */
function Panel({
  id,
  title,
  summary,
  mobile,
  openId,
  setOpenId,
  children,
}: {
  id: Exclude<OpenPanelId, null>;
  title: string;
  summary?: string;
  mobile: boolean;
  openId: OpenPanelId;
  setOpenId: (id: OpenPanelId) => void;
  children: ReactNode;
}): JSX.Element {
  if (mobile) {
    return (
      <SimAccordion
        title={title}
        {...(summary === undefined ? {} : { summary })}
        open={openId === id}
        onToggle={(open) => {
          setOpenId(open ? id : null);
        }}
      >
        {children}
      </SimAccordion>
    );
  }
  return (
    <section className="border-border bg-bg-raised rounded-lg border p-4" data-testid={`panel-${id}`}>
      <h2 className="text-fg mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/**
 * El resumen en línea de «Lecturas», legible con el acordeón cerrado (docs/DESIGN.md §9.8).
 * Sale del estado que el widget publica por `onApi`, no de una copia de la simulación.
 */
function lapSummary(api: LineFollowerApi | null, t: Translate): string | undefined {
  if (api === null) return undefined;
  return t('sims.mobilePage.summaryLaps', {
    laps: api.state.laps,
    time: api.state.robot.t_s.toFixed(CLOCK_DECIMALS),
  });
}

/**
 * El panel «Lecturas» de la maqueta 04: las vueltas, el reloj y la velocidad en vivo. Las
 * lecturas completas del arreglo y la pose las sigue mostrando el propio visor del widget; aquí
 * va el resumen que la maqueta pone a la derecha.
 */
function Readouts({ api, t }: { api: LineFollowerApi | null; t: Translate }): JSX.Element {
  if (api === null) {
    return <p className="text-fg-muted text-sm">{t('sims.mobilePage.readoutsEmpty')}</p>;
  }
  const rows: ReadonlyArray<readonly [string, string]> = [
    [t('sims.lineFollower.readout.laps'), String(api.state.laps)],
    [t('sims.lineFollower.readout.t'), `${api.state.robot.t_s.toFixed(CLOCK_DECIMALS)} s`],
    [t('sims.lineFollower.readout.v'), `${api.state.robot.v_mps.toFixed(CLOCK_DECIMALS)} m/s`],
  ];
  return (
    <dl
      className="text-fg-muted grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs tabular-nums"
      data-testid="mobile-page-readouts"
    >
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Lo que la isla elige y publica; un solo objeto para no repartir seis `useState` por la vista. */
interface PageState {
  readonly robotId: string;
  readonly setRobotId: (id: string) => void;
  readonly robot: RobotSpec | null;
  readonly setRobot: (spec: RobotSpec) => void;
  readonly choice: TrackChoice;
  readonly startPose: StartPose | null;
  readonly setStartPose: (pose: StartPose) => void;
  readonly api: LineFollowerApi | null;
  readonly setApi: (api: LineFollowerApi) => void;
  readonly onTrack: (track: TrackJson) => void;
  readonly onPreset: (preset: TrackPreset) => void;
}

/** El estado de la página: el robot, la pista, la pose inicial y la simulación en curso. */
function usePageState(): PageState {
  const [robotId, setRobotId] = useState(MY_ROBOT_ID);
  const [robot, setRobot] = useState<RobotSpec | null>(null);
  const [choice, setChoice] = useState<TrackChoice>({
    preset: DEFAULT_PRESET,
    track: DEFAULT_PRESET,
  });
  const [startPose, setStartPose] = useState<StartPose | null>(null);
  const [api, setApi] = useState<LineFollowerApi | null>(null);

  // Cambiar la pista reinicia la simulación (el widget la reconstruye) y devuelve la pose inicial
  // al arranque del nuevo recorrido: la de la pista anterior no tiene sentido sobre esta.
  const onTrack = useCallback((track: TrackJson): void => {
    setChoice((current) => ({ ...current, track }));
    void initialPose(track).then(setStartPose);
  }, []);

  // La pose de apertura, en cuanto el módulo del simulador esté cargado.
  useEffect(() => {
    let live = true;
    void initialPose(DEFAULT_PRESET).then((pose) => {
      if (live) setStartPose(pose);
    });
    return () => {
      live = false;
    };
  }, []);
  const onPreset = useCallback((preset: TrackPreset): void => {
    setChoice((current) => ({ ...current, preset }));
  }, []);

  return {
    robotId,
    setRobotId,
    robot,
    setRobot,
    choice,
    startPose,
    setStartPose,
    api,
    setApi,
    onTrack,
    onPreset,
  };
}

/** El origen de la pista, con lo que la página tiene elegido. */
function TrackPanel({ page }: { page: PageState }): JSX.Element {
  return (
    <TrackSource
      preset={page.choice.preset}
      onPreset={page.onPreset}
      onTrack={page.onTrack}
      track={page.choice.track}
    />
  );
}

/**
 * La columna derecha de la maqueta 04: el panel del controlador que entrega el widget y, debajo,
 * Robot, Pista y Lecturas. Va dentro del `renderPanel` del widget porque es ahí donde su propia
 * fila coloca la columna derecha, junto al visor; así el visor se queda con los 2/3 de ancho de
 * la maqueta en lugar de repartirse la celda con el panel.
 */
function SidePanels({
  page,
  mobile,
  openId,
  setOpenId,
  t,
  controller,
}: {
  page: PageState;
  mobile: boolean;
  openId: OpenPanelId;
  setOpenId: (id: OpenPanelId) => void;
  t: Translate;
  controller: ReactNode;
}): JSX.Element {
  const summary = lapSummary(page.api, t);
  const shared = { mobile, openId, setOpenId };
  return (
    <div className="flex flex-col gap-4">
      <Panel id="controller" title={t('sims.mobilePage.controller')} {...shared}>
        {controller}
      </Panel>
      <Panel id="robot" title={t('sims.mobilePage.robot')} {...shared}>
        <RobotSource selected={page.robotId} onSelect={page.setRobotId} onRobot={page.setRobot} />
      </Panel>
      <Panel id="track" title={t('sims.mobilePage.track')} {...shared}>
        <TrackPanel page={page} />
      </Panel>
      <Panel
        id="readouts"
        title={t('sims.mobilePage.readouts')}
        {...(summary === undefined ? {} : { summary })}
        {...shared}
      >
        <Readouts api={page.api} t={t} />
      </Panel>
    </div>
  );
}

/** El simulador: el `LineFollowerWidget` de F4-02a con la pista, el robot y la pose de la página. */
function Simulator({
  page,
  mobile,
  renderPanel,
}: {
  page: PageState;
  mobile: boolean;
  renderPanel: (panel: ReactNode) => ReactNode;
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
          onApi={page.setApi}
          renderPanel={renderPanel}
          hideControls={mobile}
        />
      </Suspense>
    </div>
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

  // El widget entrega su panel del controlador aquí y la página lo devuelve dentro de la columna
  // derecha completa (maqueta 04), con Robot, Pista y Lecturas debajo.
  const renderController = useCallback(
    (panel: ReactNode): ReactNode => (
      <SidePanels
        page={page}
        mobile={mobile}
        openId={openId}
        setOpenId={setOpenId}
        t={t}
        controller={panel}
      />
    ),
    [page, mobile, openId, t],
  );

  // Maqueta 04: el visor a la izquierda y la columna de tarjetas a la derecha. El widget ocupa
  // la rejilla entera porque su propia fila ya coloca el visor y el panel del controlador; las
  // tarjetas Robot, Pista y Lecturas van bajo el controlador, en esa misma columna derecha.
  return (
    <div
      className="mt-6 flex flex-col gap-5"
      style={mobile ? { paddingBottom: `${String(BOTTOM_BAR_HEIGHT_PX)}px` } : undefined}
    >
      <Simulator page={page} mobile={mobile} renderPanel={renderController} />
      {mobile && page.api !== null ? <BottomBar driver={page.api.driver} /> : null}
    </div>
  );
}
