import { useMemo, useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';
import type { SimConfig } from '@trayectoria/robot-spec';

import { ShareLink } from './ShareLink';
import type { CopyFailure } from './ShareLink';

// F4-05 (#131, decisión 6): el panel «Guardar y compartir». No decide dónde se guarda —eso lo
// elige la página según haya sesión y robot guardado (decisión 5)— ni fabrica ids: recibe la lista
// y los tres callbacks, así que este archivo vale igual para el almacenamiento local y para la
// fila de `robots`.

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
  /** La configuración en curso, sin `id` ni `name`: los pone «Guardar». */
  readonly current: Omit<SimConfig, 'id' | 'name'>;
  /** Las configuraciones guardadas que la página decide mostrar. */
  readonly saved: readonly SimConfig[];
  /** «Guardar»: la página le da un `id` y la escribe donde corresponda. */
  readonly onSave: (name: string, config: Omit<SimConfig, 'id' | 'name'>) => void;
  /** «Cargar»: la página aplica pista, controlador, parámetros y semilla. */
  readonly onLoad: (config: SimConfig) => void;
  /** «Borrar», ya confirmado en línea. */
  readonly onDelete: (id: string) => void;
  /**
   * Se llama al copiar el enlace, con `true` si el portapapeles lo aceptó. Con `false` y
   * `'tooLong'` no hubo nada que copiar: la configuración no cabe en un enlace (#182).
   */
  readonly onCopied: (copied: boolean, reason?: CopyFailure) => void;
  /** Origen del enlace; el de la página cuando no se da. */
  readonly origin?: string;
}

/** El campo del nombre de la configuración. */
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

/** El campo del nombre y «Guardar»; sin nombre el botón está deshabilitado, nunca oculto. */
function SaveRow({ onSave, t }: { onSave: (name: string) => void; t: Translate }): JSX.Element {
  const [name, setName] = useState('');
  const trimmed = name.trim();
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <NameField name={name} onName={setName} t={t} />
      </div>
      <button
        type="button"
        className={PRIMARY}
        data-testid="sim-config-save"
        disabled={trimmed === ''}
        onClick={() => {
          onSave(trimmed);
          setName('');
        }}
      >
        {t('sims.simConfig.save')}
      </button>
    </div>
  );
}

/** La pregunta y los dos botones de la confirmación de «Borrar». */
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

/** «Borrar» y su confirmación en línea: nada se borra sin un segundo clic (docs/DESIGN.md §5). */
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

/** Una fila de la lista: el nombre, «Cargar» y «Borrar» con su confirmación en línea. */
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

/** La lista de guardadas, o el aviso de que todavía no hay ninguna. */
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
 * «Guardar y compartir» (docs/DESIGN.md §5): el nombre y «Guardar», la lista de configuraciones
 * guardadas con «Cargar» y «Borrar», y el enlace que reproduce la simulación en curso.
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
  // El enlace se recalcula en un efecto de `ShareLink`, así que un objeto nuevo en cada render
  // lo volvería a codificar sin parar: se memoiza sobre la configuración en curso.
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
