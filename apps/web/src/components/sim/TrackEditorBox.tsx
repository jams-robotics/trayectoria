import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
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
function useResolvedTrack(
  track: TrackJson | null,
  open: boolean,
): { initialTrack: EditorTrack | null; resolving: boolean } {
  const [resolved, setResolved] = useState<EditorTrack | null>(null);
  useEffect(() => {
    if (!open) return undefined;
    // «Nueva pista»: no hay pista de la que partir. El editor abre con su propio lienzo vacío,
    // que es lo que hace sin `initialTrack`; `apps/web` no puede construir una `Track` porque no
    // importa sim-core (docs/ARCHITECTURE.md §2).
    if (track === null) {
      setResolved(null);
      return undefined;
    }
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
  // Un preset viaja como su nombre y hay que resolverlo con el módulo del simulador, que llega
  // después del primer render: hasta entonces no se puede montar el editor, o abriría vacío la
  // pista que sí existe. Con `track === null` no hay nada que esperar.
  return { initialTrack: resolved, resolving: track !== null && resolved === null };
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
  /**
   * La pista de la que parte el editor, para continuar desde lo que se ve, o `null` para abrirlo
   * con el lienzo en blanco («Nueva pista», #190, decisión 3).
   */
  readonly track: TrackJson | null;
  /**
   * Cada cambio del editor que deja una pista con segmentos; la página reinicia la simulación con
   * ella. Un lienzo sin segmentos no se publica: no es una pista sobre la que simular, y la
   * anterior se conserva hasta que el editor vuelva a tener alguno (#190, decisión 3).
   */
  readonly onTrack: (track: TrackJson) => void;
  /**
   * «Volver a la simulación»: devuelve la caja al visor y reinicia la simulación en `t = 0`.
   * `emptyTrack` avisa de que el lienzo se dejó sin segmentos, y de que por tanto la página sigue
   * con la pista que ya tenía (#190, decisión 3).
   */
  readonly onBack: (emptyTrack: boolean) => void;
  /**
   * Dónde coloca la página el panel numérico del segmento (#189, decisión 2): la columna derecha,
   * en lugar de una segunda columna dentro de la caja.
   */
  readonly renderPanel: (panel: ReactNode) => ReactNode;
}

/**
 * Publica solo las pistas con segmentos (#190, decisión 3). Un lienzo vacío —el de «Nueva pista»
 * antes del primer trazo, o el que queda tras borrarlo todo— no es una pista sobre la que simular:
 * mandarlo dejaría al robot sin línea que seguir. Hasta que el editor tenga un segmento, la página
 * sigue con la pista que ya tenía, y al volver avisa de que la conserva.
 */
function useTrackWithSegments(
  onTrack: (track: TrackJson) => void,
  startsEmpty: boolean,
  open: boolean,
): { publish: (track: EditorTrack) => void; empty: boolean } {
  const latest = useRef(onTrack);
  latest.current = onTrack;
  const [empty, setEmpty] = useState(startsEmpty);
  // La caja se monta con la página y solo se oculta al cerrar, así que el valor inicial del
  // `useState` es el de la primera carga y no el de esta apertura: cada vez que el editor se abre
  // hay que volver a partir de si trae pista o no.
  useEffect(() => {
    if (open) setEmpty(startsEmpty);
  }, [open, startsEmpty]);
  const publish = useCallback((track: EditorTrack): void => {
    const hasSegments = track.segments.length > 0;
    setEmpty(!hasSegments);
    if (hasSegments) latest.current(track);
  }, []);
  return { publish, empty };
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

/** El editor perezoso con su aviso de carga; vacío mientras un preset se está resolviendo. */
function EditorSlot({
  initialTrack,
  resolving,
  onChange,
  renderPanel,
  height_px,
}: {
  initialTrack: EditorTrack | null;
  resolving: boolean;
  onChange: (track: EditorTrack) => void;
  renderPanel: (panel: ReactNode) => ReactNode;
  height_px: number;
}): JSX.Element {
  const t = useT();
  return (
    <Suspense
      fallback={
        <p className="text-fg-muted text-sm" role="status" aria-live="polite">
          {t('sims.mobilePage.loading')}
        </p>
      }
    >
      {resolving ? null : (
        <LazyTrackEditor
          // Sin `initialTrack` el editor abre vacío, que es «Nueva pista»
          // (`exactOptionalPropertyTypes`: una prop ausente es ausente, no `undefined`).
          {...(initialTrack === null ? {} : { initialTrack })}
          onChange={onChange}
          renderPanel={renderPanel}
          canvasHeight_px={height_px}
        />
      )}
    </Suspense>
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
  const boxRef = useRef<HTMLDivElement | null>(null);
  const width_px = useBoxWidth(boxRef, open);
  const { initialTrack, resolving } = useResolvedTrack(track, open);
  const { publish, empty } = useTrackWithSegments(onTrack, track === null, open);
  if (!open) return null;

  return (
    <div ref={boxRef} className="flex flex-col gap-3" data-testid="track-editor-box">
      <BoxHeader
        onBack={() => {
          onBack(empty);
        }}
      />
      <div>
        <EditorSlot
          initialTrack={initialTrack}
          resolving={resolving}
          onChange={publish}
          renderPanel={renderPanel}
          height_px={canvasHeight_px(width_px)}
        />
      </div>
    </div>
  );
}
