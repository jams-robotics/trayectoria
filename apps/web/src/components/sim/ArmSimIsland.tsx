import { Suspense, lazy, useCallback, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Vec3_m } from '@trayectoria/widgets/scene3d';

import { ArmSource, IMPORTED_VALUE, resolveArmId, savedIdOf } from './ArmSource';
import type { ArmOption } from './ArmSource';
import { ImportUrdfDialog } from './ImportUrdfDialog';
import { SimAccordion } from './SimAccordion';
import { ViewControls } from './ArmViewControls';
import type { ViewLayers } from './ArmViewControls';
import type { AccordionGroup, OpenPanelId } from './accordionGroup';
import { MOBILE_MEDIA_QUERY, useMediaQuery } from './useMediaQuery';
import { useImportedArm } from './useImportedArm';
import type { ImportState, MemoryArm } from './useImportedArm';

// F5-01b (#134, decisions 1, 2 and 4): the island of `/simuladores/brazo`. It is
// `client:only="react"` and loads `@trayectoria/sims/arm` with a dynamic `import()`, so that
// `three` and `urdf-loader` only enter this page's chunk (docs/ARCHITECTURE.md §8). The viewer is
// the `ArmViewer` of F5-01a as is: the sliders and the end-effector panel are its own, they are
// not duplicated here.

/**
 * The viewer of F5-01a, resolved only when the browser renders it. This `import()` is the
 * single point through which `three` and `urdf-loader` enter the page (#134, decision 1).
 */
const LazyArmViewer = lazy(async () => {
  const module = await import('@trayectoria/sims/arm');
  return { default: module.ArmViewer };
});

/** The viewer layers; the page's view group turns each one on (#537). */
type ShowLayer = 'frames' | 'matrices' | 'workspace';

/** «Marcos» starts on, as it always did; the other two layers start off. */
const INITIAL_LAYERS: ViewLayers = { workspace: false, matrices: false, frames: true };

/**
 * On mobile the accordion header already names each panel, so the panel's own title is hidden
 * inside it (#542). The panels mark that title with `data-panel-title` (literal class, for Tailwind).
 */
const HIDE_PANEL_TITLE = '[&_[data-panel-title]]:hidden';

/** Reads `?robot=` from the URL. Runs only on the client: the island is `client:only`. */
function requestedArmId(): string | null {
  return new URLSearchParams(window.location.search).get('robot');
}

/** The viewer's layers according to which view controls are on (#135, #136 and #537). */
function showLayers(layers: ViewLayers): ShowLayer[] {
  const show: ShowLayer[] = [];
  if (layers.frames) show.push('frames');
  if (layers.matrices) show.push('matrices');
  if (layers.workspace) show.push('workspace');
  return show;
}

/** The panel `ArmViewer` hands to `renderPanel` (`ArmViewerPanel` of `@trayectoria/sims`). */
interface ArmViewerPanel {
  readonly id: 'joints' | 'effector' | 'matrices' | 'workspace';
  readonly title: string;
  readonly summary: string;
  readonly content: ReactNode;
}

/**
 * Wrapper of the `ArmViewer` panels (#134, decision 3). On mobile each panel goes in a
 * `SimAccordion` of the group, with only one open at a time; on desktop the panel is returned
 * as is, so the markup is that of F5-01a.
 */
function usePanelWrapper(
  mobile: boolean,
  group: AccordionGroup,
): (panel: ArmViewerPanel) => ReactNode {
  const { openId, setOpenId } = group;
  return useCallback(
    (panel) =>
      mobile ? (
        <SimAccordion
          title={panel.title}
          summary={panel.summary}
          open={openId === panel.id}
          onToggle={(open) => {
            setOpenId(open ? panel.id : null);
          }}
        >
          <div className={HIDE_PANEL_TITLE}>{panel.content}</div>
        </SimAccordion>
      ) : (
        panel.content
      ),
    [mobile, openId, setOpenId],
  );
}

/**
 * The camera offset the user left (#556). It lives in a ref, not in state: the orbit reports it on every
 * frame and the island must not re-render for that. The viewer reads it when it remounts for
 * another arm, so the zoom is kept; until the user moves it, each arm is framed at rest.
 */
function useKeptCamera(): {
  camera: { readonly current: Vec3_m | undefined };
  onCameraChange: (offset_m: Vec3_m) => void;
} {
  const camera = useRef<Vec3_m | undefined>(undefined);
  const onCameraChange = useCallback((offset_m: Vec3_m): void => {
    camera.current = offset_m;
  }, []);
  return { camera, onCameraChange };
}

/** What `Viewer` passes to every `ArmViewer`, whichever the source. */
interface ViewerOptions {
  show: ShowLayer[];
  renderPanel: (panel: ArmViewerPanel) => ReactNode;
  cameraOffset_m: Vec3_m | undefined;
  onCameraChange: (offset_m: Vec3_m) => void;
}

/**
 * The lazy viewer. Switching arms remounts it with `key`, so `q` goes back to `initialQ` or to
 * zeros (ticket criterion) without this island touching the state of `useArmSim`. An imported
 * arm arrives as `source` with its zip in memory (#137, decision 2). «Marcos» is the page's
 * (#537), so the viewer draws no button of its own.
 */
function Viewer({
  armId,
  memoryArm,
  options,
}: {
  armId: string;
  memoryArm: MemoryArm | null;
  options: ViewerOptions;
}): JSX.Element {
  const t = useT();
  const imported = memoryArm !== null;
  return (
    <Suspense
      fallback={
        // F7-02b (#444): the marker lets the island keep its loaded height while `three` loads.
        <p className="text-fg-muted text-sm" role="status" aria-live="polite" data-arm-loading>
          {t('sims.armPage.loading')}
        </p>
      }
    >
      {imported ? (
        <LazyArmViewer
          key={`imported:${memoryArm.urdfPath}`}
          source={{ kind: 'zip', bytes: memoryArm.bytes, urdfPath: memoryArm.urdfPath }}
          framesToggle={false}
          {...options}
        />
      ) : (
        <LazyArmViewer key={armId} catalogId={armId} framesToggle={false} {...options} />
      )}
    </Suspense>
  );
}

/**
 * The notice of the last import. The keys go as literals so that the static check of
 * F0-06 sees them (docs/ops/I18N.md, same pattern as `ERROR_KEYS` of `UploadUrdfForm`).
 */
function ImportNotice({ notice }: { notice: string }): JSX.Element {
  const t = useT();
  const messages: Readonly<Record<string, string>> = {
    'sims.import.saved': t('sims.import.saved'),
    'sims.import.loaded': t('sims.import.loaded'),
    'sims.import.saveFailed': t('sims.import.saveFailed'),
    'sims.import.downloadFailed': t('sims.import.downloadFailed'),
    'sims.import.loadFailed': t('sims.import.loadFailed'),
  };
  return (
    <p
      aria-live="polite"
      data-testid="import-notice"
      className="text-fg-muted m-0 min-h-[1.5em] text-sm"
    >
      {messages[notice] ?? ''}
    </p>
  );
}

/** The selector with its notice and, when open, the import dialog (#137). */
function SourceRow({
  arms,
  selected,
  fallback,
  importing,
  onSelect,
}: {
  arms: readonly ArmOption[];
  selected: string;
  fallback: boolean;
  importing: ImportState;
  onSelect: (value: string) => void;
}): JSX.Element {
  return (
    <>
      <ArmSource
        arms={arms}
        selected={selected}
        fallback={fallback}
        savedArms={importing.savedArms}
        importedName={importing.memoryArm?.name ?? null}
        onSelect={onSelect}
        onImport={importing.openDialog}
      />
      <ImportNotice notice={importing.notice} />
      {importing.dialogOpen ? (
        <ImportUrdfDialog
          signedIn={importing.signedIn}
          onAccept={importing.accept}
          onClose={importing.closeDialog}
        />
      ) : null}
    </>
  );
}

/**
 * What each selector option does (#137, decision 3): a catalogue arm changes the URL, a saved
 * one is downloaded from its own bucket and the in-memory imported one is just shown again.
 */
function useArmSelection(options: {
  armId: string;
  setArmId: (id: string) => void;
  setSelected: (value: string) => void;
  setFallback: (shown: boolean) => void;
  importing: ImportState;
}): (value: string) => void {
  const { armId, setArmId, setSelected, setFallback, importing } = options;
  return useCallback(
    (value: string): void => {
      if (value === IMPORTED_VALUE) {
        setSelected(value);
        return;
      }
      if (savedIdOf(value) !== null) {
        setSelected(value);
        void importing.selectSaved(value).then((ok) => {
          if (!ok) setSelected(armId);
        });
        return;
      }
      importing.clearMemoryArm();
      setArmId(value);
      setSelected(value);
      setFallback(false);
      const url = new URL(window.location.href);
      url.searchParams.set('robot', value);
      window.history.replaceState(null, '', url);
    },
    [armId, setArmId, setSelected, setFallback, importing],
  );
}

export interface ArmSimIslandProps {
  /** Arms of the `arms` collection, resolved at build time by `brazo.astro`. */
  arms: readonly ArmOption[];
}

/**
 * The arm the page shows: the catalogue one requested in `?robot=`, a saved one or the
 * in-memory imported one. `?robot=` is read on the client (`window` is allowed in `apps/web`,
 * CLAUDE.md) because the page is static and `Astro.url.searchParams` does not see a query
 * string added after the build.
 */
function useArmPage(arms: readonly ArmOption[]): {
  armId: string;
  selected: string;
  fallback: boolean;
  importing: ImportState;
  onSelect: (value: string) => void;
} {
  const requested = requestedArmId();
  const [armId, setArmId] = useState(() => resolveArmId(requested, arms));
  // The notice only appears if the URL asked for a specific arm that is not in the catalogue.
  const [fallback, setFallback] = useState(
    () => requested !== null && !arms.some((arm) => arm.id === requested),
  );
  // «Importar…» and «Mis robots» are F5-04 (#137, decisions 3, 4 and 5); the imported arm is
  // drawn from its in-memory zip and the selector stays on its own option.
  const [selected, setSelected] = useState(armId);
  const importing = useImportedArm(setSelected);
  const onSelect = useArmSelection({ armId, setArmId, setSelected, setFallback, importing });
  return { armId, selected, fallback, importing, onSelect };
}

/** Arm simulator page: selector, view controls and the 3D viewer. */
export function ArmSimIsland({ arms }: ArmSimIslandProps): JSX.Element {
  const { armId, selected, fallback, importing, onSelect } = useArmPage(arms);

  // On mobile the page's three blocks are accordions with only one open at a time
  // (docs/DESIGN.md §9.4, #134 decision 3); «Articulaciones» starts open.
  const mobile = useMediaQuery(MOBILE_MEDIA_QUERY);
  const [openId, setOpenId] = useState<OpenPanelId>('joints');
  const group: AccordionGroup = { openId, setOpenId };
  const renderPanel = usePanelWrapper(mobile, group);
  // The controls turn on the viewer's layers; their state does not go in the URL (#135 and #136).
  const [layers, setLayers] = useState<ViewLayers>(INITIAL_LAYERS);
  const onLayer = useCallback((id: keyof ViewLayers, on: boolean): void => {
    setLayers((current) => ({ ...current, [id]: on }));
  }, []);
  const { camera, onCameraChange } = useKeptCamera();

  // F7-02b (#444): keeps the loaded height (≥ 758 px) while `three` or the arm loads.
  const loading = 'has-[[data-arm-loading],[data-testid=arm-viewer-status]]:min-h-[740px]';
  return (
    <div className={`mt-6 flex flex-col gap-5 ${loading}`}>
      <SourceRow
        arms={arms}
        selected={selected}
        fallback={fallback}
        importing={importing}
        onSelect={onSelect}
      />

      <ViewControls mobile={mobile} group={group} layers={layers} onLayer={onLayer} />
      <Viewer
        armId={armId}
        memoryArm={selected === IMPORTED_VALUE || savedIdOf(selected) !== null
          ? importing.memoryArm
          : null}
        options={{
          show: showLayers(layers),
          renderPanel,
          cameraOffset_m: camera.current,
          onCameraChange,
        }}
      />
    </div>
  );
}
