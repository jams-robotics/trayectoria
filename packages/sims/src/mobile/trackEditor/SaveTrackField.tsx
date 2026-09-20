import { useState } from 'react';
import type { JSX, KeyboardEvent } from 'react';
import { useT } from '@trayectoria/i18n';

// F4-06 (#191, decisión 3): «Guardar» of the editor and its inline name field. It lives in its
// own file, and not inside `TrackEditor.tsx`, so neither file grows past the 300 lines of
// docs/STANDARDS.md §4.
//
// The field follows the pattern of `SaveConfigPanel` (F4-05): the name is required and at most
// `MAX_NAME_LENGTH` characters, Enter saves and Esc cancels. Where it is saved — the account or
// the browser — is the page's decision, not this component's: it only reports the name.

/** Longest name a track can have; the same bound as the `check` of `tracks.name` (§5.1). */
export const MAX_NAME_LENGTH = 80;

// docs/DESIGN.md §5 (Botón, Campo) and §8: 44 px targets, visible focus, tokens only.
const BUTTON =
  'border-border bg-bg-raised text-fg rounded-md focus-visible:outline-focus min-h-11 shrink-0 cursor-pointer border font-semibold hover:border-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-45';
const FIELD =
  'border-border bg-bg text-fg rounded-sm focus-visible:outline-focus min-h-11 w-40 shrink border px-2 focus-visible:outline-2 focus-visible:outline-offset-2';

export interface SaveTrackFieldProps {
  /** Saves the track under `name`; the page decides where and reports the outcome with a toast. */
  readonly onSave: (name: string) => void;
  /** Padding of the button, so the bar can tighten it in a single row (#189). */
  readonly pad: string;
  /** Body size of the button and the field, for that same single row. */
  readonly text: string;
}

/** The name field and its two keys: Enter saves, Esc closes without saving. */
function NameEntry({
  name,
  onName,
  onCommit,
  onCancel,
  text,
}: {
  readonly name: string;
  readonly onName: (name: string) => void;
  readonly onCommit: () => void;
  readonly onCancel: () => void;
  readonly text: string;
}): JSX.Element {
  const t = useT();
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onCommit();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  };
  return (
    <input
      type="text"
      autoFocus
      maxLength={MAX_NAME_LENGTH}
      aria-label={t('sims.trackEditor.save.name')}
      placeholder={t('sims.trackEditor.save.placeholder')}
      data-testid="track-editor-save-name"
      className={`${FIELD} ${text}`}
      value={name}
      onChange={(event) => {
        onName(event.target.value);
      }}
      onKeyDown={onKeyDown}
    />
  );
}

/**
 * «Guardar» in the toolbar: a button that opens an inline name field, and the field itself with
 * its own «Guardar». An empty name never saves — the button stays disabled, as in
 * `SaveConfigPanel` — so the learner sees why nothing happened.
 */
export function SaveTrackField({ onSave, pad, text }: SaveTrackFieldProps): JSX.Element {
  const t = useT();
  const [name, setName] = useState<string | null>(null);
  const trimmed = name?.trim() ?? '';
  const close = (): void => {
    setName(null);
  };
  const commit = (): void => {
    if (trimmed === '') return;
    onSave(trimmed);
    close();
  };
  if (name === null) {
    return (
      <button
        type="button"
        aria-label={t('sims.trackEditor.save.open')}
        data-testid="track-editor-save-track"
        className={`${BUTTON} ${pad} ${text}`}
        onClick={() => {
          setName('');
        }}
      >
        {t('sims.trackEditor.save.open')}
      </button>
    );
  }
  return (
    <span className="flex shrink items-center gap-2">
      <NameEntry name={name} onName={setName} onCommit={commit} onCancel={close} text={text} />
      <button
        type="button"
        aria-label={t('sims.trackEditor.save.confirm')}
        data-testid="track-editor-save-track-confirm"
        className={`${BUTTON} ${pad} ${text}`}
        disabled={trimmed === ''}
        onClick={commit}
      >
        {t('sims.trackEditor.save.confirm')}
      </button>
    </span>
  );
}
