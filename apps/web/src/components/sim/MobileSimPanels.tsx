import { isValidElement, lazy, Suspense, useEffect } from 'react';
import type { JSX, ReactNode } from 'react';
import type { Translate } from '@trayectoria/i18n';
import type { ControllerPanelProps, LineFollowerApi, SimConfig } from '@trayectoria/sims';

import { useApi } from './apiStore';
import type { ApiStore } from './apiStore';
import { EditorColumn } from './EditorColumn';
import { useEditorPanel } from './editorPanelStore';
import type { EditorPanelStore } from './editorPanelStore';
import type { InstrumentsStore } from './instrumentsStore';
import { PlotsPanel } from './PlotsPanel';
import { BottomBar } from './BottomBar';
import { RobotSource } from './RobotSource';
import { Panel } from './SimPanel';
import type { OpenPanelId } from './SimPanel';
import { TrackSource } from './TrackSource';
import type { ControllerChoice, PageState } from './useMobileSimState';
import type { SimConfigsApi } from './useSimConfigs';

// F4-02b (#128): los paneles de `/simuladores/movil` (Robot, Pista, Lecturas y la columna
// derecha que los agrupa), separados de `MobileSimIsland.tsx` para mantener cada archivo bajo
// el límite de docs/STANDARDS.md §4. La tarjeta/acordeón que envuelve a cada uno vive en
// `SimPanel.tsx` y la columna del editor de pista en `EditorColumn.tsx` (#189).

export type { OpenPanelId } from './SimPanel';

/** Decimales del reloj en el resumen de un acordeón (docs/DESIGN.md §5). */
const CLOCK_DECIMALS = 2;

// F4-05 (#131, decisión 6): «Guardar y compartir» es un panel más de la columna. Se carga con
// `import()` como el resto de `@trayectoria/sims`, así que no entra en el JS inicial.
const LazySaveConfigPanel = lazy(async () => {
  const module = await import('@trayectoria/sims');
  return { default: module.SaveConfigPanel };
});

/**
 * El resumen en línea de «Lecturas», legible con el acordeón cerrado (docs/DESIGN.md §9.8).
 * Sale del estado que el widget publica por `onApi`, no de una copia de la simulación.
 */
export function lapSummary(api: LineFollowerApi | null, t: Translate): string | undefined {
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

/** El origen de la pista, con lo que la página tiene elegido. */
function TrackPanel({ page }: { page: PageState }): JSX.Element {
  return (
    <TrackSource
      preset={page.choice.preset}
      onPreset={page.onPreset}
      onTrack={page.onTrack}
      onEdit={page.openEditor}
      onNew={page.openNewEditor}
    />
  );
}

/**
 * «Lecturas»: el único panel que mira la simulación en vivo, y por eso el único que se vuelve a
 * renderizar en cada tick. Se suscribe al store en lugar de recibir la api por props.
 */
function ReadoutsPanel({
  store,
  t,
  mobile,
  openId,
  setOpenId,
}: {
  store: ApiStore;
  t: Translate;
  mobile: boolean;
  openId: OpenPanelId;
  setOpenId: (id: OpenPanelId) => void;
}): JSX.Element {
  const api = useApi(store);
  const summary = lapSummary(api, t);
  return (
    <Panel
      id="readouts"
      title={t('sims.mobilePage.readouts')}
      {...(summary === undefined ? {} : { summary })}
      mobile={mobile}
      openId={openId}
      setOpenId={setOpenId}
    >
      <Readouts api={api} t={t} />
    </Panel>
  );
}

/**
 * «Guardar y compartir» (F4-05): el nombre, la lista de guardadas y el enlace. La página decide
 * qué lista se muestra y dónde se guarda; aquí solo se monta el panel de `@trayectoria/sims`.
 */
function SharePanel({
  configs,
  current,
  page,
  t,
}: {
  configs: SimConfigsApi;
  current: Omit<SimConfig, 'id' | 'name'>;
  page: PageState;
  t: Translate;
}): JSX.Element {
  return (
    <Suspense fallback={<p className="text-fg-muted text-sm">{t('sims.mobilePage.loading')}</p>}>
      <LazySaveConfigPanel
        current={current}
        saved={configs.saved}
        onSave={configs.onSave}
        onLoad={page.applyConfig}
        onDelete={configs.onDelete}
        onCopied={configs.onCopied}
      />
    </Suspense>
  );
}

/**
 * El controlador y las ganancias que el panel del widget está mostrando ahora mismo. El widget
 * entrega ese panel por `renderPanel`, así que sus props son el estado en vivo de
 * `useControllerChoice`: leerlas de ahí evita duplicar el selector en la página y evita añadirle
 * api pública nueva al widget (F4-05, #131, decisión 6). Lo que no venga del panel se queda con lo
 * que la página tenía elegido.
 *
 * «Manual» no es un valor con el que la página pueda arrancar el widget (ver `PageController` en
 * `useMobileSimState.ts`), así que guardar en ese modo guarda el controlador con el que abrió.
 */
function liveChoice(panel: ReactNode): Omit<ControllerChoice, 'seed'> | null {
  if (!isValidElement<Partial<ControllerPanelProps>>(panel)) return null;
  const { controller, params } = panel.props;
  if (controller === undefined || controller === 'manual') return null;
  return { controller, params: params ?? {} };
}

/**
 * Publica hacia la página el controlador y las ganancias que el panel del widget muestra ahora
 * mismo, para que «Guardar y compartir» guarde lo que de verdad está corriendo (F4-05).
 */
function useReportedChoice(
  choice: Omit<ControllerChoice, 'seed'> | null,
  seed: number,
  onChoice: (choice: ControllerChoice) => void,
): void {
  const controller = choice?.controller;
  const params = choice?.params;
  useEffect(() => {
    if (controller === undefined || params === undefined) return;
    onChoice({ controller, params, seed });
  }, [controller, params, seed, onChoice]);
}

/**
 * La columna derecha de la maqueta 04: el panel del controlador que entrega el widget y, debajo,
 * Robot, Pista y Lecturas. Va dentro del `renderPanel` del widget porque es ahí donde su propia
 * fila coloca la columna derecha, junto al visor; así el visor se queda con los 2/3 de ancho de
 * la maqueta en lugar de repartirse la celda con el panel.
 */
export interface SidePanelsProps {
  readonly page: PageState;
  readonly mobile: boolean;
  readonly openId: OpenPanelId;
  readonly setOpenId: (id: OpenPanelId) => void;
  readonly t: Translate;
  readonly controller: ReactNode;
  readonly store: ApiStore;
  /** Las configuraciones guardadas y las acciones del panel «Guardar y compartir» (F4-05). */
  readonly configs: SimConfigsApi;
  /** La configuración en curso que ese panel guarda y comparte (F4-05). */
  readonly current: Omit<SimConfig, 'id' | 'name'>;
  /** Publica hacia la isla el controlador y las ganancias que el panel muestra (F4-05). */
  readonly onChoice: (choice: ControllerChoice) => void;
  /** Las gráficas en vivo que el widget publica por `onInstruments` (F4-03). */
  readonly instruments: InstrumentsStore;
  /** El panel numérico que el editor de pista publica mientras se edita (#189, decisión 2). */
  readonly panels: EditorPanelStore;
}

/** La columna de la simulación: el controlador del widget y las cinco tarjetas de la maqueta 04. */
function SimColumn(props: SidePanelsProps): JSX.Element {
  const { page, mobile, openId, setOpenId, t, controller, store, configs, current } = props;
  const shared = { mobile, openId, setOpenId };
  return (
    // Ancho fijo en escritorio: la columna vive en la fila flex del widget y las gráficas de
    // «Gráficas» fijan su ancho en píxeles al medir su contenedor (uPlot). Sin un ancho fijo, la
    // columna y las gráficas se persiguen —la gráfica mide, crece, la columna crece, la gráfica
    // vuelve a medir— y la maqueta nunca se asienta. `lg:w-80` es el mismo ancho que el widget
    // usa cuando lleva su propia columna (docs/DESIGN.md §9: panel lateral de 340-360 px).
    <div className="flex min-w-0 flex-col gap-4 lg:w-80 lg:shrink-0">
      <Panel id="controller" title={t('sims.mobilePage.controller')} {...shared}>
        {controller}
      </Panel>
      <Panel id="robot" title={t('sims.mobilePage.robot')} {...shared}>
        <RobotSource selected={page.robotId} onSelect={page.setRobotId} onRobot={page.setRobot} />
      </Panel>
      <Panel id="track" title={t('sims.mobilePage.track')} {...shared}>
        <TrackPanel page={page} />
      </Panel>
      <ReadoutsPanel store={store} t={t} {...shared} />
      <PlotsPanel
        store={props.instruments}
        t={t}
        pid={liveChoice(controller)?.controller === 'pid'}
        {...shared}
      />
      <Panel id="share" title={t('sims.simConfig.title')} {...shared}>
        <SharePanel configs={configs} current={current} page={page} t={t} />
      </Panel>
    </div>
  );
}

export function SidePanels(props: SidePanelsProps): JSX.Element {
  const { page, mobile, openId, setOpenId, t, controller } = props;
  const editorPanel = useEditorPanel(props.panels);
  useReportedChoice(liveChoice(controller), page.run.seed, props.onChoice);
  // #189 (decisión 2): mientras se edita la pista, la columna es solo el panel del segmento.
  if (page.view === 'editor') {
    return (
      <EditorColumn
        panel={editorPanel}
        mobile={mobile}
        openId={openId}
        setOpenId={setOpenId}
        t={t}
      />
    );
  }
  return <SimColumn {...props} />;
}

/** La barra inferior de móvil, conectada al driver en curso; se renderiza sola en cada tick. */
export function LiveBottomBar({ store }: { store: ApiStore }): JSX.Element | null {
  const api = useApi(store);
  return api === null ? null : <BottomBar driver={api.driver} />;
}
