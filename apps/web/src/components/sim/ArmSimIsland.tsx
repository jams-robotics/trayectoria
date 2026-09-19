import { Suspense, lazy, useCallback, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useT } from '@trayectoria/i18n';

import { ArmSource, resolveArmId } from './ArmSource';
import type { ArmOption } from './ArmSource';
import { SimAccordion } from './SimAccordion';
import { MOBILE_MEDIA_QUERY, useMediaQuery } from './useMediaQuery';

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

/** Capas del visor activas en este ticket; las matrices son F5-02 y el espacio de trabajo F5-03. */
const SHOW_FRAMES: Array<'frames' | 'matrices' | 'workspace'> = ['frames'];

/** Botón secundario de 36 px de los controles de vista (docs/DESIGN.md §6). */
const VIEW_BUTTON =
  'border-border bg-bg-raised text-fg-muted h-9 cursor-not-allowed rounded-sm border px-3 ' +
  'text-sm opacity-60';

/** Lee `?robot=` de la URL. Solo se ejecuta en el cliente: la isla es `client:only`. */
function requestedArmId(): string | null {
  return new URLSearchParams(window.location.search).get('robot');
}

/** Un control de vista todavía no operativo: visible, anunciado y no accionable. */
function SoonButton({ label, hint }: { label: string; hint: string }): JSX.Element {
  return (
    <button
      type="button"
      className={VIEW_BUTTON}
      aria-disabled="true"
      aria-label={`${label}. ${hint}`}
      disabled
    >
      {label}
    </button>
  );
}

/**
 * Los controles de vista todavía no operativos. «Marcos» no está aquí: lo aporta el propio
 * `ArmViewer` (#134, decisión 4). En móvil van dentro de un acordeón para no comerse el alto por
 * encima del visor (docs/DESIGN.md §9 puntos 3 y 8).
 */
function ViewControls({ mobile, group }: { mobile: boolean; group: AccordionGroup }): JSX.Element {
  const t = useT();
  const controls = (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('sims.armPage.view')}>
      <SoonButton label={t('sims.armPage.workspace')} hint={t('sims.armPage.soon')} />
      <SoonButton label={t('sims.armPage.matrices')} hint={t('sims.armPage.soon')} />
    </div>
  );
  // En escritorio los controles van arriba-izquierda del visor (maqueta 05). `Marcos` no está
  // aquí: lo pinta el propio `ArmViewer` en la fila inmediatamente inferior, porque reutilizarlo
  // tal cual es la decisión 4 del ticket y su `FramesToggle` es interno.
  if (!mobile) return controls;
  return (
    <SimAccordion
      title={t('sims.armPage.view')}
      summary={t('sims.armPage.soon')}
      open={group.openId === 'view'}
      onToggle={(open) => {
        group.setOpenId(open ? 'view' : null);
      }}
    >
      {controls}
    </SimAccordion>
  );
}

/** El panel que `ArmViewer` entrega a `renderPanel` (`ArmViewerPanel` de `@trayectoria/sims`). */
interface ArmViewerPanel {
  readonly id: 'joints' | 'effector';
  readonly title: string;
  readonly summary: string;
  readonly content: ReactNode;
}

/** Qué acordeón está abierto en móvil; solo uno a la vez (docs/DESIGN.md §9.4). */
type OpenPanelId = 'view' | 'joints' | 'effector' | null;

/** El estado compartido por los tres acordeones de la página en móvil. */
interface AccordionGroup {
  readonly openId: OpenPanelId;
  readonly setOpenId: (id: OpenPanelId) => void;
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
 * ceros (criterio del ticket) sin que esta isla toque el estado de `useArmSim`.
 */
function Viewer({
  armId,
  renderPanel,
}: {
  armId: string;
  renderPanel: (panel: ArmViewerPanel) => ReactNode;
}): JSX.Element {
  const t = useT();
  return (
    <Suspense
      fallback={
        <p className="text-fg-muted text-sm" role="status" aria-live="polite">
          {t('sims.armPage.loading')}
        </p>
      }
    >
      <LazyArmViewer key={armId} catalogId={armId} show={SHOW_FRAMES} renderPanel={renderPanel} />
    </Suspense>
  );
}

export interface ArmSimIslandProps {
  /** Brazos de la colección `arms`, resueltos en build por `brazo.astro`. */
  arms: readonly ArmOption[];
}

/**
 * Página del simulador de brazo: selector del catálogo, controles de vista y el visor 3D.
 * `?robot=<id>` se lee en el cliente (`window` está permitido en `apps/web`, CLAUDE.md) porque
 * la página es estática y `Astro.url.searchParams` no ve una cadena añadida tras el build.
 */
export function ArmSimIsland({ arms }: ArmSimIslandProps): JSX.Element {
  const requested = requestedArmId();
  const [armId, setArmId] = useState(() => resolveArmId(requested, arms));
  // El aviso solo aparece si la URL pedía un brazo concreto que no existe en el catálogo.
  const [fallback, setFallback] = useState(
    () => requested !== null && !arms.some((arm) => arm.id === requested),
  );

  const selectArm = useCallback((id: string): void => {
    setArmId(id);
    setFallback(false);
    const url = new URL(window.location.href);
    url.searchParams.set('robot', id);
    window.history.replaceState(null, '', url);
  }, []);

  // En móvil los tres bloques de la página son acordeones con uno solo abierto a la vez
  // (docs/DESIGN.md §9.4, #134 decisión 3); «Articulaciones» arranca abierto.
  const mobile = useMediaQuery(MOBILE_MEDIA_QUERY);
  const [openId, setOpenId] = useState<OpenPanelId>('joints');
  const group: AccordionGroup = { openId, setOpenId };
  const renderPanel = usePanelWrapper(mobile, group);

  return (
    <div className="mt-6 flex flex-col gap-5">
      <ArmSource arms={arms} selected={armId} fallback={fallback} onSelect={selectArm} />

      <ViewControls mobile={mobile} group={group} />
      <Viewer armId={armId} renderPanel={renderPanel} />
    </div>
  );
}
