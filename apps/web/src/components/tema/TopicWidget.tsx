import { Suspense, lazy, useMemo } from 'react';
import type { JSX } from 'react';

import { loadWidget } from './widgetRegistry';

/**
 * Island that mounts a topic page widget by its **name**, resolving it with the
 * dynamic `import()` of its own entry (`@trayectoria/widgets/<Widget>`, ADR-0009 and #188).
 * That way the page only downloads the widgets its MDX declares, and not the barrel's catalogue.
 *
 * The name and the props arrive serialized from the `.astro`, just as in `VerificaExercise`
 * (#97, high-severity audit finding of PR #119): Astro serializes an island's props to JSON,
 * so only values are passed, never functions.
 *
 * While the widget chunk has not arrived nothing is painted: the space is reserved by the `.astro`
 * that wraps the island.
 */
export interface TopicWidgetProps {
  /** Widget name, as `widgetRegistry` registers it. */
  readonly name: string;
  /** Widget props, already serialized by Astro. */
  readonly props: Readonly<Record<string, unknown>>;
}

export function TopicWidget({ name, props }: TopicWidgetProps): JSX.Element {
  // `lazy` is created once per name: recreating it on every render would remount the widget and lose
  // its internal state.
  const Widget = useMemo(() => lazy(async () => ({ default: await loadWidget(name) })), [name]);
  return (
    <Suspense fallback={null}>
      <Widget {...props} />
    </Suspense>
  );
}
