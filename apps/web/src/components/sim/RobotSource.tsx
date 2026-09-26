import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';
import { useMyRobot } from '@trayectoria/widgets/MyRobotWidget';
import type { RobotSpec } from '@trayectoria/widgets/MyRobotWidget';

import type { SavedRobot } from './savedRobots';

// F4-02b (#128, decision 2): «Mi robot» by default and, with a session, the saved robots
// `kind = 'mobile-diff'` of the `robots` table. The read reuses the existing client and
// policies; there is no new migration or policy.
//
// `savedRobots.ts` is loaded with `import()` and not on mount: it drags in `@trayectoria/auth` and
// with it `@supabase/supabase-js` (≈ 55 kB compressed), which have no reason to enter the initial
// JS of a page that simulates just as well without a session (docs/ARCHITECTURE.md §8).

// F4-04 (#130, decision 5): also, the «Referencia» group with the three robots of
// `catalog/mobile/`. They are downloaded with `loadCatalogMobileAll` of `@trayectoria/sims`, which
// validates them with `parseRobotSpec`; no robot value is copied here.

/** Selector value that means «Mi robot», the one from the local store. */
export const MY_ROBOT_ID = 'my-robot';

/** Prefix of the «Referencia» group values, so they do not clash with a saved robot id. */
export const CATALOG_PREFIX = 'catalog:';

/** An already downloaded and validated reference robot, as the selector shows it. */
export interface CatalogRobot {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly spec: RobotSpec;
}

const SELECT =
  'border-border bg-bg-raised text-fg h-11 rounded-md border px-3 text-sm ' +
  'focus-visible:outline-color-focus focus-visible:outline-2 focus-visible:outline-offset-2';

/** The saved robots of the signed-in learner; empty list while there is no session. */
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
 * The three reference robots of `catalog/mobile/` (#130, decision 5). They are loaded with
 * `import()` like the rest of the simulator, so they do not enter the page's initial JS; if the
 * download fails, the selector keeps «Mi robot» and the saved ones.
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
 * Publishes the effective robot every time the selection, «Mi robot», the saved list or the
 * reference list changes. A selection that is not yet in any list falls back to «Mi robot».
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

/** The «Referencia» group of the selector; empty while the catalogue has not responded. */
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

/** Notice for a list that could not be loaded; nothing while loading goes well. */
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
  /** Selected id: `MY_ROBOT_ID` or that of a saved robot. */
  readonly selected: string;
  readonly onSelect: (id: string) => void;
  /** Called with the robot the page must simulate every time the selection changes. */
  readonly onRobot: (spec: RobotSpec) => void;
}

/** Robot selector: «Mi robot», the three reference ones and, with a session, the saved ones. */
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
