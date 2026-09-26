import { useCallback, useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import { Toast } from '@trayectoria/widgets/Toast';

// #190 (decision 3): split from `MobileSimIsland.tsx` to keep that file under the limit of
// docs/STANDARDS.md §4. The notice «el editor se dejó sin segmentos, sigue la pista anterior»: a
// canvas without segments does not replace the track the page was already simulating; that one
// is kept and the page says so, because otherwise the editor would seem to have done nothing.

/** The state of the «lienzo vacío» notice and how it is shown or dismissed. */
export interface EmptyTrackNoticeApi {
  readonly shown: boolean;
  readonly show: () => void;
  readonly dismiss: () => void;
}

/**
 * The notice «el editor se dejó sin segmentos, sigue la pista anterior» (#190, decision 3). It is
 * the toast of docs/DESIGN.md §5, which dismisses itself after 5 s or with Esc.
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

/** The «el editor se dejó sin segmentos» toast, when there is one (#190, decision 3). */
export function EmptyTrackToast({ notice }: { notice: EmptyTrackNoticeApi }): JSX.Element | null {
  const t = useT();
  if (!notice.shown) return null;
  return (
    <Toast message={t('sims.mobilePage.emptyTrackKept')} tone="neutral" onClose={notice.dismiss} />
  );
}
