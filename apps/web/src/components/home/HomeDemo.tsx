import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { LineFollowerApi } from '@trayectoria/sims';

import { useMediaQuery } from '../sim/useMediaQuery';

// #648 (decision 2, #582 point 4): the hero of the home page is the line-follower simulator in
// demonstration mode — preset track, P controller, autoplay, no controls — with a link to the
// full simulator. It is the `LineFollowerWidget` as is (`compact` and `hideControls`, driven
// through `onApi`), so no new prop is needed. The widget is loaded with `import()` from its own
// entry, after the page is idle, so it does not weigh on the first paint nor bring the rest of
// `@trayectoria/sims`; until then a box of the same size holds its place.

/** The widget from its own entry (ADR-0009), resolved only when the demo mounts it. */
const LazyLineFollowerWidget = lazy(async () => {
  const module = await import('@trayectoria/sims/LineFollowerWidget');
  return { default: module.LineFollowerWidget };
});

/** Users who ask for less motion get the first frame, paused (docs/DESIGN.md §8). */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Preset track and controller of the demo (#582 point 4). */
const DEMO_TRACK = 'oval';
const DEMO_CONTROLLER = 'p';
const DEMO_PARAMS = {};

/** Runs `callback` once the browser is idle, or on the next task where that API is missing. */
function whenIdle(callback: () => void): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(callback);
    return () => {
      window.cancelIdleCallback(handle);
    };
  }
  const handle = window.setTimeout(callback, 0);
  return () => {
    window.clearTimeout(handle);
  };
}

/** Whether the page went idle after mounting, the moment the widget may load. */
function useIdle(): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(
    () =>
      whenIdle(() => {
        setIdle(true);
      }),
    [],
  );
  return idle;
}

/**
 * Starts the run as soon as the widget publishes its api, unless the user prefers reduced
 * motion; pauses it if that preference turns on while it plays.
 */
function useAutoplay(reducedMotion: boolean): (api: LineFollowerApi) => void {
  const apiRef = useRef<LineFollowerApi | null>(null);
  const startedRef = useRef(false);
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;

  useEffect(() => {
    const api = apiRef.current;
    if (reducedMotion && api?.driver.running === true) api.driver.pause();
  }, [reducedMotion]);

  return useCallback((api: LineFollowerApi) => {
    apiRef.current = api;
    if (startedRef.current || reducedRef.current) return;
    startedRef.current = true;
    api.driver.play();
  }, []);
}

/** Box that holds the place of the viewer (16:9, the aspect of `Scene2D`) until it loads. */
function Placeholder(): JSX.Element {
  return <div className="bg-bg aspect-video w-full rounded-md" aria-hidden="true" />;
}

export function HomeDemo(): JSX.Element {
  const t = useT();
  const idle = useIdle();
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const onApi = useAutoplay(reducedMotion);

  return (
    <figure
      className="bg-bg-raised border-border rounded-lg m-0 border p-4"
      aria-label={t('home.demo.label')}
      data-testid="home-demo"
    >
      {idle ? (
        <Suspense fallback={<Placeholder />}>
          <LazyLineFollowerWidget
            track={DEMO_TRACK}
            controller={DEMO_CONTROLLER}
            initialParams={DEMO_PARAMS}
            compact
            hideControls
            onApi={onApi}
          />
        </Suspense>
      ) : (
        <Placeholder />
      )}
      <figcaption className="mt-3 text-sm">
        <a href="/simuladores/movil" className="inline-flex min-h-[44px] items-center">
          {t('home.demo.open')}
        </a>
      </figcaption>
    </figure>
  );
}
