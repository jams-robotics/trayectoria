import { $session, $sessionReady } from './session';

import type { Session } from '../client';

/**
 * La sesión actual en cuanto el store la ha leído una vez, para quien la necesita una sola vez y
 * no quiere reaccionar a sus cambios (#184, docs/ARCHITECTURE.md §3.1).
 *
 * Se suscribe a `$session` para activar el store: su `onMount` en `session.ts` es quien lee la
 * sesión persistida y pone `$sessionReady` a `true`, así que sin suscriptor la espera no
 * terminaría nunca. Ambas suscripciones se liberan al resolver, no hay temporizadores y llamarla
 * varias veces, a la vez o en serie, es equivalente a llamarla una: cada llamada resuelve con el
 * valor de `$session` en ese momento.
 */
export async function ensureSessionReady(): Promise<Session | null> {
  const stopSession = $session.subscribe(() => undefined);
  try {
    if (!$sessionReady.get()) {
      // `listen`, no `subscribe`: no llama al oyente en el propio alta, así que `stopReady` ya
      // está asignado cuando llega el aviso y se puede cortar desde dentro. El store solo avisa
      // cuando el valor cambia y `false` es el valor de partida, así que el único aviso posible
      // aquí es el que lo deja listo.
      await new Promise<void>((resolve) => {
        const stopReady = $sessionReady.listen(() => {
          stopReady();
          resolve();
        });
      });
    }
    return $session.get();
  } finally {
    stopSession();
  }
}
