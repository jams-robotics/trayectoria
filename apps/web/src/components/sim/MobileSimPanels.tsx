import type { JSX, ReactNode } from 'react';
import type { Translate } from '@trayectoria/i18n';
import type { LineFollowerApi } from '@trayectoria/sims';

import { useApi } from './apiStore';
import type { ApiStore } from './apiStore';
import { BottomBar } from './BottomBar';
import { RobotSource } from './RobotSource';
import { SimAccordion } from './SimAccordion';
import { TrackSource } from './TrackSource';
import type { PageState } from './useMobileSimState';

// F4-02b (#128): los paneles de `/simuladores/movil` (Robot, Pista, Lecturas y la columna
// derecha que los agrupa), separados de `MobileSimIsland.tsx` para mantener cada archivo bajo
// el límite de docs/STANDARDS.md §4.

/** Decimales del reloj en el resumen de un acordeón (docs/DESIGN.md §5). */
const CLOCK_DECIMALS = 2;

/** Qué acordeón está abierto en móvil; solo uno a la vez (docs/DESIGN.md §9.4). */
export type OpenPanelId = 'robot' | 'track' | 'controller' | 'readouts' | null;

/** Un panel de la página: en móvil va en un acordeón del grupo, en escritorio en una tarjeta. */
export function Panel({
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
      track={page.choice.track}
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
 * La columna derecha de la maqueta 04: el panel del controlador que entrega el widget y, debajo,
 * Robot, Pista y Lecturas. Va dentro del `renderPanel` del widget porque es ahí donde su propia
 * fila coloca la columna derecha, junto al visor; así el visor se queda con los 2/3 de ancho de
 * la maqueta en lugar de repartirse la celda con el panel.
 */
export function SidePanels({
  page,
  mobile,
  openId,
  setOpenId,
  t,
  controller,
  store,
}: {
  page: PageState;
  mobile: boolean;
  openId: OpenPanelId;
  setOpenId: (id: OpenPanelId) => void;
  t: Translate;
  controller: ReactNode;
  store: ApiStore;
}): JSX.Element {
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
      <ReadoutsPanel store={store} t={t} {...shared} />
    </div>
  );
}

/** La barra inferior de móvil, conectada al driver en curso; se renderiza sola en cada tick. */
export function LiveBottomBar({ store }: { store: ApiStore }): JSX.Element | null {
  const api = useApi(store);
  return api === null ? null : <BottomBar driver={api.driver} />;
}
