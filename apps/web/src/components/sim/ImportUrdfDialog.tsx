import { useT } from '@trayectoria/i18n';
import { useEffect, useRef, type JSX } from 'react';

import { UploadUrdfForm, type AcceptedUpload } from '../robots/UploadUrdfForm';

// F5-04 (#137, decision 4): «Importar…» of the `/simuladores/brazo` selector. It reuses the
// F3-04 form as is: the zip check (`validateUpload` + `zipUrdf` +
// `parseUrdf`) and its `urdf.*` messages in `aria-live` are its own, not duplicated here.
//
// Without a session the form runs in `parseOnly`: the spec and the zip stay in memory and nothing
// is saved. With a session it saves as in F3-04 and, in addition, loads the arm in the viewer.

export interface ImportUrdfDialogProps {
  /** `true` when there is a session: the zip is saved besides being loaded. */
  readonly signedIn: boolean;
  /** Receives the already checked zip; the island decides whether to save it and load it. */
  readonly onAccept: (upload: AcceptedUpload) => Promise<void>;
  readonly onClose: () => void;
}

/** The dialog content: the F3-04 form, the no-session notice and the close button. */
function DialogBody({ signedIn, onAccept, onClose }: ImportUrdfDialogProps): JSX.Element {
  const t = useT();
  return (
    <div className="flex flex-col gap-3 p-4">
      <UploadUrdfForm
        mode={signedIn ? 'save' : 'parseOnly'}
        title={t('sims.import.title')}
        help={t('sims.import.help')}
        onUpload={onAccept}
      />
      {signedIn ? null : (
        <p className="text-fg-muted m-0 text-sm" data-testid="import-anonymous">
          {t('sims.import.anonymous')}
        </p>
      )}
      <button
        type="button"
        data-testid="import-close"
        className="border-border bg-bg-raised text-fg h-11 self-start rounded-md border px-3 text-sm"
        onClick={onClose}
      >
        {t('sims.import.close')}
      </button>
    </div>
  );
}

/**
 * The import dialog, a native modal `<dialog>`: the browser provides the focus trap, closing
 * with Escape and `aria-modal` (docs/DESIGN.md §5, same pattern as the rest of the app).
 */
export function ImportUrdfDialog({
  signedIn,
  onAccept,
  onClose,
}: ImportUrdfDialogProps): JSX.Element {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null || dialog.open) return;
    // `showModal` is what puts it on the top layer, above the 3D canvas. It does not exist in
    // jsdom: there it is enough to open it, which is what the component tests read.
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.open = true;
  }, []);

  return (
    <dialog
      ref={ref}
      data-testid="import-urdf-dialog"
      aria-label={t('sims.import.title')}
      className="border-border bg-bg text-fg m-auto max-w-lg rounded-lg border p-0 backdrop:bg-black/40"
      onClose={onClose}
      onCancel={onClose}
    >
      <DialogBody signedIn={signedIn} onAccept={onAccept} onClose={onClose} />
    </dialog>
  );
}
