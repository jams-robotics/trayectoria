import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';

// F5-01a: interruptor de los marcos de los eslabones (docs/DESIGN.md §6: «Controles de vista
// (Espacio de trabajo, Marcos, Vista) arriba-izquierda como secundarios 36 px»). Solo `frames`
// es operativo en este ticket.

const BUTTON =
  'border-border bg-bg-raised text-fg hover:bg-bg h-9 rounded-sm border px-3 text-sm ' +
  'focus-visible:outline-color-focus focus-visible:outline-2 focus-visible:outline-offset-2';

export interface FramesToggleProps {
  /** Si los marcos están visibles. */
  visible: boolean;
  onToggle: (visible: boolean) => void;
}

/** Botón de dos estados que muestra u oculta los marcos de los eslabones. */
export function FramesToggle({ visible, onToggle }: FramesToggleProps): JSX.Element {
  const t = useT();
  return (
    <button
      type="button"
      className={BUTTON}
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
