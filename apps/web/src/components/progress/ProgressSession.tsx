import { useEffect } from 'react';
import type { JSX } from 'react';
import { subscribeSettledSession } from '@trayectoria/auth';
import { configureProgressSession } from '@trayectoria/progress';

/**
 * Único punto que conecta el servicio de progreso con la sesión (#120, decisión 2): una isla
 * `client:load` que sigue a `$session` y llama a `configureProgressSession(userId | null)`.
 * Vive aquí porque solo `apps/web` puede importar `@trayectoria/auth` y `@trayectoria/progress`
 * a la vez (regla de dependencias de `eslint.config.js`).
 *
 * No renderiza nada: las islas que muestran progreso leen `$progress`, no props.
 */
export function startProgressSession(): () => void {
  // The store starts out anonymous, with the local progress of this browser: a visit that
  // settles without a session leaves it untouched, since `configureProgressSession(null)` would
  // hydrate `$progress` ahead of the islands that read it (`useProgress`).
  let anonymous = true;
  return subscribeSettledSession((session) => {
    if (session === null && anonymous) return;
    anonymous = session === null;
    void configureProgressSession(session?.user.id ?? null);
  });
}

export function ProgressSession(): JSX.Element {
  useEffect(() => startProgressSession(), []);
  return <></>;
}
