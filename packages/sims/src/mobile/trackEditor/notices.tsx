import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import { Toast } from '@trayectoria/widgets';

import type { ContinuityReport } from './continuity';

/** Millimetres per metre, to show a gap in the unit the spec of #126 asks for. */
const MM_PER_M = 1000;

/** Decimals shown for a gap in millimetres. */
const GAP_DECIMALS = 1;

/** A gap in metres as the millimetres the notice shows. */
export function gapText_mm(gap_m: number): string {
  return (gap_m * MM_PER_M).toFixed(GAP_DECIMALS);
}

/**
 * Continuity notice of the editor (spec of #126): one line per gap with its segment index and
 * its size in millimetres, «pista abierta» when the loop does not close, and «Pista continua»
 * when there is nothing to report. It is a polite live region, so a screen reader hears it
 * without losing the place.
 */
export function ContinuityNotice({ report }: { report: ContinuityReport }): JSX.Element {
  const t = useT();
  const { gaps, closed } = report;
  return (
    <div aria-live="polite" data-testid="track-editor-continuity" className="text-fg-muted text-sm">
      {gaps.length === 0 ? (
        <p>{t('sims.trackEditor.continuity.ok')}</p>
      ) : (
        <ul aria-label={t('sims.trackEditor.continuity.gapsTitle')}>
          {gaps.map(({ index, gap_m }) => (
            <li key={index}>
              {t('sims.trackEditor.continuity.gap', {
                index: index + 1,
                gap: gapText_mm(gap_m),
              })}
            </li>
          ))}
        </ul>
      )}
      {closed ? null : <p>{t('sims.trackEditor.continuity.open')}</p>}
    </div>
  );
}

/** The «pista descargada» toast of docs/DESIGN.md §5, shown after a save. */
export function EditorToast({
  shown,
  onClose,
}: {
  shown: boolean;
  onClose: () => void;
}): JSX.Element | null {
  const t = useT();
  if (!shown) return null;
  return <Toast message={t('sims.trackEditor.saved')} onClose={onClose} />;
}
