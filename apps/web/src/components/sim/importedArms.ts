/**
 * Los brazos importados del estudiante en `/simuladores/brazo` (F5-04, #137, decisiones 3 y 5).
 * Vive en `apps/web` porque solo la app puede importar `@trayectoria/db` y `@trayectoria/auth`
 * (regla de dependencias de `eslint.config.js`), y `ArmSimIsland` lo carga con `import()`, así que
 * `@supabase/supabase-js` no entra en el JS inicial de la página: un estudiante sin sesión nunca
 * llega a descargarlo (docs/ARCHITECTURE.md §8).
 *
 * Todo corre con el cliente de la sesión y la clave anon; RLS es el único control de acceso y no
 * hay migración ni política nueva.
 */
import { $session, $sessionReady } from '@trayectoria/auth';
import { getDbClient } from '@trayectoria/db';
import { robotSpecToJson } from '@trayectoria/widgets';
import type { RobotSpec } from '@trayectoria/widgets';

import { downloadRobotZip, listImportedArms, type ImportedArm } from '../../lib/robots/download';
import { saveUploadedRobot } from '../../lib/robots/storage';

export type { ImportedArm } from '../../lib/robots/download';

/**
 * El id del estudiante con sesión, o `null`. Espera a que `$session` se haya leído una vez.
 *
 * La suscripción a `$session` es la que arranca su `onMount` en `packages/auth`, que es quien lee
 * la sesión persistida y pone `$sessionReady` a `true`; sin ella el store nunca llega a resolverse
 * y la espera no terminaría. La suscripción se corta en cuanto termina.
 */
export async function currentOwnerId(): Promise<string | null> {
  const stopSession = $session.subscribe(() => undefined);
  try {
    if (!$sessionReady.get()) {
      await new Promise<void>((resolve) => {
        const stop = $sessionReady.subscribe((ready) => {
          if (!ready) return;
          stop();
          resolve();
        });
      });
    }
    return $session.get()?.user.id ?? null;
  } finally {
    stopSession();
  }
}

/** Los brazos guardados del estudiante con sesión ahora mismo, o la lista vacía si no la hay. */
export async function loadImportedArms(): Promise<readonly ImportedArm[]> {
  const ownerId = await currentOwnerId();
  return ownerId === null ? [] : listImportedArms(getDbClient(), ownerId);
}

/** El zip de un brazo guardado, descargado del propio bucket con la ruta que trae su fila. */
export async function fetchArmZip(urdfPath: string): Promise<Uint8Array> {
  return downloadRobotZip(getDbClient(), urdfPath);
}

/** Guarda un zip ya comprobado como un brazo del estudiante, igual que hace F3-04. */
export async function saveImportedArm(upload: {
  readonly ownerId: string;
  readonly robotId: string;
  readonly spec: RobotSpec;
  readonly zipBytes: Uint8Array;
}): Promise<ImportedArm> {
  const saved = await saveUploadedRobot(getDbClient(), {
    ownerId: upload.ownerId,
    robotId: upload.robotId,
    name: upload.spec.name,
    spec: robotSpecToJson(upload.spec),
    specVersion: upload.spec.specVersion,
    zipBytes: upload.zipBytes,
  });
  return { id: saved.id, name: saved.name, urdfPath: saved.urdfPath ?? '' };
}
