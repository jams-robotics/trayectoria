import { useEffect } from 'react';
import type { JSX } from 'react';

/**
 * Único punto que conecta «Mi robot» con la sesión en toda página, no solo `/cuenta` (#238,
 * decisión del orquestador de PR #250, segunda ronda): una isla `client:load` en el layout
 * base, junto al patrón ya usado por el progreso (`ProgressSession`, §3.1).
 *
 * Antes solo `MyRobotIsland` llamaba a `startRobotPersistence()`, así que `currentOwnerId`
 * (`packages/widgets/src/stores/myRobot.ts`) se quedaba en `null` fuera de `/cuenta`: un
 * alumno con sesión veía el robot de referencia en vez del suyo en los simuladores y en los
 * temas. `MyRobotIsland` ya no monta la persistencia, para no duplicarla.
 *
 * `robotPersistence.ts` arrastra `@trayectoria/auth` y `@trayectoria/db` (el cliente de
 * Supabase) de forma estática; como esta isla ahora monta en toda página, un `import` estático
 * de ese módulo entraría en el JS inicial también de la página de tema, que ya tiene su propio
 * presupuesto (docs/ARCHITECTURE.md §8, `bundleBudget.test.ts`). Por eso se carga con
 * `import()`, igual que `RobotSource` hace con los robots guardados: el navegador solo lo
 * descarga cuando esta isla se monta de verdad.
 *
 * No renderiza nada: las islas que muestran el robot leen `$myRobot`, no props.
 */
export function RobotSession(): JSX.Element {
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let live = true;
    void import('../../stores/robotPersistence').then((module) => {
      if (live) unsubscribe = module.startRobotPersistence();
    });
    return () => {
      live = false;
      unsubscribe?.();
    };
  }, []);
  return <></>;
}
