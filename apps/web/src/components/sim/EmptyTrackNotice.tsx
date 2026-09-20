import { useCallback, useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import { Toast } from '@trayectoria/widgets';

// #190 (decisión 3): separado de `MobileSimIsland.tsx` para mantener ese archivo bajo el límite de
// docs/STANDARDS.md §4. El aviso de «el editor se dejó sin segmentos, sigue la pista anterior»: un
// lienzo sin segmentos no reemplaza a la pista que la página ya simulaba, se conserva aquella y se
// dice, porque si no el editor parecería no haber hecho nada.

/** El estado del aviso de «lienzo vacío» y cómo se muestra o se cierra. */
export interface EmptyTrackNoticeApi {
  readonly shown: boolean;
  readonly show: () => void;
  readonly dismiss: () => void;
}

/**
 * El aviso de «el editor se dejó sin segmentos, sigue la pista anterior» (#190, decisión 3). Es el
 * toast de docs/DESIGN.md §5, que se cierra solo a los 5 s o con Esc.
 */
export function useEmptyTrackNotice(): EmptyTrackNoticeApi {
  const [shown, setShown] = useState(false);
  return {
    shown,
    show: useCallback((): void => {
      setShown(true);
    }, []),
    dismiss: useCallback((): void => {
      setShown(false);
    }, []),
  };
}

/** El toast de «el editor se dejó sin segmentos», cuando lo hay (#190, decisión 3). */
export function EmptyTrackToast({ notice }: { notice: EmptyTrackNoticeApi }): JSX.Element | null {
  const t = useT();
  if (!notice.shown) return null;
  return (
    <Toast message={t('sims.mobilePage.emptyTrackKept')} tone="neutral" onClose={notice.dismiss} />
  );
}
