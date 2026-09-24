import { render } from '@testing-library/react';
import { degToRad } from '@trayectoria/sim-core';
import { describe, expect, test } from 'vitest';

import { ProjectileWidget } from './ProjectileWidget';

/**
 * The DOM of the uses that existed before `modes` (#304). The snapshots were taken on the code
 * previous to #304, so any change in these uses without `modes` fails here.
 */
describe('ProjectileWidget sin `modes` (#304)', () => {
  test('launch con overlay en t = 0.3 s, como la «Explora» de T-1.4', () => {
    const { container } = render(
      <ProjectileWidget
        mode="launch"
        initial={{ v0_mps: 4, launchAngle_rad: degToRad(40), h_m: 0.3 }}
        showVectors={['v', 'vx', 'vy']}
        overlay
        initialTime_s={0.3}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });

  test('drop, como la «Explora» de T-1.3', () => {
    const { container } = render(
      <ProjectileWidget mode="drop" initial={{ h_m: 0.25 }} showVectors={['v']} />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });

  test('dropFromRobot a 0.6 m/s desde 0.25 m', () => {
    const { container } = render(
      <ProjectileWidget
        mode="dropFromRobot"
        initial={{ vRobot_mps: 0.6, h_m: 0.25 }}
        showVectors={['v', 'vx', 'vy']}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
