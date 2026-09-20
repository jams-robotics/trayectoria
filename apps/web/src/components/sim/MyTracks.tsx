import { useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';
import type { SavedTrack } from '@trayectoria/sims';

import { ConfirmInline } from '../aula/MemberList';

// F4-06 (#191, decision 4): the «Mis pistas» group of the track picker and the «Borrar» of the
// picked one. It lives in its own file so that `TrackSource.tsx` stays under the 300 lines of
// docs/STANDARDS.md §4. It does not know where the tracks come from — the account or the
// browser —: it takes the list and the two callbacks the page resolves in `useSavedTracks.ts`.

const BUTTON =
  'border-border bg-bg-raised text-fg inline-flex h-11 items-center rounded-md border px-3 ' +
  'text-sm font-semibold hover:border-fg-muted focus-visible:outline-color-focus ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2';

export interface MyTracksProps {
  /** The saved tracks, most recently saved first. */
  readonly saved: readonly SavedTrack[];
  /** Id of the saved track the page is simulating, or `null` when it is another one. */
  readonly selectedId: string | null;
  /** «Borrar», already confirmed inline. */
  readonly onDelete: (id: string) => void;
}

/** «Borrar» and its inline confirmation: nothing is deleted without a second click (docs/DESIGN.md §5). */
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
 * «Borrar» for the saved track that is picked, beside the selector (decision 4). There is no
 * «Borrar» per row: the picker is a `<select>` and the action is on what is picked, as in the
 * rest of layout 04.
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

/** The options of the «Mis pistas» group of the picker; empty when none is saved yet. */
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

/** Prefix that tells a saved track apart from a preset inside the same `<select>`. */
const SAVED_PREFIX = 'saved:';

/** The option value of the saved track `id`. */
export function savedOptionValue(id: string): string {
  return `${SAVED_PREFIX}${id}`;
}

/** The saved track id of `value`, or `null` when the value is not one of them. */
export function savedIdOf(value: string): string | null {
  return value.startsWith(SAVED_PREFIX) ? value.slice(SAVED_PREFIX.length) : null;
}
