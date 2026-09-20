import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { presets } from '@trayectoria/sim-core';

import { TrackEditor } from './TrackEditor';

// `order` fixes the story sequence rendered by the /dev/sims playground explicitly, independent
// of module export iteration order (docs/audits F2-01a: hydration mismatch).
export default {
  title: 'TrackEditor',
  order: ['Empty', 'Oval', 'SCurve', 'TightCurves', 'Crossing', 'Selected'],
};

/** The editor over an empty track: the case the e2e of #126 draws on. */
export function Empty(): JSX.Element {
  return <TrackEditor />;
}

/** The `oval` preset of sim-core; the case captured in `TrackEditor-oval.png`. */
export function Oval(): JSX.Element {
  return <TrackEditor initialTrack={presets.oval} />;
}

/** The `sCurve` preset of sim-core; the case captured in `TrackEditor-s.png`. */
export function SCurve(): JSX.Element {
  return <TrackEditor initialTrack={presets.sCurve} />;
}

/** The `tightCurves` preset of sim-core; the case captured in `TrackEditor-tight.png`. */
export function TightCurves(): JSX.Element {
  return <TrackEditor initialTrack={presets.tightCurves} />;
}

/** The `crossing` preset of sim-core; the case captured in `TrackEditor-cross.png`. */
export function Crossing(): JSX.Element {
  return <TrackEditor initialTrack={presets.crossing} />;
}

/**
 * The `oval` preset with its second segment selected; the case captured in
 * `TrackEditor-selected.png` (#160): the selected segment is redrawn in `--color-primary` with a
 * circle at each end. The selection is made through the panel's own list — the public API of the
 * editor takes a track, not a selection — so the story shows exactly what a learner would see
 * after clicking that segment.
 */
export function Selected(): JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const buttons = hostRef.current?.querySelectorAll('[data-testid="track-editor-panel"] button');
    buttons?.[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }, []);
  return (
    <div ref={hostRef}>
      <TrackEditor initialTrack={presets.oval} />
    </div>
  );
}
