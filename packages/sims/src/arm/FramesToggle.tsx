import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';

// F5-01a: switch for the link frames (docs/DESIGN.md §6: view controls at the top left, 36 px).
// Same active style as the page's view group (#537): `primary` fill when on, so «Marcos» never
// looks off while the frames are drawn.

const BUTTON =
  'h-9 rounded-sm border px-3 text-sm ' +
  'focus-visible:outline-color-focus focus-visible:outline-2 focus-visible:outline-offset-2';
const BUTTON_ON = `${BUTTON} bg-primary text-primary-fg border-primary`;
const BUTTON_OFF = `${BUTTON} border-border bg-bg-raised text-fg hover:border-fg-muted`;

export interface FramesToggleProps {
  /** Whether the frames are visible. */
  visible: boolean;
  onToggle: (visible: boolean) => void;
}

/** Two-state button that shows or hides the link frames. */
export function FramesToggle({ visible, onToggle }: FramesToggleProps): JSX.Element {
  const t = useT();
  return (
    <button
      type="button"
      className={visible ? BUTTON_ON : BUTTON_OFF}
      aria-pressed={visible}
      aria-label={t('sims.arm.frames')}
      data-testid="frames-toggle"
      onClick={() => {
        onToggle(!visible);
      }}
    >
      {t('sims.arm.frames')}
    </button>
  );
}
