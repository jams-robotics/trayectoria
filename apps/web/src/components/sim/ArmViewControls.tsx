import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

import { SimAccordion } from './SimAccordion';
import type { AccordionGroup } from './accordionGroup';

// The view controls of `/simuladores/brazo` (#135 and #136, decision 4), split from
// `ArmSimIsland.tsx` when the import flow of F5-04 (#137) was added so that neither of the two
// files goes over 300 lines (docs/STANDARDS.md §4). No public API of its own: `ArmSimIsland.tsx`
// is the only one that imports from here.
//
// #537 and #542: «Espacio de trabajo», «Matrices» and «Marcos» are three independent toggles in one
// row (docs/DESIGN.md §5 and §6), each with a check box and the same active style, and on mobile the three go
// inside the «Controles de vista» accordion, whose header shows which layers are on.

/**
 * A toggle: 40 px on desktop (§6), 44 px touch target on mobile (§9.3). They are independent
 * switches, not tabs, so each one is its own button with a check box that shows its state.
 */
const SEGMENT =
  'border-border inline-flex items-center gap-2 rounded-md border px-3 text-sm transition-colors duration-[120ms]';
const SEGMENT_ON = 'bg-primary text-primary-fg font-semibold';
const SEGMENT_OFF = 'bg-bg-raised text-fg-muted hover:text-fg';

/** The three layers the group turns on, in display order. */
export interface ViewLayers {
  readonly workspace: boolean;
  readonly matrices: boolean;
  readonly frames: boolean;
}

/** Each layer with its label key and the `data-testid` the e2e tests already use. */
const LAYERS: readonly {
  readonly id: keyof ViewLayers;
  readonly labelKey: string;
  readonly testId: string;
}[] = [
  { id: 'workspace', labelKey: 'sims.armPage.workspace', testId: 'workspace-toggle' },
  { id: 'matrices', labelKey: 'sims.armPage.matrices', testId: 'matrices-toggle' },
  { id: 'frames', labelKey: 'sims.arm.frames', testId: 'frames-toggle' },
];

/**
 * The state of the group in one line, for the header of the accordion (#542): the layers that
 * are on, or that none is. It never repeats the title.
 */
export function viewSummary(layers: ViewLayers, t: Translate): string {
  const on = LAYERS.filter((layer) => layers[layer.id]).map((layer) => t(layer.labelKey));
  return on.length === 0 ? t('sims.armPage.viewNone') : on.join(' · ');
}

/** The box in front of a toggle's label: a check when the layer is on. */
function CheckBox({ on }: { on: boolean }): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className="border-current inline-flex h-4 w-4 items-center justify-center rounded-sm border text-xs leading-none"
    >
      {on ? '✓' : ''}
    </span>
  );
}

/** The three view toggles. */
function ViewGroup({
  layers,
  onLayer,
  mobile,
}: {
  layers: ViewLayers;
  onLayer: (id: keyof ViewLayers, on: boolean) => void;
  mobile: boolean;
}): JSX.Element {
  const t = useT();
  const height = mobile ? 'h-[44px]' : 'h-[40px]';
  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label={t('sims.armPage.view')}
      data-testid="view-controls"
    >
      {LAYERS.map((layer) => (
        <button
          key={layer.id}
          type="button"
          className={`${SEGMENT} ${height} ${layers[layer.id] ? SEGMENT_ON : SEGMENT_OFF}`}
          aria-pressed={layers[layer.id]}
          data-testid={layer.testId}
          onClick={() => {
            onLayer(layer.id, !layers[layer.id]);
          }}
        >
          <CheckBox on={layers[layer.id]} />
          {t(layer.labelKey)}
        </button>
      ))}
    </div>
  );
}

/**
 * The view controls. On desktop, the group over the viewer; on mobile, inside an accordion so it
 * does not eat the height above the viewer (docs/DESIGN.md §9 points 3 and 8).
 */
export function ViewControls({
  mobile,
  group,
  layers,
  onLayer,
}: {
  mobile: boolean;
  group: AccordionGroup;
  layers: ViewLayers;
  onLayer: (id: keyof ViewLayers, on: boolean) => void;
}): JSX.Element {
  const t = useT();
  const controls = <ViewGroup layers={layers} onLayer={onLayer} mobile={mobile} />;
  if (!mobile) return controls;
  return (
    <SimAccordion
      title={t('sims.armPage.view')}
      summary={viewSummary(layers, t)}
      open={group.openId === 'view'}
      onToggle={(open) => {
        group.setOpenId(open ? 'view' : null);
      }}
    >
      {controls}
    </SimAccordion>
  );
}
