import { beforeEach, describe, expect, test, vi } from 'vitest';
import { parseRobotSpec, referenceMobile } from '@trayectoria/robot-spec';
import type { RobotSpec } from '@trayectoria/robot-spec';

import {
  MY_ROBOT_STORAGE_KEY,
  $myRobot,
  configureMyRobotPersistence,
  referenceRobot,
  resetMyRobot,
} from './myRobot';
import type { RobotPersistence } from './myRobot';

function withWheelRadius(wheelRadius_m: number): RobotSpec {
  const parsed = parseRobotSpec(referenceMobile);
  if (!parsed.ok || parsed.value.mobile === undefined) throw new Error('referenceMobile must be valid');
  return { ...parsed.value, mobile: { ...parsed.value.mobile, wheelRadius_m } };
}

/** An adapter whose load stays pending until the test resolves it. */
function controlledAdapter(): { adapter: RobotPersistence; resolveLoad: (spec: RobotSpec | null) => void } {
  let resolvePending: (spec: RobotSpec | null) => void = () => undefined;
  const adapter: RobotPersistence = {
    load: vi.fn(
      () =>
        new Promise<RobotSpec | null>((resolve) => {
          resolvePending = resolve;
        }),
    ),
    save: vi.fn().mockResolvedValue(undefined),
  };
  return { adapter, resolveLoad: (spec) => resolvePending(spec) };
}

function storedRobot(): unknown {
  return JSON.parse(localStorage.getItem(MY_ROBOT_STORAGE_KEY) ?? 'null');
}

const ROBOT_A = withWheelRadius(0.04);
const ROBOT_B = withWheelRadius(0.06);

beforeEach(() => {
  void configureMyRobotPersistence(null);
  localStorage.clear();
  resetMyRobot();
});

describe('session switch while «Mi robot» loads (#218)', () => {
  test('a load of A that resolves after B keeps the robot of B', async () => {
    const a = controlledAdapter();
    const b = controlledAdapter();
    const loadingA = configureMyRobotPersistence(a.adapter);
    const loadingB = configureMyRobotPersistence(b.adapter);

    b.resolveLoad(ROBOT_B);
    await loadingB;
    a.resolveLoad(ROBOT_A);
    await loadingA;

    expect($myRobot.get()).toEqual(ROBOT_B);
    expect(storedRobot()).toEqual(ROBOT_B);
    expect(a.adapter.save).not.toHaveBeenCalled();
    expect(b.adapter.save).not.toHaveBeenCalled();
  });

  test('a load of A that resolves while B is still loading is discarded', async () => {
    const a = controlledAdapter();
    const b = controlledAdapter();
    const loadingA = configureMyRobotPersistence(a.adapter);
    const loadingB = configureMyRobotPersistence(b.adapter);

    a.resolveLoad(ROBOT_A);
    await loadingA;

    expect($myRobot.get()).toEqual(referenceRobot());
    expect(storedRobot()).toBeNull();

    b.resolveLoad(ROBOT_B);
    await loadingB;

    expect($myRobot.get()).toEqual(ROBOT_B);
    expect(b.adapter.save).not.toHaveBeenCalled();
  });

  test('a load of A that resolves after signing out leaves the store empty', async () => {
    const a = controlledAdapter();
    const loadingA = configureMyRobotPersistence(a.adapter);
    void configureMyRobotPersistence(null);

    a.resolveLoad(ROBOT_A);
    await loadingA;

    expect($myRobot.get()).toEqual(referenceRobot());
    expect(storedRobot()).toBeNull();
    expect(a.adapter.save).not.toHaveBeenCalled();
  });
});
