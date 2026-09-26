// The shared state of the accordions of `/simuladores/brazo` (#134, decision 3), in its own
// file so that `ArmSimIsland.tsx` and `ArmViewControls.tsx` share it without an import cycle.

/** Which accordion is open on mobile; only one at a time (docs/DESIGN.md §9.4). */
export type OpenPanelId = 'view' | 'joints' | 'effector' | 'matrices' | 'workspace' | null;

/** The state shared by the page's three accordions on mobile. */
export interface AccordionGroup {
  readonly openId: OpenPanelId;
  readonly setOpenId: (id: OpenPanelId) => void;
}
