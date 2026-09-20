// El estado compartido de los acordeones de `/simuladores/brazo` (#134, decisión 3), en su propio
// archivo para que `ArmSimIsland.tsx` y `ArmViewControls.tsx` lo compartan sin ciclo de imports.

/** Qué acordeón está abierto en móvil; solo uno a la vez (docs/DESIGN.md §9.4). */
export type OpenPanelId = 'view' | 'joints' | 'effector' | 'matrices' | 'workspace' | null;

/** El estado compartido por los tres acordeones de la página en móvil. */
export interface AccordionGroup {
  readonly openId: OpenPanelId;
  readonly setOpenId: (id: OpenPanelId) => void;
}
