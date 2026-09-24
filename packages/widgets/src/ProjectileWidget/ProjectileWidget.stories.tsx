import type { JSX } from 'react';
import { degToRad } from '@trayectoria/sim-core';

import { ProjectileWidget } from './ProjectileWidget';

// `order` fixes the story sequence rendered by the /dev/widgets playground explicitly,
// independent of module export iteration order (docs/audits F2-01a: hydration mismatch).
export default { title: 'ProjectileWidget', order: ['Launch', 'Drop', 'DropFromRobot'] };

/** Time the captured story opens at, in seconds (#88, decision 9). */
const CAPTURE_TIME_S = 0.3;
/** Launch angle of the «Explora» of T-1.4, in degrees. */
const LAUNCH_ANGLE_DEG = 40;

/**
 * The exact props of the «Explora» of T-1.4, opened at t = 0.3 s: this is the case captured in
 * `ProjectileWidget.png` (#88, decision 9).
 */
export function Launch(): JSX.Element {
  return (
    <ProjectileWidget
      mode="launch"
      initial={{ v0_mps: 4, launchAngle_rad: degToRad(LAUNCH_ANGLE_DEG), h_m: 0.3 }}
      showVectors={['v', 'vx', 'vy']}
      overlay
      initialTime_s={CAPTURE_TIME_S}
    />
  );
}

/**
 * The «Explora» of T-1.3 with experiment 2: the gripper drops a part from 0.25 m and the
 * overlaid drop B falls from four times that height (#304).
 */
export function Drop(): JSX.Element {
  return <ProjectileWidget mode="drop" initial={{ h_m: 0.25 }} showVectors={['v']} overlay />;
}

/**
 * Experiment 4 of T-1.4 with the mode selector (#304): it opens with the robot advancing at
 * 0.6 m/s that drops the part from 0.25 m, and «Lanzar» switches to the launch at 4 m/s, 40°.
 */
export function DropFromRobot(): JSX.Element {
  return (
    <ProjectileWidget
      mode="dropFromRobot"
      modes={['launch', 'dropFromRobot']}
      initial={{
        v0_mps: 4,
        launchAngle_rad: degToRad(LAUNCH_ANGLE_DEG),
        h_m: 0.25,
        vRobot_mps: 0.6,
      }}
      showVectors={['v', 'vx', 'vy']}
    />
  );
}
