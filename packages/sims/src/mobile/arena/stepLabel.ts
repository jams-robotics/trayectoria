import type { Translate } from '@trayectoria/i18n';

import type { Step } from './steps';

/** The glyph and the label of a button of the program. */
export function stepLabel(t: Translate, step: Step): { glyph: string; label: string } {
  switch (step.kind) {
    case 'forward':
      return { glyph: '↑', label: t('sims.arena.steps.forward') };
    case 'left':
      return { glyph: '↰', label: t('sims.arena.steps.left') };
    case 'right':
      return { glyph: '↱', label: t('sims.arena.steps.right') };
    case 'repeat':
      return { glyph: '↻', label: t('sims.arena.steps.repeat', { n: step.n }) };
    case 'end':
      return { glyph: '⤶', label: t('sims.arena.steps.end') };
  }
}
