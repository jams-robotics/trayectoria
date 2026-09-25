import type { JSX } from 'react';
import type { Translate } from '@trayectoria/i18n';

import { LiveStatus, ReadoutPanel } from '../shared/ReadoutPanel';
import type { FreeBodyReadout } from './compute';
import { panelRows, slipNotice, statusOf } from './rows';

export { frictionRows, panelRows, slipNotice, statusOf } from './rows';

/** The values panel, the «desliza» notice with `mu_s` and the `aria-live` description. */
export function Values({
  readout,
  mass_kg,
  showResultant,
  t,
}: {
  readout: FreeBodyReadout;
  mass_kg: number;
  showResultant: boolean;
  t: Translate;
}): JSX.Element {
  const notice = slipNotice(readout, t);
  return (
    <div>
      <ReadoutPanel
        title={t('widgets.FreeBodyWidget.panel')}
        rows={panelRows(readout, mass_kg, showResultant, t)}
      />
      {notice === null ? null : (
        <p role="note" className="text-error mt-2 text-sm" data-testid="freebody-slip">
          {notice}
        </p>
      )}
      <LiveStatus text={statusOf(readout, t)} />
    </div>
  );
}
