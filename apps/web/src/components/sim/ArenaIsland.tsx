import { Suspense, lazy } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';

import { createRemoteBus } from '../../lib/aula/remoteControl';
import { ClassroomPanel } from '../aula/ClassroomPanel';

// The island of `/simuladores/carrito`: the 3D line-follower arena. Like `ArmSimIsland`, it is
// `client:only="react"` and loads `@trayectoria/sims/arena` with a dynamic `import()`, so `three`
// only enters this page's chunk (docs/ARCHITECTURE.md §8).

const LazyArena = lazy(async () => {
  const module = await import('@trayectoria/sims/arena');
  return { default: module.Arena };
});

/** Where «Editar mi robot» goes: the account page with «Mi robot». */
const ROBOT_HREF = '/cuenta/robots';

function Loading(): JSX.Element {
  const t = useT();
  return (
    <p
      data-theme="dark"
      className="flex h-[calc(100dvh-4rem)] min-h-[40rem] items-center justify-center bg-bg text-sm text-fg-muted"
      role="status"
      aria-live="polite"
    >
      {t('sims.arenaPage.loading')}
    </p>
  );
}

// The classroom (#685): a teacher's phones drive the arena through this bus.
const bus = createRemoteBus();

export function ArenaIsland(): JSX.Element {
  return (
    <Suspense fallback={<Loading />}>
      <LazyArena robotHref={ROBOT_HREF} remote={bus} aula={<ClassroomPanel bus={bus} />} />
    </Suspense>
  );
}
