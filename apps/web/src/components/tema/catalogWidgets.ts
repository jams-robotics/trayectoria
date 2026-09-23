import { createComponent, render, renderComponent } from 'astro/compiler-runtime';

import CatalogWidget from './CatalogWidget.astro';
import { TOPIC_WIDGETS } from './widgetRegistry';

/**
 * One MDX component per topic widget, named like the widget (#243, decision 1): the MDX writes
 * `<RotationWidget mode="disc" … />` and gets `CatalogWidget.astro` with `widget="RotationWidget"`.
 *
 * MDX calls a component of the map without telling it the name it was written under, so the name
 * is bound here. `createComponent` builds the same Astro component that the compiler emits for
 * `<CatalogWidget widget={name} {...Astro.props} />`; it is written in TypeScript because one
 * `.astro` file cannot be instantiated once per name.
 */
function bindWidget(name: string): unknown {
  return createComponent(
    (result: RenderResult, props: Readonly<Record<string, unknown>>) =>
      render`${renderComponent(result, name, CatalogWidget, { ...props, widget: name })}`,
  );
}

/** The render context Astro hands to a component factory. */
type RenderResult = Parameters<typeof renderComponent>[0];

/** Topic widget name → its MDX component, to spread into `temaComponents`. */
export const catalogWidgetComponents: Readonly<Record<string, unknown>> = Object.fromEntries(
  TOPIC_WIDGETS.map((name) => [name, bindWidget(name)]),
);
