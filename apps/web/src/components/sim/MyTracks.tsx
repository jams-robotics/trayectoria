import { useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';
import type { SavedTrack } from '@trayectoria/sims';

import { ConfirmInline } from '../aula/MemberList';

// F4-06 (#191, decisión 4): el grupo «Mis pistas» del selector de pista y el «Borrar» de la
// elegida. Vive en su propio archivo para que `TrackSource.tsx` siga bajo las 300 líneas de
// docs/STANDARDS.md §4. No sabe de dónde salen las pistas —la cuenta o el navegador—: recibe la
// lista y los dos callbacks que la página resuelve en `useSavedTracks.ts`.

const BUTTON =
  'border-border bg-bg-raised text-fg inline-flex h-11 items-center rounded-md border px-3 ' +
  'text-sm font-semibold hover:border-fg-muted focus-visible:outline-color-focus ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2';

export interface MyTracksProps {
  /** Las pistas guardadas, de la más reciente a la más antigua. */
  readonly saved: readonly SavedTrack[];
  /** El id de la pista guardada que la página está simulando, o `null` si es otra. */
  readonly selectedId: string | null;
  /** «Borrar», ya confirmado en línea. */
  readonly onDelete: (id: string) => void;
}

/** «Borrar» y su confirmación en línea: nada se borra sin un segundo clic (docs/DESIGN.md §5). */
function DeleteAction({
  onDelete,
  t,
}: {
  readonly onDelete: () => void;
  readonly t: Translate;
}): JSX.Element {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <ConfirmInline
        question={t('sims.mobilePage.myTracks.confirmDelete')}
        yes={t('sims.mobilePage.myTracks.confirmYes')}
        no={t('sims.mobilePage.myTracks.confirmNo')}
        onConfirm={() => {
          setConfirming(false);
          onDelete();
        }}
        onCancel={() => {
          setConfirming(false);
        }}
      />
    );
  }
  return (
    <button
      type="button"
      className={BUTTON}
      data-testid="my-tracks-delete"
      onClick={() => {
        setConfirming(true);
      }}
    >
      {t('sims.mobilePage.myTracks.delete')}
    </button>
  );
}

/**
 * «Borrar» de la pista guardada que está elegida, junto al selector (decisión 4). No hay un
 * «Borrar» por fila: el selector es un `<select>` y la acción es sobre lo elegido, como en el
 * resto de la maqueta 04.
 */
export function MyTracks({ saved, selectedId, onDelete }: MyTracksProps): JSX.Element | null {
  const t = useT();
  const selected = saved.find((entry) => entry.id === selectedId);
  if (selected === undefined) return null;
  return (
    <DeleteAction
      t={t}
      onDelete={() => {
        onDelete(selected.id);
      }}
    />
  );
}

/** Las opciones del grupo «Mis pistas» del selector; vacío cuando no hay ninguna guardada. */
export function MyTracksGroup({
  saved,
  t,
}: {
  readonly saved: readonly SavedTrack[];
  readonly t: Translate;
}): JSX.Element | null {
  if (saved.length === 0) return null;
  return (
    <optgroup label={t('sims.mobilePage.myTracks.group')} data-testid="my-tracks-group">
      {saved.map((entry) => (
        <option key={entry.id} value={savedOptionValue(entry.id)}>
          {entry.name}
        </option>
      ))}
    </optgroup>
  );
}

/** Prefijo con el que una pista guardada se distingue de un preset en el mismo `<select>`. */
const SAVED_PREFIX = 'saved:';

/** El valor de la opción de la pista guardada `id`. */
export function savedOptionValue(id: string): string {
  return `${SAVED_PREFIX}${id}`;
}

/** El id de la pista guardada de `value`, o `null` cuando el valor no es una de ellas. */
export function savedIdOf(value: string): string | null {
  return value.startsWith(SAVED_PREFIX) ? value.slice(SAVED_PREFIX.length) : null;
}
