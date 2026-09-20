import { Suspense, lazy, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { TrackJson } from '@trayectoria/sims';

// #158 (decisiones 1 y 2): el editor de pista ocupa la caja del visor, no la columna estrecha de
// los paneles. El visor del `LineFollowerWidget` vive dentro del propio widget, así que la caja
// se toma prestada sin tocar la API de `@trayectoria/sims` (prohibido por el ticket): el editor
// se monta con un portal en el mismo contenedor que el visor, y el visor se oculta mientras dura
// la edición. Así el editor hereda exactamente el ancho de la columna del visor y los paneles
// laterales conservan su ancho y su posición, porque la rejilla del widget no cambia.

// El editor entra con `import()` y solo al abrirlo: la mayoría de las visitas simulan sobre un
// preset y no tienen por qué descargar el editor de F4-01b (docs/ARCHITECTURE.md §8).
const LazyTrackEditor = lazy(async () => {
  const module = await import('@trayectoria/sims');
  return { default: module.TrackEditor };
});

/** Proporción de la caja del editor, la misma que la escena del visor (16/9). */
const BOX_ASPECT_RATIO = 16 / 9;

/** Alto mínimo de la caja, en píxeles: el editor no cabe en menos aunque la columna sea estrecha. */
const MIN_BOX_HEIGHT_PX = 320;

/** El visor del widget, que es a la vez la caja que el editor ocupa y el hermano que se oculta. */
const VIEWER_SELECTOR = '[data-testid="line-follower-view"]';

/**
 * El contenedor del visor y el ancho que ocupa, observados mientras la caja está abierta. El
 * visor se oculta con `hidden` en lugar de desmontarse: la simulación sigue viva detrás, con su
 * robot y su controlador, y volver no la reconstruye desde cero.
 */
function useViewerSlot(open: boolean): { host: HTMLElement | null; width_px: number } {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [width_px, setWidth] = useState(0);

  useEffect(() => {
    if (!open) {
      setHost(null);
      return undefined;
    }
    const viewer = document.querySelector<HTMLElement>(VIEWER_SELECTOR);
    const parent = viewer?.parentElement ?? null;
    if (viewer === null || parent === null) return undefined;
    viewer.hidden = true;
    setHost(parent);
    // La caja mide lo que mide la columna del visor, y la sigue midiendo si la ventana cambia.
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry !== undefined) setWidth(entry.contentRect.width);
    });
    observer.observe(parent);
    setWidth(parent.getBoundingClientRect().width);
    return () => {
      observer.disconnect();
      viewer.hidden = false;
    };
  }, [open]);

  return { host, width_px };
}

/**
 * La pista con geometría: el `TrackJson` sin la rama del nombre de preset. `apps/web` no puede
 * importar `sim-core` (docs/ARCHITECTURE.md §2), así que el tipo `Track` no está a mano y se
 * nombra por lo que `@trayectoria/sims` sí exporta.
 */
type EditorTrack = Exclude<TrackJson, string>;

/**
 * La pista de la que parte el editor, resuelta a geometría. Un preset viaja como su nombre, y el
 * editor solo entiende una `Track`: sin resolverlo, «Editar» abriría un lienzo vacío en lugar de
 * la pista que se está viendo. `resolveTrack` vive en el módulo del simulador, que se carga
 * aparte, así que el resultado llega después del primer render y hasta entonces no hay pista.
 */
function useResolvedTrack(track: TrackJson, open: boolean): EditorTrack | null {
  const [resolved, setResolved] = useState<EditorTrack | null>(null);
  useEffect(() => {
    if (!open) return undefined;
    if (typeof track !== 'string') {
      setResolved(track);
      return undefined;
    }
    let live = true;
    void import('@trayectoria/sims').then(({ resolveTrack }) => {
      if (live) setResolved(resolveTrack(track));
    });
    return () => {
      live = false;
    };
  }, [track, open]);
  return resolved;
}

/**
 * Alto de la caja: el mismo que tendría el visor con su relación 16/9, con un mínimo para que el
 * editor siga siendo utilizable en columnas estrechas. `TrackEditor` no admite prop de tamaño
 * (#158, decisión 2), así que lo que sobra lo recorta la caja con scroll propio.
 */
function boxHeight_px(width_px: number): number {
  return Math.max(MIN_BOX_HEIGHT_PX, Math.round(width_px / BOX_ASPECT_RATIO));
}

export interface TrackEditorBoxProps {
  /** Si el editor ocupa la caja del visor. */
  readonly open: boolean;
  /** La pista de la que parte el editor, para continuar desde lo que se ve. */
  readonly track: TrackJson;
  /** Cada cambio del editor; la página reinicia la simulación con la pista nueva. */
  readonly onTrack: (track: TrackJson) => void;
  /** «Volver a la simulación»: devuelve la caja al visor y reinicia la simulación en `t = 0`. */
  readonly onBack: () => void;
}

/** La cabecera de la caja: el título y «Volver a la simulación» (#158, decisión 3). */
function BoxHeader({ onBack }: { onBack: () => void }): JSX.Element {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-fg font-semibold">{t('sims.mobilePage.editorTitle')}</h2>
      <button
        type="button"
        className={
          'border-border bg-bg-raised text-fg inline-flex h-11 items-center rounded-md border ' +
          'px-3 text-sm font-semibold hover:border-fg-muted focus-visible:outline-color-focus ' +
          'focus-visible:outline-2 focus-visible:outline-offset-2'
        }
        data-testid="track-editor-back"
        onClick={onBack}
      >
        {t('sims.mobilePage.editorBack')}
      </button>
    </div>
  );
}

/** El editor de pista de F4-01b dentro de la caja que dejó libre el visor. */
export function TrackEditorBox({
  open,
  track,
  onTrack,
  onBack,
}: TrackEditorBoxProps): JSX.Element | null {
  const t = useT();
  const { host, width_px } = useViewerSlot(open);
  const initialTrack = useResolvedTrack(track, open);
  if (!open || host === null) return null;

  return createPortal(
    <div className="flex flex-col gap-3" data-testid="track-editor-box">
      <BoxHeader onBack={onBack} />
      <div className="overflow-auto" style={{ height: `${String(boxHeight_px(width_px))}px` }}>
        <Suspense
          fallback={
            <p className="text-fg-muted text-sm" role="status" aria-live="polite">
              {t('sims.mobilePage.loading')}
            </p>
          }
        >
          {initialTrack === null ? null : (
            <LazyTrackEditor initialTrack={initialTrack} onChange={onTrack} />
          )}
        </Suspense>
      </div>
    </div>,
    host,
  );
}
