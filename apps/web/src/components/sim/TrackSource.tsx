import { useRef, useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';
import type { SavedTrack, TrackJson, TrackPreset } from '@trayectoria/sims';

import { MyTracks, MyTracksGroup, savedIdOf, savedOptionValue } from './MyTracks';
import type { MyTracksProps } from './MyTracks';

// F4-02b (#128, decision 2): the track source. The page reimplements nothing: the presets
// are the names `LineFollowerWidget` already resolves and the editor is the `TrackEditor` of F4-01b
// with `initialTrack` and `onChange`. `apps/web` cannot import sim-core
// (docs/ARCHITECTURE.md §2), so the track travels as `TrackJson` of `@trayectoria/sims`.
//
// #158 (decision 1): «Editar» no longer unfolds the editor inside this panel (the right
// column is narrow and the editor ended up shrunk and out of view), but changes the
// page view: the editor fills the viewer box and this panel only triggers the change.

/** The four presets of the spec, in selector order. */
export const PRESETS: readonly TrackPreset[] = ['oval', 's', 'tight', 'cross'];

/** i18n key of each preset's name; it reuses those of the track editor. */
const PRESET_KEY: Readonly<Record<TrackPreset, string>> = {
  oval: 'sims.trackEditor.presetName.oval',
  s: 'sims.trackEditor.presetName.sCurve',
  tight: 'sims.trackEditor.presetName.tightCurves',
  cross: 'sims.trackEditor.presetName.crossing',
};

// #552: the four controls of the panel share one 2 × 2 grid of equal cells, all 44 px tall
// (`h-[44px]`: `h-11` is 80 px on the D-01 scale) and as wide as their cell.
const SELECT =
  'border-border bg-bg-raised text-fg h-[44px] w-full rounded-md border px-3 text-sm ' +
  'focus-visible:outline-color-focus focus-visible:outline-2 focus-visible:outline-offset-2';
const BUTTON =
  'border-border bg-bg-raised text-fg inline-flex h-[44px] w-full items-center justify-center ' +
  'rounded-md border px-3 text-sm font-semibold hover:border-fg-muted ' +
  'focus-visible:outline-color-focus focus-visible:outline-2 focus-visible:outline-offset-2';
// The grid itself: the buttons align with the bottom of the select's cell, which also holds its
// label. «Borrar» only exists with a saved track picked and takes a full row under the picker.
const GRID = 'grid grid-cols-2 items-end gap-3';

export interface TrackSourceProps {
  /** Selected preset; the effective track may come from the editor or from a loaded JSON. */
  readonly preset: TrackPreset;
  readonly onPreset: (preset: TrackPreset) => void;
  /** Called with the track loaded from a JSON; the page restarts the simulation with it. */
  readonly onTrack: (track: TrackJson) => void;
  /** «Editar esta pista»: the page takes the editor to the viewer box (#158, decision 1). */
  readonly onEdit: () => void;
  /** «Nueva pista»: opens that same box with a blank editor (#190, decision 3). */
  readonly onNew: () => void;
  /** The saved tracks of the «Mis pistas» group, from the account or from the browser (#191). */
  readonly saved: readonly SavedTrack[];
  /** The saved track the page is simulating, or `null` when it is a preset or a loaded JSON. */
  readonly savedId: string | null;
  /** Picking a saved track: the page loads it as the current one (#191, decision 4). */
  readonly onSaved: (id: string) => void;
  /** «Borrar» for the picked saved track, already confirmed inline (#191, decision 4). */
  readonly onDeleteSaved: (id: string) => void;
}

/** One of the four presets, or null if the string is none of them. */
function asPreset(value: string): TrackPreset | null {
  return PRESETS.find((preset) => preset === value) ?? null;
}

/** Routes the value picked in the selector: a saved track (#191) or one of the presets. */
function pick(
  value: string,
  onPick: (preset: TrackPreset) => void,
  onSaved: (id: string) => void,
): void {
  const pickedSaved = savedIdOf(value);
  if (pickedSaved !== null) {
    onSaved(pickedSaved);
    return;
  }
  const next = asPreset(value);
  if (next !== null) onPick(next);
}

/** The track picker: the four presets of the spec and, after them, «Mis pistas» (#191). */
function PresetSelect({
  preset,
  saved,
  savedId,
  onPick,
  onSaved,
  t,
}: {
  preset: TrackPreset;
  saved: readonly SavedTrack[];
  savedId: string | null;
  onPick: (preset: TrackPreset) => void;
  onSaved: (id: string) => void;
  t: Translate;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-fg-muted text-sm" htmlFor="track-source">
        {t('sims.mobilePage.preset')}
      </label>
      <select
        id="track-source"
        className={SELECT}
        aria-label={t('sims.mobilePage.trackSource')}
        data-testid="track-source-select"
        value={savedId === null ? preset : savedOptionValue(savedId)}
        onChange={(event) => {
          pick(event.target.value, onPick, onSaved);
        }}
      >
        {PRESETS.map((name) => (
          <option key={name} value={name}>
            {t(PRESET_KEY[name])}
          </option>
        ))}
        <MyTracksGroup saved={saved} t={t} />
      </select>
    </div>
  );
}

/** The «Cargar JSON» button and its hidden file input. */
function LoadButton({ onFile, t }: { onFile: (file: File) => void; t: Translate }): JSX.Element {
  const fileRef = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <button
        type="button"
        className={BUTTON}
        data-testid="track-source-load"
        onClick={() => fileRef.current?.click()}
      >
        {t('sims.mobilePage.loadJson')}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        // The button above is the keyboard route; a tab stop here would put the focus on an
        // invisible element (F7-01).
        tabIndex={-1}
        aria-label={t('sims.mobilePage.loadInput')}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) onFile(file);
        }}
      />
    </>
  );
}

/**
 * The two buttons that take the editor to the viewer box (#158; #190, decision 3): continue
 * with the track being viewed, or start a blank one. Before there was only one, «Editar», and
 * from it there was no way to reach the empty canvas.
 */
function EditButtons({
  onEdit,
  onNew,
  t,
}: {
  onEdit: () => void;
  onNew: () => void;
  t: Translate;
}): JSX.Element {
  return (
    <>
      <button type="button" className={BUTTON} data-testid="track-source-edit" onClick={onEdit}>
        {t('sims.mobilePage.editThis')}
      </button>
      <button type="button" className={BUTTON} data-testid="track-source-new" onClick={onNew}>
        {t('sims.mobilePage.newTrack')}
      </button>
    </>
  );
}

/**
 * Reads the file and publishes its content as a track. `LineFollowerWidget` validates it with
 * `parseTrack` when resolving it; here it is only checked to be JSON, to warn before sending it.
 */
function useJsonLoad(
  onTrack: (track: TrackJson) => void,
  t: Translate,
): { error: string | null; load: (file: File) => void } {
  const [error, setError] = useState<string | null>(null);
  const load = (file: File): void => {
    void file.text().then((text) => {
      try {
        JSON.parse(text);
        setError(null);
        onTrack(text);
      } catch {
        setError(t('sims.mobilePage.loadError', { reason: file.name }));
      }
    });
  };
  return { error, load };
}

/** «Borrar» in a full row of the grid; the row disappears with it when no saved track is picked. */
function DeleteRow(props: MyTracksProps): JSX.Element {
  return (
    <div className="col-span-2 empty:hidden">
      <MyTracks {...props} />
    </div>
  );
}

/**
 * The track picker — presets and «Mis pistas» (#191, decision 4) —, the two editor buttons and
 * loading a JSON file.
 */
export function TrackSource({
  preset,
  onPreset,
  onTrack,
  onEdit,
  onNew,
  saved,
  savedId,
  onSaved,
  onDeleteSaved,
}: TrackSourceProps): JSX.Element {
  const t = useT();
  const { error, load } = useJsonLoad(onTrack, t);

  return (
    <div className="flex flex-col gap-3">
      <div className={GRID}>
        <PresetSelect
          preset={preset}
          saved={saved}
          savedId={savedId}
          onPick={(next) => {
            onPreset(next);
            onTrack(next);
          }}
          onSaved={onSaved}
          t={t}
        />
        <LoadButton onFile={load} t={t} />
        <EditButtons onEdit={onEdit} onNew={onNew} t={t} />
        <DeleteRow saved={saved} selectedId={savedId} onDelete={onDeleteSaved} />
      </div>
      {error === null ? null : (
        <p className="text-error text-sm" role="alert" data-testid="track-source-error">
          {error}
        </p>
      )}
    </div>
  );
}
