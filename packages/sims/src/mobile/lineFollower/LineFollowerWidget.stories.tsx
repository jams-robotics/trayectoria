import type { JSX } from 'react';
import { REFERENCE_PID_PARAMS } from '@trayectoria/sim-core';
import { referenceMobile } from '@trayectoria/robot-spec';
import type { RobotSpec } from '@trayectoria/robot-spec';

import { LineFollowerWidget } from './LineFollowerWidget';

// `order` fixes the story sequence rendered by the /dev/sims playground explicitly, independent
// of module export iteration order (docs/audits F2-01a: hydration mismatch).
export default {
  title: 'LineFollowerWidget',
  order: ['Oval', 'Compact', 'Topic'],
};

/** The reference robot, so the story never depends on «Mi robot» of the browser. */
const ROBOT = referenceMobile as RobotSpec;

/**
 * The oval with the reference PID, paused at `t = 0`: the case captured in
 * `LineFollowerWidget.png`. It only runs once the learner presses Reproducir.
 */
export function Oval(): JSX.Element {
  return (
    <LineFollowerWidget
      track="oval"
      controller="pid"
      initialParams={{ ...REFERENCE_PID_PARAMS }}
      robot={ROBOT}
    />
  );
}

/** The embedded viewer: `compact` on the `s` preset, with no controller panel and no legend. */
export function Compact(): JSX.Element {
  return (
    <LineFollowerWidget
      track="s"
      controller="pid"
      initialParams={{ ...REFERENCE_PID_PARAMS }}
      robot={ROBOT}
      compact
    />
  );
}

/**
 * The widget as a topic MDX writes it (#409, docs/WIDGETS.md): only serializable props, gains
 * under the keys of the code and no `robot`, so it runs «Mi robot» of the browser. Paused at
 * `t = 0`, it is the case captured in `LineFollowerWidget-topic.png`.
 */
export function Topic(): JSX.Element {
  return (
    <LineFollowerWidget
      track="s"
      controller="p"
      initialParams={{ kp: 12 }}
      noiseSigma={0.02}
      seed={7}
    />
  );
}
