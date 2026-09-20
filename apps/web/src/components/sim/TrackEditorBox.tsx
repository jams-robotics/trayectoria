import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useT } from '@trayectoria/i18n';
import type { TrackJson } from '@trayectoria/sims';

// #158 (decisiones 1 y 2), enmendado tras la auditoría de PR #169: el editor de pista ocupa la
// caja que la página misma reserva para el visor (Simulator pasa `renderViewer` a
// `LineFollowerWidget`), no un portal hacia un detalle interno de `@trayectoria/sims`. La caja se
// mide con un `ResizeObserver` sobre su propio contenedor, así que el editor hereda el ancho de la
// columna sin tocar el DOM del widget.
//
// #189 (decisiones 1 y 3): dentro de esa caja el lienzo es el protagonista. `TrackEditor` recibe
// `renderPanel`, así que su panel numérico sale de la caja hacia la columna derecha de la página y
// el lienzo se queda con todo el ancho; la caja ya no recorta con `overflow: auto`, porque el
// editor se dimensiona para caber: mide el hueco que le queda al lienzo bajo la barra de
// herramientas y le da esa relación de aspecto.

// El editor entra con `import()` y solo al abrirlo: la mayoría de las visitas simulan sobre un
// preset y no tienen por qué descargar el editor de F4-01b (docs/ARCHITECTURE.md §8).
const LazyTrackEditor = lazy(async () => {
  const module = await import('@trayectoria/sims');
  return { default: module.TrackEditor };
});

/** Proporción del lienzo del editor, la misma que la escena del visor (16/9). */
const CANVAS_ASPECT_RATIO = 16 / 9;

/** Alto mínimo del lienzo, en píxeles: el editor no cabe en menos aunque la columna sea estrecha. */
const MIN_CANVAS_HEIGHT_PX = 320;

/** El ancho de la caja propia de la página, observado mientras el editor está abierto. */
function useBoxWidth(ref: React.RefObject<HTMLElement | null>, open: boolean): number {
  const [width_px, setWidth] = useState(0);

  useEffect(() => {
    if (!open) return undefined;
    const box = ref.current;
    if (box === null) return undefined;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry !== undefined) setWidth(entry.contentRect.width);
    });
    observer.observe(box);
    setWidth(box.getBoundingClientRect().width);
    return () => {
      observer.disconnect();
    };
  }, [ref, open]);

  return width_px;
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
 * Alto del lienzo del editor, en píxeles: el mismo que tendría el visor al que sustituye con su
 * relación 16/9 (#158, decisión 2; #189, decisión 3), con un mínimo para que el editor siga siendo
 * utilizable en columnas estrechas.
 *
 * Es el alto del lienzo y no el de la caja entera: la barra de herramientas va encima y, en móvil,
 * se reparte en varias filas. Fijando la caja, esas filas se lo habrían quitado al lienzo hasta
 * dejarlo en una franja; fijando el lienzo, la caja crece lo que necesite y el lienzo conserva la
 * forma del visor.
 */
function canvasHeight_px(width_px: number): number {
  return Math.max(MIN_CANVAS_HEIGHT_PX, Math.round(width_px / CANVAS_ASPECT_RATIO));
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
  /**
   * Dónde coloca la página el panel numérico del segmento (#189, decisión 2): la columna derecha,
   * en lugar de una segunda columna dentro de la caja.
   */
  readonly renderPanel: (panel: ReactNode) => ReactNode;
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

/** El editor de pista de F4-01b dentro de la caja propia que la página reserva para el visor. */
export function TrackEditorBox({
  open,
  track,
  onTrack,
  onBack,
  renderPanel,
}: TrackEditorBoxProps): JSX.Element | null {
  const t = useT();
  const boxRef = useRef<HTMLDivElement | null>(null);
  const width_px = useBoxWidth(boxRef, open);
  const initialTrack = useResolvedTrack(track, open);
  if (!open) return null;

  return (
    <div ref={boxRef} className="flex flex-col gap-3" data-testid="track-editor-box">
      <BoxHeader onBack={onBack} />
      <div>
        <Suspense
          fallback={
            <p className="text-fg-muted text-sm" role="status" aria-live="polite">
              {t('sims.mobilePage.loading')}
            </p>
          }
        >
          {initialTrack === null ? null : (
            <LazyTrackEditor
              initialTrack={initialTrack}
              onChange={onTrack}
              renderPanel={renderPanel}
              canvasHeight_px={canvasHeight_px(width_px)}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}
