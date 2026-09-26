import { Suspense, lazy, useCallback, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useT } from '@trayectoria/i18n';

import { ArmSource, IMPORTED_VALUE, resolveArmId, savedIdOf } from './ArmSource';
import type { ArmOption } from './ArmSource';
import { ImportUrdfDialog } from './ImportUrdfDialog';
import { SimAccordion } from './SimAccordion';
import { ViewControls } from './ArmViewControls';
import type { AccordionGroup, OpenPanelId } from './accordionGroup';
import { MOBILE_MEDIA_QUERY, useMediaQuery } from './useMediaQuery';
import { useImportedArm } from './useImportedArm';
import type { ImportState, MemoryArm } from './useImportedArm';

// F5-01b (#134, decisiones 1, 2 y 4): la isla de `/simuladores/brazo`. Es `client:only="react"`
// y carga `@trayectoria/sims/arm` con un `import()` dinámico, de modo que `three` y
// `urdf-loader` solo entran en el chunk de esta página (docs/ARCHITECTURE.md §8). El visor es el
// `ArmViewer` de F5-01a tal cual: los sliders y el panel del efector son suyos, aquí no se
// duplican.

/**
 * El visor de F5-01a, resuelto solo cuando el navegador lo renderiza. Este `import()` es el
 * único punto por el que `three` y `urdf-loader` entran en la página (#134, decisión 1).
 */
const LazyArmViewer = lazy(async () => {
  const module = await import('@trayectoria/sims/arm');
  return { default: module.ArmViewer };
});

/** Capa de los marcos, siempre activa; las otras dos las encienden los controles de vista. */
type ShowLayer = 'frames' | 'matrices' | 'workspace';

/** Lee `?robot=` de la URL. Solo se ejecuta en el cliente: la isla es `client:only`. */
function requestedArmId(): string | null {
  return new URLSearchParams(window.location.search).get('robot');
}

/** Las capas del visor según qué controles de vista estén encendidos (#135 y #136). */
function showLayers(matrices: boolean, workspace: boolean): ShowLayer[] {
  const layers: ShowLayer[] = ['frames'];
  if (matrices) layers.push('matrices');
  if (workspace) layers.push('workspace');
  return layers;
}

/** El panel que `ArmViewer` entrega a `renderPanel` (`ArmViewerPanel` de `@trayectoria/sims`). */
interface ArmViewerPanel {
  readonly id: 'joints' | 'effector' | 'matrices' | 'workspace';
  readonly title: string;
  readonly summary: string;
  readonly content: ReactNode;
}

/**
 * Envoltorio de los paneles de `ArmViewer` (#134, decisión 3). En móvil cada panel va en un
 * `SimAccordion` del grupo, con uno solo abierto a la vez; en escritorio se devuelve el panel
 * tal cual, de modo que el marcado es el de F5-01a.
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
          {panel.content}
        </SimAccordion>
      ) : (
        panel.content
      ),
    [mobile, openId, setOpenId],
  );
}

/**
 * El visor perezoso. Cambiar de brazo lo remonta con `key`, así que `q` vuelve a `initialQ` o a
 * ceros (criterio del ticket) sin que esta isla toque el estado de `useArmSim`. Un brazo
 * importado llega como `source` con su zip en memoria (#137, decisión 2).
 */
function Viewer({
  armId,
  memoryArm,
  show,
  renderPanel,
}: {
  armId: string;
  memoryArm: MemoryArm | null;
  show: ShowLayer[];
  renderPanel: (panel: ArmViewerPanel) => ReactNode;
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
          show={show}
          renderPanel={renderPanel}
        />
      ) : (
        <LazyArmViewer key={armId} catalogId={armId} show={show} renderPanel={renderPanel} />
      )}
    </Suspense>
  );
}

/**
 * El aviso de la última importación. Las claves van como literales para que el chequeo estático de
 * F0-06 las vea (docs/ops/I18N.md, mismo patrón que `ERROR_KEYS` de `UploadUrdfForm`).
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

/** El selector con su aviso y, cuando está abierto, el diálogo de importación (#137). */
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
 * Qué hace cada opción del selector (#137, decisión 3): un brazo del catálogo cambia la URL, uno
 * guardado se descarga del propio bucket y el importado en memoria solo se vuelve a mostrar.
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
  /** Brazos de la colección `arms`, resueltos en build por `brazo.astro`. */
  arms: readonly ArmOption[];
}

/**
 * El brazo que la página muestra: el del catálogo pedido en `?robot=`, uno guardado o el
 * importado en memoria. `?robot=` se lee en el cliente (`window` está permitido en `apps/web`,
 * CLAUDE.md) porque la página es estática y `Astro.url.searchParams` no ve una cadena añadida
 * tras el build.
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
  // El aviso solo aparece si la URL pedía un brazo concreto que no existe en el catálogo.
  const [fallback, setFallback] = useState(
    () => requested !== null && !arms.some((arm) => arm.id === requested),
  );
  // «Importar…» y «Mis robots» son F5-04 (#137, decisiones 3, 4 y 5); el brazo importado se
  // dibuja desde su zip en memoria y el selector se queda en su propia opción.
  const [selected, setSelected] = useState(armId);
  const importing = useImportedArm(setSelected);
  const onSelect = useArmSelection({ armId, setArmId, setSelected, setFallback, importing });
  return { armId, selected, fallback, importing, onSelect };
}

/** Página del simulador de brazo: selector, controles de vista y el visor 3D. */
export function ArmSimIsland({ arms }: ArmSimIslandProps): JSX.Element {
  const { armId, selected, fallback, importing, onSelect } = useArmPage(arms);

  // En móvil los tres bloques de la página son acordeones con uno solo abierto a la vez
  // (docs/DESIGN.md §9.4, #134 decisión 3); «Articulaciones» arranca abierto.
  const mobile = useMediaQuery(MOBILE_MEDIA_QUERY);
  const [openId, setOpenId] = useState<OpenPanelId>('joints');
  const group: AccordionGroup = { openId, setOpenId };
  const renderPanel = usePanelWrapper(mobile, group);
  // Los controles encienden las capas del visor; su estado no va en la URL (#135 y #136).
  const [matrices, setMatrices] = useState(false);
  const [workspace, setWorkspace] = useState(false);

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

      <ViewControls
        mobile={mobile}
        group={group}
        matrices={matrices}
        onMatrices={setMatrices}
        workspace={workspace}
        onWorkspace={setWorkspace}
      />
      <Viewer
        armId={armId}
        memoryArm={selected === IMPORTED_VALUE || savedIdOf(selected) !== null
          ? importing.memoryArm
          : null}
        show={showLayers(matrices, workspace)}
        renderPanel={renderPanel}
      />
    </div>
  );
}
