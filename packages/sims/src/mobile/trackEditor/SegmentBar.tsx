import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { TrackSegment } from '@trayectoria/sim-core';

import { useDraft } from './SegmentPanel';

// docs/DESIGN.md §5 and §8: 44 px targets, tokens only, focus ring of 2 px always visible.
// #189 (decisión 4): la barra pasa a formato compacto. Sobre un lienzo de ~600 px la versión con
// los rótulos completos medía ≈ 376 px y tapaba casi todo lo dibujado; con iconos etiquetados y un
// campo de radio de cuatro cifras el caso más ancho —un arco, con los tres controles— mide
// 4+40+4+48+4+40+4 = 144 px más los 2 px del borde, por debajo del objetivo de 160 px.
const BAR =
  'border-border bg-bg-raised rounded-md pointer-events-auto flex items-center gap-1 border p-1 shadow-md';
// Botón de icono de 40×40 px, el mínimo de docs/DESIGN.md §5 para un control de barra. El glifo es
// decorativo (`aria-hidden`) y quien lo nombra es su `aria-label`; `title` da el mismo texto con el
// puntero encima (#189, decisión 4).
const BUTTON =
  'border-border bg-bg text-fg rounded-sm focus-visible:outline-focus h-8 w-8 shrink-0 cursor-pointer border text-sm leading-none font-semibold hover:border-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2';
// Campo de cuatro cifras de radio en metros («0.125»). Los anchos salen de la escala de tokens
// D-01, la única que global.css expone (#167): `w-9` son 48 px y `h-8` 40 px, y el mono `xs` es el
// tamaño mínimo que docs/DESIGN.md §9.2 admite en cifras con unidad.
const FIELD =
  'border-border bg-bg text-fg rounded-sm focus-visible:outline-focus h-8 w-9 shrink-0 border px-1 text-right font-mono text-xs tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2';

/** Glifo de «Invertir sentido»: dos flechas que dan la vuelta. Decorativo; lo nombra el botón. */
const FLIP_GLYPH = '⇄';

/** Glifo de «Borrar segmento». Decorativo; lo nombra el botón. */
const DELETE_GLYPH = '✕';

/**
 * The compact radius field of the bar. It shares `useDraft` with the numeric panel, so it holds
 * the same limits (a number; `setRadius` of the model clamps a radius shorter than half the
 * chord) and applies on Enter or on blur exactly as the panel's own field does.
 */
function RadiusField({
  radius_m,
  onRadius,
}: {
  radius_m: number;
  onRadius: (radius_m: number) => void;
}): JSX.Element {
  const t = useT();
  const label = t('sims.trackEditor.field.radius');
  const { draft, setDraft, commit, onKeyDown } = useDraft(radius_m, onRadius);
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      title={label}
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={onKeyDown}
      className={FIELD}
    />
  );
}

/** Un botón de icono de la barra: el glifo lo dibuja, el `aria-label` y el `title` lo nombran. */
function IconButton({
  label,
  glyph,
  onClick,
}: {
  label: string;
  glyph: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={BUTTON}>
      <span aria-hidden="true">{glyph}</span>
    </button>
  );
}

/** «Invertir sentido» plus the compact radius field: the two edits only an arc offers. */
function ArcActions({
  radius_m,
  onFlip,
  onRadius,
}: {
  radius_m: number;
  onFlip: () => void;
  onRadius: (radius_m: number) => void;
}): JSX.Element {
  const t = useT();
  return (
    <>
      <IconButton label={t('sims.trackEditor.flipArc')} glyph={FLIP_GLYPH} onClick={onFlip} />
      <RadiusField radius_m={radius_m} onRadius={onRadius} />
    </>
  );
}

export interface SegmentBarProps {
  /** The selected segment; the bar is not rendered without one (#159, decision 1). */
  segment: TrackSegment;
  onFlip: () => void;
  onRadius: (radius_m: number) => void;
  onDelete: () => void;
}

/**
 * Floating bar over the canvas, top-right corner, shown only while a segment is selected
 * (#159, decision 1). It carries the two edits a learner reaches for right after drawing an arc
 * — invert its sweep and correct its radius — plus «Borrar», so none of them needs a trip down
 * to the numeric panel. Every control is labelled and 40 px tall, el mínimo de docs/DESIGN.md §5
 * para un control de barra: la barra vive sobre el lienzo y lo que le sobra de tamaño se lo quita
 * a lo dibujado (#189, decisión 4).
 */
export function SegmentBar({ segment, onFlip, onRadius, onDelete }: SegmentBarProps): JSX.Element {
  const t = useT();
  return (
    <div
      role="group"
      aria-label={t('sims.trackEditor.segmentBar')}
      data-testid="track-editor-segment-bar"
      className={BAR}
    >
      {segment.type === 'arc' ? (
        <ArcActions radius_m={segment.radius_m} onFlip={onFlip} onRadius={onRadius} />
      ) : null}
      <IconButton
        label={t('sims.trackEditor.deleteSegment')}
        glyph={DELETE_GLYPH}
        onClick={onDelete}
      />
    </div>
  );
}
