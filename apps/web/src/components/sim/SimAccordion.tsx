import { useId, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useT } from '@trayectoria/i18n';

// F5-01b (#134, decisión 3): acordeón mínimo para los paneles del simulador en móvil
// (docs/DESIGN.md §9 puntos 3, 4 y 8: cabecera de 48–52 px, resumen legible con el panel
// cerrado y el control «ver ▾ / ocultar ▴» con texto además del glifo). F4-02b reutilizará este
// componente para los paneles del simulador móvil; por eso vive en `components/sim/` y no junto
// a la isla del brazo.

/** Glifos del control de apertura; van acompañados siempre del texto de la acción. */
const CHEVRON_OPEN = '▴';
const CHEVRON_CLOSED = '▾';

export interface SimAccordionProps {
  /** Título de la cabecera. */
  title: string;
  /** Resumen en línea, legible con el acordeón cerrado. */
  summary?: string;
  /** Si el acordeón arranca abierto. Se ignora si el acordeón viene controlado con `open`. */
  defaultOpen?: boolean;
  /**
   * Estado controlado desde fuera. Lo usa el grupo de la página del brazo para mantener un solo
   * acordeón abierto a la vez (docs/DESIGN.md §9.4); sin él el acordeón se gobierna solo.
   */
  open?: boolean;
  /** Se llama con el estado al que pasa el acordeón al pulsar la cabecera. */
  onToggle?: (open: boolean) => void;
  children: ReactNode;
}

/** Panel plegable con cabecera de objetivo táctil y resumen legible cerrado. */
export function SimAccordion({
  title,
  summary,
  defaultOpen = false,
  open: controlledOpen,
  onToggle,
  children,
}: SimAccordionProps): JSX.Element {
  const t = useT();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const panelId = useId();

  return (
    <section className="border-border bg-bg-raised rounded-lg border" data-testid="sim-accordion">
      <h3>
        <button
          type="button"
          className="flex min-h-[48px] w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-color-focus focus-visible:outline-2 focus-visible:outline-offset-2"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            setUncontrolledOpen(!open);
            onToggle?.(!open);
          }}
        >
          <span className="text-fg flex-1 font-semibold">{title}</span>
          {summary === undefined ? null : (
            <span className="text-fg-muted truncate font-mono text-xs">{summary}</span>
          )}
          <span className="text-fg-muted text-sm whitespace-nowrap">
            {open ? `${t('sims.armPage.collapse')} ${CHEVRON_OPEN}` : `${t('sims.armPage.expand')} ${CHEVRON_CLOSED}`}
          </span>
        </button>
      </h3>
      <div id={panelId} hidden={!open} className="px-4 pt-1 pb-4">
        {children}
      </div>
    </section>
  );
}
