import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import { useMyRobot } from '@trayectoria/widgets';
import type { RobotSpec } from '@trayectoria/widgets';

import type { SavedRobot } from './savedRobots';

// F4-02b (#128, decisión 2): «Mi robot» por defecto y, con sesión, los robots guardados
// `kind = 'mobile-diff'` de la tabla `robots`. La lectura reutiliza el cliente y las políticas
// existentes; no hay migración ni política nueva.
//
// `savedRobots.ts` se carga con `import()` y no al montar: arrastra `@trayectoria/auth` y con él
// `@supabase/supabase-js` (≈ 55 kB comprimidos), que no tienen por qué entrar en el JS inicial de
// una página que simula igual de bien sin sesión (docs/ARCHITECTURE.md §8).

/** Valor del selector que significa «Mi robot», el del store local. */
export const MY_ROBOT_ID = 'my-robot';

const SELECT =
  'border-border bg-bg-raised text-fg h-11 rounded-md border px-3 text-sm ' +
  'focus-visible:outline-color-focus focus-visible:outline-2 focus-visible:outline-offset-2';

/** Los robots guardados del estudiante con sesión; lista vacía mientras no la haya. */
function useSavedRobots(): { robots: readonly SavedRobot[]; failed: boolean } {
  const [robots, setRobots] = useState<readonly SavedRobot[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    import('./savedRobots')
      .then(async (module) => module.loadForCurrentSession())
      .then((list) => {
        if (live) setRobots(list);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  return { robots, failed };
}

export interface RobotSourceProps {
  /** Id seleccionado: `MY_ROBOT_ID` o el de un robot guardado. */
  readonly selected: string;
  readonly onSelect: (id: string) => void;
  /** Se llama con el robot que la página debe simular cada vez que la selección cambia. */
  readonly onRobot: (spec: RobotSpec) => void;
}

/** Selector del robot: «Mi robot» y, con sesión, los robots móviles guardados. */
export function RobotSource({ selected, onSelect, onRobot }: RobotSourceProps): JSX.Element {
  const t = useT();
  const myRobot = useMyRobot();
  const { robots, failed } = useSavedRobots();

  // El robot efectivo se recalcula cuando cambia la selección, «Mi robot» o la lista guardada.
  useEffect(() => {
    const saved = robots.find((robot) => robot.id === selected);
    onRobot(saved?.spec ?? myRobot);
  }, [selected, robots, myRobot, onRobot]);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-fg-muted text-sm" htmlFor="robot-source">
        {t('sims.mobilePage.robotSource')}
      </label>
      <select
        id="robot-source"
        className={SELECT}
        aria-label={t('sims.mobilePage.robotSource')}
        data-testid="robot-source-select"
        value={selected}
        onChange={(event) => {
          onSelect(event.target.value);
        }}
      >
        <option value={MY_ROBOT_ID}>{t('sims.mobilePage.myRobot')}</option>
        {robots.map((robot) => (
          <option key={robot.id} value={robot.id}>
            {robot.name}
          </option>
        ))}
      </select>
      {failed ? (
        <p className="text-error text-sm" role="alert" data-testid="robot-source-error">
          {t('sims.mobilePage.savedError')}
        </p>
      ) : null}
    </div>
  );
}
