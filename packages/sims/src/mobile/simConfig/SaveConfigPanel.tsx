import { useId, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';
import type { SimConfig } from '@trayectoria/robot-spec';

import { ShareLink } from './ShareLink';
import type { CopyFailure } from './ShareLink';

// F4-05 (#131, decision 6): the «Guardar y compartir» panel. It does not decide where things are saved —that is
// chosen by the page depending on whether there is a session and a saved robot (decision 5)— nor does it make ids: it receives the list
// and the three callbacks, so this file works the same for local storage and for the
// `robots` row.

const BUTTON =
  'border-border bg-bg-raised text-fg inline-flex h-11 items-center rounded-md border px-3 ' +
  'text-sm font-semibold hover:border-fg-muted focus-visible:outline-color-focus ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2';
const PRIMARY =
  'bg-primary text-primary-fg border-primary inline-flex h-11 items-center rounded-md border ' +
  'px-3 text-sm font-semibold focus-visible:outline-color-focus focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-45';
const GHOST =
  'text-fg-muted hover:text-fg inline-flex h-11 items-center rounded-md px-2 text-sm ' +
  'focus-visible:outline-color-focus focus-visible:outline-2 focus-visible:outline-offset-2';
const FIELD =
  'border-border bg-bg text-fg h-11 min-w-0 flex-1 rounded-md border px-3 text-sm ' +
  'focus-visible:outline-color-focus focus-visible:outline-2 focus-visible:outline-offset-2';

export interface SaveConfigPanelProps {
  /** The current configuration, without `id` or `name`: «Guardar» sets them. */
  readonly current: Omit<SimConfig, 'id' | 'name'>;
  /** The saved configurations the page decides to show. */
  readonly saved: readonly SimConfig[];
  /** «Guardar»: the page gives it an `id` and writes it wherever appropriate. */
  readonly onSave: (name: string, config: Omit<SimConfig, 'id' | 'name'>) => void;
  /** «Cargar»: the page applies track, controller, parameters and seed. */
  readonly onLoad: (config: SimConfig) => void;
  /** «Borrar», already confirmed inline. */
  readonly onDelete: (id: string) => void;
  /**
   * Called when the link is copied, with `true` if the clipboard accepted it. With `false` and
   * `'tooLong'` there was nothing to copy: the configuration does not fit in a link (#182).
   */
  readonly onCopied: (copied: boolean, reason?: CopyFailure) => void;
  /** Origin of the link; the page's one when not given. */
  readonly origin?: string;
}

/** The configuration name field. */
function NameField({
  name,
  onName,
  t,
}: {
  name: string;
  onName: (name: string) => void;
  t: Translate;
}): JSX.Element {
  return (
    <>
      <label className="text-fg-muted text-sm" htmlFor="sim-config-name">
        {t('sims.simConfig.name')}
      </label>
      <input
        id="sim-config-name"
        type="text"
        className={FIELD}
        data-testid="sim-config-name"
        value={name}
        onChange={(event) => {
          onName(event.target.value);
        }}
      />
    </>
  );
}

/**
 * The name field and «Guardar»; without a name the button is disabled, never hidden, and a line
 * under the row says what it is waiting for (#543).
 */
function SaveRow({ onSave, t }: { onSave: (name: string) => void; t: Translate }): JSX.Element {
  const [name, setName] = useState('');
  const hintId = useId();
  const trimmed = name.trim();
  const waiting = trimmed === '';
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <NameField name={name} onName={setName} t={t} />
        </div>
        <button
          type="button"
          className={PRIMARY}
          data-testid="sim-config-save"
          disabled={waiting}
          {...(waiting ? { title: t('sims.simConfig.saveHint'), 'aria-describedby': hintId } : {})}
          onClick={() => {
            onSave(trimmed);
            setName('');
          }}
        >
          {t('sims.simConfig.save')}
        </button>
      </div>
      {waiting ? (
        <p id={hintId} className="text-fg-muted text-sm" data-testid="sim-config-save-hint">
          {t('sims.simConfig.saveHint')}
        </p>
      ) : null}
    </div>
  );
}

/** The question and the two buttons of the «Borrar» confirmation. */
function DeleteConfirm({
  onDelete,
  onCancel,
  t,
}: {
  onDelete: () => void;
  onCancel: () => void;
  t: Translate;
}): JSX.Element {
  return (
    <>
      <span className="text-fg-muted text-sm">{t('sims.simConfig.confirmDelete')}</span>
      <button
        type="button"
        className={BUTTON}
        data-testid="sim-config-delete-confirm"
        onClick={onDelete}
      >
        {t('sims.simConfig.confirmYes')}
      </button>
      <button
        type="button"
        className={GHOST}
        data-testid="sim-config-delete-cancel"
        onClick={onCancel}
      >
        {t('sims.simConfig.confirmNo')}
      </button>
    </>
  );
}

/** «Borrar» and its inline confirmation: nothing is deleted without a second click (docs/DESIGN.md §5). */
function DeleteAction({
  onDelete,
  t,
}: {
  onDelete: () => void;
  t: Translate;
}): JSX.Element {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        className={GHOST}
        data-testid="sim-config-delete"
        onClick={() => {
          setConfirming(true);
        }}
      >
        {t('sims.simConfig.delete')}
      </button>
    );
  }
  return (
    <DeleteConfirm
      onDelete={onDelete}
      onCancel={() => {
        setConfirming(false);
      }}
      t={t}
    />
  );
}

/** One row of the list: the name, «Cargar» and «Borrar» with its inline confirmation. */
function SavedRow({
  config,
  onLoad,
  onDelete,
  t,
}: {
  config: SimConfig;
  onLoad: (config: SimConfig) => void;
  onDelete: (id: string) => void;
  t: Translate;
}): JSX.Element {
  return (
    <li className="border-border flex flex-wrap items-center gap-2 border-b py-2 last:border-b-0">
      <span className="text-fg min-w-0 flex-1 truncate text-sm">{config.name}</span>
      <button
        type="button"
        className={BUTTON}
        data-testid="sim-config-load"
        onClick={() => {
          onLoad(config);
        }}
      >
        {t('sims.simConfig.load')}
      </button>
      <DeleteAction
        onDelete={() => {
          onDelete(config.id);
        }}
        t={t}
      />
    </li>
  );
}

/** The list of saved ones, or the notice that there are none yet. */
function SavedList({
  saved,
  onLoad,
  onDelete,
  t,
}: {
  saved: readonly SimConfig[];
  onLoad: (config: SimConfig) => void;
  onDelete: (id: string) => void;
  t: Translate;
}): JSX.Element {
  if (saved.length === 0) {
    return <p className="text-fg-muted text-sm">{t('sims.simConfig.empty')}</p>;
  }
  return (
    <ul className="flex flex-col" data-testid="sim-config-list">
      {saved.map((config) => (
        <SavedRow key={config.id} config={config} onLoad={onLoad} onDelete={onDelete} t={t} />
      ))}
    </ul>
  );
}

/**
 * «Guardar y compartir» (docs/DESIGN.md §5): the name and «Guardar», the list of saved
 * configurations with «Cargar» and «Borrar», and the link that reproduces the current simulation.
 */
export function SaveConfigPanel({
  current,
  saved,
  onSave,
  onLoad,
  onDelete,
  onCopied,
  origin,
}: SaveConfigPanelProps): JSX.Element {
  const t = useT();
  // The link is recomputed in an effect of `ShareLink`, so a new object on every render
  // would re-encode it endlessly: it is memoised on the current configuration.
  const linkConfig = useMemo<SimConfig>(
    () => ({ id: 'link', name: t('sims.simConfig.linkName'), ...current }),
    [current, t],
  );
  return (
    <div className="flex flex-col gap-4" data-testid="sim-config-panel">
      <SaveRow
        onSave={(name) => {
          onSave(name, current);
        }}
        t={t}
      />
      <SavedList saved={saved} onLoad={onLoad} onDelete={onDelete} t={t} />
      <ShareLink
        config={linkConfig}
        {...(origin === undefined ? {} : { origin })}
        onCopied={onCopied}
      />
    </div>
  );
}
