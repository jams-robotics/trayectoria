import type { JSX, ReactNode } from 'react';

import { SimAccordion } from './SimAccordion';

// F4-02b (#128): un panel de `/simuladores/movil`; en móvil es un acordeón del grupo y en
// escritorio una tarjeta de la columna derecha. Vive aparte de `MobileSimPanels.tsx` desde #189,
// para que también lo use la columna del editor sin ciclo de imports y para que ninguno de los
// dos archivos pase el límite de docs/STANDARDS.md §4.

/** Qué acordeón está abierto en móvil; solo uno a la vez (docs/DESIGN.md §9.4). */
export type OpenPanelId =
  | 'robot'
  | 'track'
  | 'controller'
  | 'readouts'
  | 'plots'
  | 'share'
  // #189 (decisión 2): el panel del segmento, el único de la columna mientras se edita la pista.
  | 'editor'
  | null;

export interface PanelProps {
  id: Exclude<OpenPanelId, null>;
  title: string;
  summary?: string;
  mobile?: boolean;
  openId: OpenPanelId;
  setOpenId: (id: OpenPanelId) => void;
  children: ReactNode;
}

/** La versión de móvil de un panel: un acordeón del grupo, con solo uno abierto a la vez. */
function AccordionPanel(props: PanelProps): JSX.Element {
  const { id, title, summary, openId, setOpenId, children } = props;
  return (
    <SimAccordion
      title={title}
      {...(summary === undefined ? {} : { summary })}
      open={openId === id}
      onToggle={(open) => {
        setOpenId(open ? id : null);
      }}
    >
      {children}
    </SimAccordion>
  );
}

/** Un panel de la página: en móvil va en un acordeón del grupo, en escritorio en una tarjeta. */
export function Panel(props: PanelProps): JSX.Element {
  const { id, title, children } = props;
  if (props.mobile === true) return <AccordionPanel {...props} />;
  return (
    // `overflow-hidden`: las gráficas de «Gráficas» fijan al lienzo un ancho en píxeles que no
    // vuelve a encoger, y sin recortar aquí la tarjeta crecería con él (F4-03, #129).
    <section
      className="border-border bg-bg-raised min-w-0 overflow-hidden rounded-lg border p-4"
      data-testid={`panel-${id}`}
    >
      <h2 className="text-fg mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}
