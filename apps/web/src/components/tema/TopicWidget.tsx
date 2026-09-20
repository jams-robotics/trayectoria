import { Suspense, lazy, useMemo } from 'react';
import type { JSX } from 'react';

import { loadWidget } from './widgetRegistry';

/**
 * Isla que monta un widget de la página de tema por su **nombre**, resolviéndolo con el
 * `import()` dinámico de su entrada propia (`@trayectoria/widgets/<Widget>`, ADR-0009 y #188).
 * Así la página solo descarga los widgets que su MDX declara, y no el catálogo del barrel.
 *
 * El nombre y las props llegan serializados desde el `.astro`, igual que en `VerificaExercise`
 * (#97, hallazgo alta de auditoría del PR #119): Astro serializa a JSON las props de una isla,
 * así que solo se pasan valores, nunca funciones.
 *
 * Mientras el chunk del widget no ha llegado no se pinta nada: el hueco lo reserva el `.astro`
 * que envuelve la isla.
 */
export interface TopicWidgetProps {
  /** Nombre del widget, tal y como lo registra `widgetRegistry`. */
  readonly name: string;
  /** Props del widget, ya serializadas por Astro. */
  readonly props: Readonly<Record<string, unknown>>;
}

export function TopicWidget({ name, props }: TopicWidgetProps): JSX.Element {
  // `lazy` se crea una vez por nombre: recrearlo en cada render remontaría el widget y perdería
  // su estado interno.
  const Widget = useMemo(() => lazy(async () => ({ default: await loadWidget(name) })), [name]);
  return (
    <Suspense fallback={null}>
      <Widget {...props} />
    </Suspense>
  );
}
