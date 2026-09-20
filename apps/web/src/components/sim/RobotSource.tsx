import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';
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

// F4-04 (#130, decisión 5): además, el grupo «Referencia» con los tres robots de
// `catalog/mobile/`. Se descargan con `loadCatalogMobileAll` de `@trayectoria/sims`, que los
// valida con `parseRobotSpec`; ningún valor de los robots se copia aquí.

/** Valor del selector que significa «Mi robot», el del store local. */
export const MY_ROBOT_ID = 'my-robot';

/** Prefijo de los valores del grupo «Referencia», para no chocar con el id de un robot guardado. */
export const CATALOG_PREFIX = 'catalog:';

/** Un robot de referencia ya descargado y validado, tal y como lo muestra el selector. */
export interface CatalogRobot {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly spec: RobotSpec;
}

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

/**
 * Los tres robots de referencia de `catalog/mobile/` (#130, decisión 5). Se cargan con `import()`
 * igual que el resto del simulador, así que no entran en el JS inicial de la página; si la
 * descarga falla, el selector se queda con «Mi robot» y los guardados.
 */
function useCatalogRobots(): { robots: readonly CatalogRobot[]; failed: boolean } {
  const [robots, setRobots] = useState<readonly CatalogRobot[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    import('@trayectoria/sims')
      .then(async (module) => {
        const entries = await module.loadCatalogMobileAll();
        return entries.map((entry) => ({
          id: `${CATALOG_PREFIX}${entry.id}`,
          name: entry.spec.name,
          summary: module.summaryOf(entry.spec),
          spec: entry.spec,
        }));
      })
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

/**
 * Publica el robot efectivo cada vez que cambia la selección, «Mi robot», la lista guardada o la
 * de referencia. Una selección que todavía no está en ninguna lista cae en «Mi robot».
 */
function useEffectiveRobot(options: {
  selected: string;
  robots: readonly SavedRobot[];
  catalog: readonly CatalogRobot[];
  myRobot: RobotSpec;
  onRobot: (spec: RobotSpec) => void;
}): void {
  const { selected, robots, catalog, myRobot, onRobot } = options;
  useEffect(() => {
    const reference = catalog.find((robot) => robot.id === selected);
    const saved = robots.find((robot) => robot.id === selected);
    onRobot(reference?.spec ?? saved?.spec ?? myRobot);
  }, [selected, robots, catalog, myRobot, onRobot]);
}

/** El grupo «Referencia» del selector; vacío mientras el catálogo no haya respondido. */
function CatalogGroup({
  robots,
  t,
}: {
  robots: readonly CatalogRobot[];
  t: Translate;
}): JSX.Element | null {
  if (robots.length === 0) return null;
  return (
    <optgroup label={t('sims.catalog.group')}>
      {robots.map((robot) => (
        <option key={robot.id} value={robot.id}>
          {t('sims.catalog.option', { name: robot.name, summary: robot.summary })}
        </option>
      ))}
    </optgroup>
  );
}

/** Aviso de una lista que no se pudo cargar; nada mientras la carga vaya bien. */
function LoadError({
  shown,
  testId,
  text,
}: {
  shown: boolean;
  testId: string;
  text: string;
}): JSX.Element | null {
  if (!shown) return null;
  return (
    <p className="text-error text-sm" role="alert" data-testid={testId}>
      {text}
    </p>
  );
}

export interface RobotSourceProps {
  /** Id seleccionado: `MY_ROBOT_ID` o el de un robot guardado. */
  readonly selected: string;
  readonly onSelect: (id: string) => void;
  /** Se llama con el robot que la página debe simular cada vez que la selección cambia. */
  readonly onRobot: (spec: RobotSpec) => void;
}

/** Selector del robot: «Mi robot», los tres de referencia y, con sesión, los guardados. */
export function RobotSource({ selected, onSelect, onRobot }: RobotSourceProps): JSX.Element {
  const t = useT();
  const myRobot = useMyRobot();
  const { robots, failed } = useSavedRobots();
  const catalog = useCatalogRobots();

  useEffectiveRobot({ selected, robots, catalog: catalog.robots, myRobot, onRobot });

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
        <CatalogGroup robots={catalog.robots} t={t} />
        {robots.map((robot) => (
          <option key={robot.id} value={robot.id}>
            {robot.name}
          </option>
        ))}
      </select>
      <LoadError shown={failed} testId="robot-source-error" text={t('sims.mobilePage.savedError')} />
      <LoadError
        shown={catalog.failed}
        testId="robot-catalog-error"
        text={t('sims.catalog.loadError')}
      />
    </div>
  );
}
