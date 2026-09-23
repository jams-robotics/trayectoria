import { TOPIC_WIDGETS } from './widgetRegistry';

/**
 * One MDX component per topic widget, named like the widget (#243, decision 1): the MDX writes
 * `<RotationWidget mode="disc" … />` and gets `catalog/RotationWidget.astro`, a one-line wrapper
 * that renders `CatalogWidget` with `name="RotationWidget"`.
 *
 * The list of widgets lives only in `TOPIC_WIDGETS`: the map is built from the files of
 * `catalog/`, and a file with no entry in the list, or an entry with no file, stops the build.
 * `catalogWidgets.test.ts` checks the same thing under `pnpm test`.
 */
const WRAPPERS = import.meta.glob<{ default: unknown }>('./catalog/*.astro', { eager: true });

/** `./catalog/RotationWidget.astro` → `RotationWidget`. */
function widgetName(path: string): string {
  return path.slice('./catalog/'.length, -'.astro'.length);
}

function catalogComponents(): Readonly<Record<string, unknown>> {
  const components = Object.fromEntries(
    Object.entries(WRAPPERS).map(([path, module]) => [widgetName(path), module.default]),
  );
  const names = Object.keys(components).sort();
  const expected = [...TOPIC_WIDGETS].sort();
  if (names.join(',') !== expected.join(',')) {
    throw new Error(
      `components/tema/catalog/ has wrappers for ${names.join(', ')}; ` +
        `TOPIC_WIDGETS lists ${expected.join(', ')}`,
    );
  }
  return components;
}

/** Topic widget name → its MDX component, to spread into `temaComponents`. */
export const catalogWidgetComponents: Readonly<Record<string, unknown>> = catalogComponents();
