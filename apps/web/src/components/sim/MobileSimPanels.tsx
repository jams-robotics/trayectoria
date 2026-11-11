import { isValidElement, lazy, Suspense, useEffect } from 'react';
import type { JSX, ReactNode } from 'react';
import type { Translate } from '@trayectoria/i18n';
import type { ControllerPanelProps, SimConfig } from '@trayectoria/sims';

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
import type { SavedTracksApi } from './useSavedTracks';
import type { SimConfigsApi } from './useSimConfigs';

// F4-02b (#128): the panels of `/simuladores/movil` (Robot, Pista and the right
// column that groups them), split from `MobileSimIsland.tsx` to keep each file under
// the limit of docs/STANDARDS.md §4. The card/accordion that wraps each one lives in
// `SimPanel.tsx` and the track editor column in `EditorColumn.tsx` (#189).

export type { OpenPanelId } from './SimPanel';

// F4-05 (#131, decision 6): «Guardar y compartir» is one more panel of the column. It is loaded
// with `import()` like the rest of `@trayectoria/sims`, so it does not enter the initial JS.
const LazySaveConfigPanel = lazy(async () => {
  const module = await import('@trayectoria/sims');
  return { default: module.SaveConfigPanel };
});

/** Where the track comes from: what the page has picked and its saved tracks (#191). */
function TrackPanel({ page, tracks }: { page: PageState; tracks: SavedTracksApi }): JSX.Element {
  return (
    <TrackSource
      preset={page.choice.preset}
      onPreset={page.onPreset}
      onTrack={page.onTrack}
      onEdit={page.openEditor}
      onNew={page.openNewEditor}
      saved={tracks.saved}
      savedId={tracks.selectedId}
      onSaved={tracks.onSelect}
      onDeleteSaved={tracks.onDelete}
    />
  );
}

/**
 * «Guardar y compartir» (F4-05): the name, the list of saved ones and the link. The page decides
 * which list is shown and where it is saved; here only the `@trayectoria/sims` panel is mounted.
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
 * The controller and the gains the widget's panel is showing right now. The widget
 * hands that panel over through `renderPanel`, so its props are the live state of
 * `useControllerChoice`: reading them from there avoids duplicating the selector in the page and
 * avoids adding new public api to the widget (F4-05, #131, decision 6). Whatever does not come
 * from the panel keeps what the page had picked.
 *
 * «Manual» is not a value the page can start the widget with (see `PageController` in
 * `useMobileSimState.ts`), so saving in that mode saves the controller it opened with.
 */
function liveChoice(panel: ReactNode): Omit<ControllerChoice, 'seed'> | null {
  if (!isValidElement<Partial<ControllerPanelProps>>(panel)) return null;
  const { controller, params } = panel.props;
  if (controller === undefined || controller === 'manual') return null;
  return { controller, params: params ?? {} };
}

/**
 * Publishes to the page the controller and the gains the widget's panel shows right
 * now, so that «Guardar y compartir» saves what is really running (F4-05).
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
 * The right column of mockup 04: the controller panel the widget hands over and, below,
 * Robot and Pista. It goes inside the widget's `renderPanel` because that is where its
 * own row places the right column, next to the viewer; that way the viewer keeps 2/3 of the
 * mockup's width instead of sharing the cell with the panel.
 */
export interface SidePanelsProps {
  readonly page: PageState;
  readonly mobile: boolean;
  readonly openId: OpenPanelId;
  readonly setOpenId: (id: OpenPanelId) => void;
  readonly t: Translate;
  readonly controller: ReactNode;
  readonly store: ApiStore;
  /** The saved configurations and the actions of the «Guardar y compartir» panel (F4-05). */
  readonly configs: SimConfigsApi;
  /** The running configuration that panel saves and shares (F4-05). */
  readonly current: Omit<SimConfig, 'id' | 'name'>;
  /** Publishes to the island the controller and the gains the panel shows (F4-05). */
  readonly onChoice: (choice: ControllerChoice) => void;
  /** The live plots the widget publishes through `onInstruments` (F4-03). */
  readonly instruments: InstrumentsStore;
  /** The numeric panel the track editor publishes while editing (#189, decision 2). */
  readonly panels: EditorPanelStore;
  /** The saved tracks of the «Mis pistas» group of the Pista panel (#191, decision 4). */
  readonly tracks: SavedTracksApi;
  /** Reports whether «Gráficas» shows the PID plot, for the desktop charts (#375). */
  readonly onPlotsPid: (pid: boolean) => void;
}

/** The simulation column: the widget's controller and the five cards of mockup 04. */
function SimColumn(props: SidePanelsProps): JSX.Element {
  const { page, mobile, openId, setOpenId, t, controller, configs, current } = props;
  const shared = { mobile, openId, setOpenId };
  return (
    // Fixed width on desktop: the column lives in the widget's flex row and the «Gráficas»
    // charts fix their width in pixels by measuring their container (uPlot). Without a fixed
    // width, the column and the charts chase each other —the chart measures, grows, the column
    // grows, the chart measures again— and the mockup never settles. `lg:w-panel` is the same
    // width the widget uses when it carries its own column (docs/DESIGN.md §9: side panel of
    // 340-360 px).
    <div className="flex min-w-0 flex-col gap-4 lg:w-panel lg:shrink-0">
      <Panel id="controller" title={t('sims.mobilePage.controller')} {...shared}>
        {controller}
      </Panel>
      <Panel id="robot" title={t('sims.mobilePage.robot')} {...shared}>
        <RobotSource selected={page.robotId} onSelect={page.setRobotId} onRobot={page.setRobot} />
      </Panel>
      <Panel id="track" title={t('sims.mobilePage.track')} {...shared}>
        <TrackPanel page={page} tracks={props.tracks} />
      </Panel>
      {/* #375: on desktop «Gráficas» lives under the viewer, in the sticky left column. */}
      {mobile ? (
        <PlotsPanel
          store={props.instruments}
          t={t}
          pid={liveChoice(controller)?.controller === 'pid'}
          {...shared}
        />
      ) : null}
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
  const pid = liveChoice(controller)?.controller === 'pid';
  const { onPlotsPid } = props;
  useEffect(() => {
    onPlotsPid(pid);
  }, [pid, onPlotsPid]);
  // #189 (decision 2): while the track is being edited, the column is only the segment panel.
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

/** The mobile bottom bar, wired to the running driver; it re-renders on its own on every tick. */
export function LiveBottomBar({ store }: { store: ApiStore }): JSX.Element | null {
  const api = useApi(store);
  return api === null ? null : <BottomBar driver={api.driver} />;
}
