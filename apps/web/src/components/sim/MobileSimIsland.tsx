import { Suspense, lazy, useCallback, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useT } from '@trayectoria/i18n';
import { Toast } from '@trayectoria/widgets/Toast';
import type { LineFollowerApi, LiveInstruments, SimConfig } from '@trayectoria/sims';

import { useApiStore } from './apiStore';
import type { ApiStore } from './apiStore';
import { useEditorPanelStore } from './editorPanelStore';
import type { EditorPanelStore } from './editorPanelStore';
import { EmptyTrackToast, useEmptyTrackNotice } from './EmptyTrackNotice';
import { useInstruments } from './instrumentsStore';
import { LiveBottomBar, SidePanels } from './MobileSimPanels';
import { useDesktopPlots } from './PlotsPanel';
import type { OpenPanelId, SidePanelsProps } from './MobileSimPanels';
import { ViewerBox } from './ViewerBox';
import { MOBILE_MEDIA_QUERY, useMediaQuery } from './useMediaQuery';
import { useSavedTracks } from './useSavedTracks';
import type { SavedTracksApi } from './useSavedTracks';
import { useSimConfigs } from './useSimConfigs';
import type { SimConfigsApi } from './useSimConfigs';
import type { ControllerChoice, PageState } from './useMobileSimState';
import { useMounted, usePageState } from './useMobileSimState';

// F4-02b (#128, decisions 1, 2 and 4): the island of `/simuladores/movil`. It is `client:visible`
// and does not import `three`: the simulator is the `LineFollowerWidget` of F4-02a as is, and this
// island only composes around it the robot source, the track source, the initial pose and the
// desktop (04) and mobile (08) mockups.
//
// `@trayectoria/sims` is loaded with `import()`, not statically (same pattern as
// `ArmSimIsland` of F5-01b): its `index.ts` also re-exports `SimGallery` with the playground
// stories, and bringing them into the initial chunk left the page at 252 kB compressed, above
// the budget of docs/ARCHITECTURE.md §8. Loaded separately, the initial JS drops to what the
// page needs to paint itself and the simulator comes in as soon as its chunk resolves.
//
// The page state lives in `useMobileSimState.ts` and the panels (Robot, Pista, Lecturas and
// the right column that groups them) in `MobileSimPanels.tsx`; this file only composes both
// with the `LineFollowerWidget` (docs/STANDARDS.md §4, file size limit).

// F4-05 (#131, decisions 6 and 7): the island is also the one that reads `?c=` on mount, composes
// the running `SimConfig` and decides where it is saved (local or the robot's row), in
// `useSimConfigs.ts`. The «Guardar y compartir» panel is one more in the right column.

/** The F4-02a simulator, resolved only when the browser renders it. */
const LazyLineFollowerWidget = lazy(async () => {
  const module = await import('@trayectoria/sims');
  return { default: module.LineFollowerWidget };
});

/**
 * The running configuration, stable while no value changes. `SaveConfigPanel` uses it to
 * encode the link in an effect, so a new object on every render would re-encode it
 * endlessly: it is compared by its JSON and another one is returned only when it truly differs.
 */
function useStableConfig(config: Omit<SimConfig, 'id' | 'name'>): Omit<SimConfig, 'id' | 'name'> {
  const kept = useRef(config);
  if (JSON.stringify(kept.current) !== JSON.stringify(config)) kept.current = config;
  return kept.current;
}

/**
 * What «Guardar y compartir» saves and shares: the page's track and the controller, the
 * parameters and the seed the widget runs with. The track travels as the chosen preset
 * while it has not been edited, and as the editor's JSON as soon as it has (F4-05, decision 2).
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
 * The `renderPanel` the island gives the widget: the widget hands its controller panel there and
 * the page returns it inside the complete right column (mockup 04), with Robot, Pista,
 * Lecturas and «Guardar y compartir» below.
 *
 * `renderPanel` is a widget prop, so a new callback re-renders it; and the widget publishes its
 * state with `onApi`, which updates this page. If the callback depended on the state, every
 * published state would produce a new callback and with it another render, that is, a loop.
 * What changes on every state is read from a ref inside the callback itself, so that its
 * identity only depends on what changes the mockup.
 */
function useSidePanels(
  props: Omit<SidePanelsProps, 'controller' | 'onPlotsPid'>,
): [(panel: ReactNode) => ReactNode, ReactNode] {
  const { mobile, openId, setOpenId, store, onChoice, instruments, panels } = props;
  // #375: on desktop «Gráficas» goes under the viewer; the right column reports the PID flag.
  const desktop = !mobile && props.page.view !== 'editor';
  const plots = useDesktopPlots(instruments, desktop, props.t, openId, setOpenId);
  const onPlotsPid = plots.onPid;
  const latest = useRef(props);
  latest.current = props;
  const renderPanel = useCallback(
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
        onPlotsPid={onPlotsPid}
      />
    ),
    [mobile, openId, setOpenId, store, onChoice, instruments, panels, onPlotsPid],
  );
  return [renderPanel, plots.node];
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

/** The track, controller, robot and pose the page opens the run with. */
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

/** What the island passes the simulator: the page, the mockup and the three output channels. */
interface SimulatorProps {
  readonly page: ReturnType<typeof usePageState>;
  readonly mobile: boolean;
  readonly renderPanel: (panel: ReactNode) => ReactNode;
  readonly onApi: (api: LineFollowerApi) => void;
  readonly onInstruments: (instruments: LiveInstruments) => void;
  readonly store: ApiStore;
  readonly panels: EditorPanelStore;
  /** Called when coming back from the editor with a canvas without segments (#190, decision 3). */
  readonly onEmptyTrack: () => void;
  /** «Guardar» of the editor: the track goes to the account or to the browser (#191, decision 3). */
  readonly onSaveTrack: SavedTracksApi['onSave'];
  /** «Gráficas» under the viewer on desktop (#375), or `null`. */
  readonly plots: ReactNode;
}

/** The notice shown while the simulator chunk resolves. */
function SimulatorFallback(): JSX.Element {
  const t = useT();
  // F7-02b (#444): the notice reserves the space of the simulator, which is always taller
  // (≥ 999 px), so the page does not grow past the viewport and shift sideways when the
  // scrollbar appears on load. Only the loading state changes; the loaded page does not.
  return (
    <p className="text-fg-muted min-h-[720px] text-sm" role="status" aria-live="polite">
      {t('sims.mobilePage.loading')}
    </p>
  );
}

/** The simulator: the `LineFollowerWidget` of F4-02a with the page's track, robot and pose. */
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
  plots,
}: SimulatorProps): JSX.Element {
  // #249: the widget only mounts in the browser. Server-rendered, React emitted it
  // in full inside a `<div hidden>` waiting to be revealed; hydration repainted it on the
  // client and for an instant there were two viewers in the DOM, with the same `data-testid`.
  const mounted = useMounted();
  if (!mounted) return <SimulatorFallback />;
  return (
    <Suspense fallback={<SimulatorFallback />}>
      <LazyLineFollowerWidget
        // F4-05: loading a configuration bumps `configKey` and the widget remounts with the
        // new controller, parameters and seed; `useControllerChoice` reads them on
        // mount, so without the `key` the loaded configuration would never reach the controls.
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
            plots={plots}
          />
        )}
        hideControls={mobile}
      />
    </Suspense>
  );
}

/**
 * 2D mobile simulator page: the robot, the track, the initial pose and the `LineFollowerWidget`.
 * On desktop the viewer goes on the left and the panels on the right (mockup 04); on mobile the
 * panels are accordions and the controls go in the fixed bottom bar (mockup 08).
 */
export function MobileSimIsland(): JSX.Element {
  const t = useT();
  const narrow = useMediaQuery(MOBILE_MEDIA_QUERY);
  const mobile = useMounted() && narrow;
  const [openId, setOpenId] = useState<OpenPanelId>('robot');
  const page = usePageState();
  const store = useApiStore();
  // F4-03 (#129, decision 6): the plots and the lap card come out of the widget through
  // `onInstruments` and reach the «Gráficas» panel through their own store, like the api via `apiStore`.
  const instruments = useInstruments();
  // #189 (decision 2): the editor panel travels from the viewer box to the right column.
  const panels = useEditorPanelStore();
  const configs = useSimConfigs(page.robotId, page.applyConfig);
  // #191 (decisions 2 and 4): the saved tracks of the «Mis pistas» group. Picking one loads it as
  // the current track down the same path as a preset, and saving from the editor leaves it
  // selected.
  const tracks = useSavedTracks(page.onTrack);
  const emptyTrack = useEmptyTrackNotice();
  const [live, setLive] = useState<ControllerChoice>(page.run);
  const [renderController, plots] = useSidePanels({
    page, t, configs, current: useCurrentConfig(page, live), store, mobile, openId, setOpenId,
    onChoice: setLive, instruments, panels, tracks,
  });

  // Mockup 04: the viewer on the left and the column of cards on the right. The widget takes
  // the whole grid because its own row already places the viewer and the controller panel; the
  // Robot, Pista and Lecturas cards go under the controller, in that same right column.
  //
  // `ViewerBox` comes in through `renderViewer` (#158, amendment after the audit of PR #169): the
  // page decides what fills the viewer box without `TrackEditorBox` touching the widget's inner DOM.
  return (
    <div className="mt-6 flex flex-col gap-5">
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
        plots={plots}
      />
      <Notices configs={configs} tracks={tracks} />
      <EmptyTrackToast notice={emptyTrack} />
      {/* #531: at the end of the island's flow, `sticky bottom-0` inside `BottomBar`, so it never
          overlaps the layout's own footer. */}
      {mobile ? <LiveBottomBar store={store} /> : null}
    </div>
  );
}
