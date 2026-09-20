import type { JSX } from 'react';
import { presets } from '@trayectoria/sim-core';

import { TrackEditor } from './TrackEditor';

// `order` fixes the story sequence rendered by the /dev/sims playground explicitly, independent
// of module export iteration order (docs/audits F2-01a: hydration mismatch).
export default {
  title: 'TrackEditor',
  order: ['Empty', 'Oval', 'SCurve', 'TightCurves', 'Crossing'],
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
