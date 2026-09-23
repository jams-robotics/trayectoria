import { beforeEach, describe, expect, test, vi } from 'vitest';
import { parseRobotSpec, referenceMobile } from '@trayectoria/robot-spec';
import type { RobotSpec } from '@trayectoria/robot-spec';

import {
  MY_ROBOT_STORAGE_KEY,
  $myRobot,
  configureMyRobotPersistence,
  referenceRobot,
  resetMyRobot,
  setMyRobot,
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

/** An adapter whose account holds `remote` (`null`: no robot saved in the account). */
function accountAdapter(remote: RobotSpec | null): RobotPersistence {
  return { load: vi.fn().mockResolvedValue(remote), save: vi.fn().mockResolvedValue(undefined) };
}

describe('«Mi robot» when the session ends or changes hands (#238)', () => {
  test('signing out goes back to the reference robot and drops the local copy', async () => {
    await configureMyRobotPersistence(accountAdapter(ROBOT_A));
    expect($myRobot.get()).toEqual(ROBOT_A);

    await configureMyRobotPersistence(null);

    expect($myRobot.get()).toEqual(referenceRobot());
    expect(storedRobot()).toBeNull();
  });

  test('a robot saved during the session is dropped too when signing out', async () => {
    const a = accountAdapter(null);
    await configureMyRobotPersistence(a);
    setMyRobot(ROBOT_A);

    await configureMyRobotPersistence(null);

    expect($myRobot.get()).toEqual(referenceRobot());
    expect(storedRobot()).toBeNull();
    expect(a.save).toHaveBeenCalledTimes(1);
  });

  test('an anonymous visit that never had a session keeps its local robot', async () => {
    setMyRobot(ROBOT_A);

    await configureMyRobotPersistence(null);

    expect($myRobot.get()).toEqual(ROBOT_A);
    expect(storedRobot()).toEqual(ROBOT_A);
  });

  test('signing in keeps the anonymous robot when the account has none', async () => {
    setMyRobot(ROBOT_A);

    await configureMyRobotPersistence(accountAdapter(null));

    expect($myRobot.get()).toEqual(ROBOT_A);
    expect(storedRobot()).toEqual(ROBOT_A);
  });

  test('B signing in after A signed out does not get the robot of A', async () => {
    await configureMyRobotPersistence(accountAdapter(ROBOT_A));
    await configureMyRobotPersistence(null);

    await configureMyRobotPersistence(accountAdapter(null));

    expect($myRobot.get()).toEqual(referenceRobot());
    expect(storedRobot()).toBeNull();
  });

  test('switching from A to B, whose account has no robot, does not hand B the robot of A', async () => {
    await configureMyRobotPersistence(accountAdapter(ROBOT_A));

    await configureMyRobotPersistence(accountAdapter(null));

    expect($myRobot.get()).toEqual(referenceRobot());
    expect(storedRobot()).toBeNull();
  });

  test('switching from A to B adopts the robot saved in the account of B', async () => {
    await configureMyRobotPersistence(accountAdapter(ROBOT_A));

    await configureMyRobotPersistence(accountAdapter(ROBOT_B));

    expect($myRobot.get()).toEqual(ROBOT_B);
    expect(storedRobot()).toEqual(ROBOT_B);
  });
});
