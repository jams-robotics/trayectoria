import { useEffect } from 'react';
import type { JSX } from 'react';
import { $session, $sessionReady } from '@trayectoria/auth';
import type { Session } from '@trayectoria/auth';
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
  let userId: string | null = null;
  const apply = (session: Session | null): void => {
    const next = session?.user.id ?? null;
    if (next === userId) return;
    userId = next;
    void configureProgressSession(next);
  };
  // La sesión se lee de forma asíncrona al montar ($sessionReady de packages/auth); hasta
  // entonces el store conserva el progreso local de este navegador.
  const unsubscribe = $session.subscribe((session) => {
    if (!$sessionReady.get()) return;
    apply(session);
  });
  const unsubscribeReady = $sessionReady.subscribe((ready) => {
    if (ready) apply($session.get());
  });
  return () => {
    unsubscribe();
    unsubscribeReady();
  };
}

export function ProgressSession(): JSX.Element {
  useEffect(() => startProgressSession(), []);
  return <></>;
}
