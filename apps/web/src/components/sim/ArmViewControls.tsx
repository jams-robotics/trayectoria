import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';

import { SimAccordion } from './SimAccordion';
import type { AccordionGroup } from './accordionGroup';

// Los controles de vista de `/simuladores/brazo` (#135 y #136, decisión 4), separados de
// `ArmSimIsland.tsx` al añadir el flujo de importación de F5-04 (#137) para que ninguno de los dos
// archivos pase de 300 líneas (docs/STANDARDS.md §4). Sin API pública propia: `ArmSimIsland.tsx`
// es el único que importa de aquí.

/** El botón de vista operativo: activo en `primary`, inactivo secundario (docs/DESIGN.md §5). */
const TOGGLE_BUTTON = 'h-9 rounded-sm border px-3 text-sm';
const TOGGLE_ON = `${TOGGLE_BUTTON} bg-primary text-primary-fg border-primary`;
const TOGGLE_OFF = `${TOGGLE_BUTTON} border-border bg-bg-raised text-fg-muted`;

/** Un control de vista que enciende una capa del visor (#135 y #136, decisión 4). */
function LayerToggle({
  label,
  on,
  testId,
  onToggle,
}: {
  label: string;
  on: boolean;
  testId: string;
  onToggle: (on: boolean) => void;
}): JSX.Element {
  return (
    <button
      type="button"
      className={on ? TOGGLE_ON : TOGGLE_OFF}
      aria-pressed={on}
      data-testid={testId}
      onClick={() => {
        onToggle(!on);
      }}
    >
      {label}
    </button>
  );
}

/** La fila con los dos controles de vista operativos. */
function ToggleRow({
  matrices,
  onMatrices,
  workspace,
  onWorkspace,
}: {
  matrices: boolean;
  onMatrices: (on: boolean) => void;
  workspace: boolean;
  onWorkspace: (on: boolean) => void;
}): JSX.Element {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('sims.armPage.view')}>
      <LayerToggle
        label={t('sims.armPage.workspace')}
        on={workspace}
        testId="workspace-toggle"
        onToggle={onWorkspace}
      />
      <LayerToggle
        label={t('sims.armPage.matrices')}
        on={matrices}
        testId="matrices-toggle"
        onToggle={onMatrices}
      />
    </div>
  );
}

/**
 * Los controles de vista. «Marcos» no está aquí: lo aporta el propio `ArmViewer` (#134,
 * decisión 4). En móvil van dentro de un acordeón para no comerse el alto por encima del visor
 * (docs/DESIGN.md §9 puntos 3 y 8).
 */
export function ViewControls({
  mobile,
  group,
  matrices,
  onMatrices,
  workspace,
  onWorkspace,
}: {
  mobile: boolean;
  group: AccordionGroup;
  matrices: boolean;
  onMatrices: (on: boolean) => void;
  workspace: boolean;
  onWorkspace: (on: boolean) => void;
}): JSX.Element {
  const t = useT();
  const controls = (
    <ToggleRow
      matrices={matrices}
      onMatrices={onMatrices}
      workspace={workspace}
      onWorkspace={onWorkspace}
    />
  );
  // En escritorio los controles van arriba-izquierda del visor (maqueta 05). `Marcos` no está
  // aquí: lo pinta el propio `ArmViewer` en la fila inmediatamente inferior, porque reutilizarlo
  // tal cual es la decisión 4 del ticket y su `FramesToggle` es interno.
  if (!mobile) return controls;
  return (
    <SimAccordion
      title={t('sims.armPage.view')}
      summary={t('sims.armPage.view')}
      open={group.openId === 'view'}
      onToggle={(open) => {
        group.setOpenId(open ? 'view' : null);
      }}
    >
      {controls}
    </SimAccordion>
  );
}
