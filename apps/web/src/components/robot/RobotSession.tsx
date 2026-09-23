import { useEffect } from 'react';
import type { JSX } from 'react';

/**
 * Single point that connects "Mi robot" with the session on every page, not just `/cuenta`
 * (#238, orchestrator decision from PR #250, second round): a `client:load` island in the base
 * layout, alongside the pattern already used by progress (`ProgressSession`, §3.1).
 *
 * Previously only `MyRobotIsland` called `startRobotPersistence()`, so `currentOwnerId`
 * (`packages/widgets/src/stores/myRobot.ts`) stayed `null` outside `/cuenta`: a signed-in
 * student would see the reference robot instead of their own in the simulators and in the
 * themes. `MyRobotIsland` no longer mounts the persistence, to avoid duplicating it.
 *
 * `robotPersistence.ts` statically pulls in `@trayectoria/auth` and `@trayectoria/db` (the
 * Supabase client); since this island now mounts on every page, a static `import` of that
 * module would also enter the initial JS of the theme page, which already has its own budget
 * (docs/ARCHITECTURE.md §8, `bundleBudget.test.ts`). That's why it's loaded with `import()`,
 * just like `RobotSource` does with saved robots: the browser only downloads it when this
 * island actually mounts.
 *
 * Renders nothing: the islands that show the robot read `$myRobot`, not props.
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
