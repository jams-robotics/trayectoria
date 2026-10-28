import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';

import { DuoToggle } from './DuoPanel';
import type { ArenaSettingsApi } from './useArenaSettings';

const BUTTON =
  'min-h-10 rounded-md border border-border bg-bg px-4 text-base font-semibold text-fg hover:border-primary';

/** The side panel of the free arena: what to do, how to drive, restart and the way back. */
export function FreePanel({
  api,
  onRestart,
}: {
  api: ArenaSettingsApi;
  onRestart: () => void;
}): JSX.Element {
  const t = useT();
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-bg-raised/90 p-4 shadow-md backdrop-blur">
      <h2 className="text-xl font-semibold text-fg">{t('sims.arena.free.title')}</h2>
      <p className="text-base text-fg">{t('sims.arena.free.lead')}</p>
      <p className="text-sm text-fg-muted">{t('sims.arena.free.keys')}</p>
      <button type="button" className={BUTTON} onClick={onRestart}>
        {t('sims.arena.free.restart')}
      </button>
      <DuoToggle api={api} />
      <button type="button" className={BUTTON} onClick={() => api.pickTrack(api.settings.track)}>
        {t('sims.arena.free.exit')}
      </button>
    </section>
  );
}
