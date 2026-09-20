import { useT } from '@trayectoria/i18n';
import { useEffect, useRef, type JSX } from 'react';

import { UploadUrdfForm, type AcceptedUpload } from '../robots/UploadUrdfForm';

// F5-04 (#137, decisión 4): «Importar…» del selector de `/simuladores/brazo`. Reutiliza el
// formulario de F3-04 tal cual: la comprobación del zip (`validateUpload` + `zipUrdf` +
// `parseUrdf`) y sus mensajes `urdf.*` en `aria-live` son los suyos, aquí no se duplican.
//
// Sin sesión el formulario va en `parseOnly`: el spec y el zip se quedan en memoria y no se guarda
// nada. Con sesión guarda como en F3-04 y, además, carga el brazo en el visor.

export interface ImportUrdfDialogProps {
  /** `true` cuando hay sesión: el zip se guarda además de cargarse. */
  readonly signedIn: boolean;
  /** Recibe el zip ya comprobado; la isla decide si lo guarda y lo carga en el visor. */
  readonly onAccept: (upload: AcceptedUpload) => Promise<void>;
  readonly onClose: () => void;
}

/** El contenido del diálogo: el formulario de F3-04, el aviso sin sesión y el botón de cerrar. */
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
 * El diálogo de importación, un `<dialog>` modal nativo: el navegador aporta el foco atrapado, el
 * cierre con Escape y el `aria-modal` (docs/DESIGN.md §5, mismo patrón que el resto de la app).
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
    // `showModal` no existe en jsdom; el diálogo se renderiza igual y el test lo lee.
    if (typeof dialog.showModal === 'function') dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      open
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
