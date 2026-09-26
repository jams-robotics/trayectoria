import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';

import { SimAccordion } from './SimAccordion';
import type { AccordionGroup } from './accordionGroup';

// The view controls of `/simuladores/brazo` (#135 and #136, decision 4), split from
// `ArmSimIsland.tsx` when the import flow of F5-04 (#137) was added so that neither of the two
// files goes over 300 lines (docs/STANDARDS.md §4). No public API of its own: `ArmSimIsland.tsx`
// is the only one that imports from here.

/** The operative view button: active in `primary`, inactive secondary (docs/DESIGN.md §5). */
const TOGGLE_BUTTON = 'h-9 rounded-sm border px-3 text-sm';
const TOGGLE_ON = `${TOGGLE_BUTTON} bg-primary text-primary-fg border-primary`;
const TOGGLE_OFF = `${TOGGLE_BUTTON} border-border bg-bg-raised text-fg-muted`;

/** A view control that turns on a viewer layer (#135 and #136, decision 4). */
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

/** The row with the two operative view controls. */
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
 * The view controls. «Marcos» is not here: the `ArmViewer` itself provides it (#134,
 * decision 4). On mobile they go inside an accordion so they do not eat the height above the
 * viewer (docs/DESIGN.md §9 points 3 and 8).
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
  // On desktop the controls go at the top left of the viewer (mockup 05). `Marcos` is not
  // here: the `ArmViewer` itself draws it in the row immediately below, because reusing it
  // as is is decision 4 of the ticket and its `FramesToggle` is internal.
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
