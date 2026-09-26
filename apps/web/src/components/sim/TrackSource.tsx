import { useRef, useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';
import type { SavedTrack, TrackJson, TrackPreset } from '@trayectoria/sims';

import { MyTracks, MyTracksGroup, savedIdOf, savedOptionValue } from './MyTracks';

// F4-02b (#128, decisión 2): el origen de la pista. La página no reimplementa nada: los presets
// son los nombres que `LineFollowerWidget` ya resuelve y el editor es el `TrackEditor` de F4-01b
// con `initialTrack` y `onChange`. `apps/web` no puede importar sim-core
// (docs/ARCHITECTURE.md §2), así que la pista viaja como `TrackJson` de `@trayectoria/sims`.
//
// #158 (decisión 1): «Editar» ya no despliega el editor dentro de este panel —la columna de la
// derecha es estrecha y el editor quedaba encogido y fuera de la vista—, sino que cambia la
// vista de la página: el editor ocupa la caja del visor y este panel solo dispara el cambio.

/** Los cuatro presets de la spec, en el orden del selector. */
export const PRESETS: readonly TrackPreset[] = ['oval', 's', 'tight', 'cross'];

/** Clave de i18n del nombre de cada preset; reutiliza las del editor de pista. */
const PRESET_KEY: Readonly<Record<TrackPreset, string>> = {
  oval: 'sims.trackEditor.presetName.oval',
  s: 'sims.trackEditor.presetName.sCurve',
  tight: 'sims.trackEditor.presetName.tightCurves',
  cross: 'sims.trackEditor.presetName.crossing',
};

const SELECT =
  'border-border bg-bg-raised text-fg h-11 rounded-md border px-3 text-sm ' +
  'focus-visible:outline-color-focus focus-visible:outline-2 focus-visible:outline-offset-2';
const BUTTON =
  'border-border bg-bg-raised text-fg inline-flex h-11 items-center rounded-md border px-3 ' +
  'text-sm font-semibold hover:border-fg-muted focus-visible:outline-color-focus ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2';

export interface TrackSourceProps {
  /** Preset seleccionado; la pista efectiva puede venir del editor o de un JSON cargado. */
  readonly preset: TrackPreset;
  readonly onPreset: (preset: TrackPreset) => void;
  /** Se llama con la pista cargada de un JSON; la página reinicia la simulación con ella. */
  readonly onTrack: (track: TrackJson) => void;
  /** «Editar esta pista»: la página lleva el editor a la caja del visor (#158, decisión 1). */
  readonly onEdit: () => void;
  /** «Nueva pista»: abre esa misma caja con el editor en blanco (#190, decisión 3). */
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

/** Uno de los cuatro presets, o null si la cadena no es ninguno. */
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

/** El botón «Cargar JSON» y su campo de archivo oculto. */
function LoadButton({
  onFile,
  t,
}: {
  onFile: (file: File) => void;
  t: Translate;
}): JSX.Element {
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
 * Los dos botones que llevan el editor a la caja del visor (#158; #190, decisión 3): continuar
 * con la pista que se está viendo, o empezar una en blanco. Antes había uno solo, «Editar», y
 * desde él no había forma de llegar al lienzo vacío.
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
 * Lee el archivo y publica su contenido como pista. `LineFollowerWidget` lo valida con
 * `parseTrack` al resolverlo; aquí solo se comprueba que sea JSON para avisar antes de mandárselo.
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
      <div className="flex flex-wrap items-end gap-3">
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
        <MyTracks saved={saved} selectedId={savedId} onDelete={onDeleteSaved} />
        <EditButtons onEdit={onEdit} onNew={onNew} t={t} />
        <LoadButton onFile={load} t={t} />
      </div>
      {error === null ? null : (
        <p className="text-error text-sm" role="alert" data-testid="track-source-error">
          {error}
        </p>
      )}
    </div>
  );
}
