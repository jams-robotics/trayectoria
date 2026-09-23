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
function controlledAdapter(
  ownerId: string,
): { adapter: RobotPersistence; resolveLoad: (spec: RobotSpec | null) => void } {
  let resolvePending: (spec: RobotSpec | null) => void = () => undefined;
  const adapter: RobotPersistence = {
    ownerId,
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
    const a = controlledAdapter('owner-a');
    const b = controlledAdapter('owner-b');
    const loadingA = configureMyRobotPersistence(a.adapter);
    const loadingB = configureMyRobotPersistence(b.adapter);

    b.resolveLoad(ROBOT_B);
    await loadingB;
    a.resolveLoad(ROBOT_A);
    await loadingA;

    expect($myRobot.get()).toEqual(ROBOT_B);
    expect(storedRobot()).toEqual({ owner: 'owner-b', spec: ROBOT_B });
    expect(a.adapter.save).not.toHaveBeenCalled();
    expect(b.adapter.save).not.toHaveBeenCalled();
  });

  test('a load of A that resolves while B is still loading is discarded', async () => {
    const a = controlledAdapter('owner-a');
    const b = controlledAdapter('owner-b');
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
    const a = controlledAdapter('owner-a');
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
function accountAdapter(ownerId: string, remote: RobotSpec | null): RobotPersistence {
  return { ownerId, load: vi.fn().mockResolvedValue(remote), save: vi.fn().mockResolvedValue(undefined) };
}

describe('«Mi robot» when the session ends or changes hands (#238)', () => {
  test('signing out goes back to the reference robot and drops the local copy', async () => {
    await configureMyRobotPersistence(accountAdapter('owner-a', ROBOT_A));
    expect($myRobot.get()).toEqual(ROBOT_A);

    await configureMyRobotPersistence(null);

    expect($myRobot.get()).toEqual(referenceRobot());
    expect(storedRobot()).toBeNull();
  });

  test('a robot saved during the session is dropped too when signing out', async () => {
    const a = accountAdapter('owner-a', null);
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
    expect(storedRobot()).toEqual({ owner: null, spec: ROBOT_A });
  });

  test('signing in keeps the anonymous robot when the account has none', async () => {
    setMyRobot(ROBOT_A);

    await configureMyRobotPersistence(accountAdapter('owner-b', null));

    expect($myRobot.get()).toEqual(ROBOT_A);
    expect(storedRobot()).toEqual({ owner: null, spec: ROBOT_A });
  });

  test('B signing in after A signed out does not get the robot of A', async () => {
    await configureMyRobotPersistence(accountAdapter('owner-a', ROBOT_A));
    await configureMyRobotPersistence(null);

    await configureMyRobotPersistence(accountAdapter('owner-b', null));

    expect($myRobot.get()).toEqual(referenceRobot());
    expect(storedRobot()).toBeNull();
  });

  test('switching from A to B, whose account has no robot, does not hand B the robot of A', async () => {
    await configureMyRobotPersistence(accountAdapter('owner-a', ROBOT_A));

    await configureMyRobotPersistence(accountAdapter('owner-b', null));

    expect($myRobot.get()).toEqual(referenceRobot());
    expect(storedRobot()).toBeNull();
  });

  test('switching from A to B adopts the robot saved in the account of B', async () => {
    await configureMyRobotPersistence(accountAdapter('owner-a', ROBOT_A));

    await configureMyRobotPersistence(accountAdapter('owner-b', ROBOT_B));

    expect($myRobot.get()).toEqual(ROBOT_B);
    expect(storedRobot()).toEqual({ owner: 'owner-b', spec: ROBOT_B });
  });

  // The security review of PR #250 (#238): A's session can end with no `/cuenta` page open (it
  // expires, `signOut()` on another device revokes it, or the browser just closes), so no
  // `configureMyRobotPersistence` call ever sees A leave — the in-memory state a reload used to
  // rely on is gone, but the owner written into `localStorage` is not. This reproduces a reload
  // by reimporting the module fresh, with A's copy already on disk, before the session settles.
  test("A closes the browser signed in, the session expires, and B signs in with no robot without seeing A's", async () => {
    localStorage.setItem(MY_ROBOT_STORAGE_KEY, JSON.stringify({ owner: 'owner-a', spec: ROBOT_A }));
    vi.resetModules();
    const fresh = await import('./myRobot');

    // The session settles to anonymous: this page never saw A's `configureMyRobotPersistence`.
    await fresh.configureMyRobotPersistence(null);

    expect(fresh.$myRobot.get()).toEqual(fresh.referenceRobot());
    expect(storedRobot()).toBeNull();

    await fresh.configureMyRobotPersistence(accountAdapter('owner-b', null));

    expect(fresh.$myRobot.get()).toEqual(fresh.referenceRobot());
    expect(storedRobot()).toBeNull();
  });
});

// Regression the security review of PR #250 caught in its second round, outside `/cuenta`:
// `hydrateMyRobot()` (`useMyRobot`'s effect) can run before the session settles, while
// `currentOwnerId` is still `null`, and cache the reference robot for the life of the page —
// its own guard then blocks a second read. `configureMyRobotPersistence` must override that
// stale value itself, as soon as it learns the local copy belongs to the incoming learner,
// instead of waiting for the remote load.
describe('adopting the local copy right away when it matches the incoming session (#238, PR #250 second round)', () => {
  test('the local copy is applied before the remote load resolves, not after', async () => {
    localStorage.setItem(MY_ROBOT_STORAGE_KEY, JSON.stringify({ owner: 'owner-a', spec: ROBOT_A }));
    vi.resetModules();
    const fresh = await import('./myRobot');
    // Reproduces `hydrateMyRobot` running first, with the session not settled yet: it reads
    // `currentOwnerId === null`, so the copy (owned by A) does not match and it falls back.
    fresh.hydrateMyRobot();
    expect(fresh.$myRobot.get()).toEqual(fresh.referenceRobot());

    const a = controlledAdapter('owner-a');
    void fresh.configureMyRobotPersistence(a.adapter);

    // Applied synchronously: it does not wait for `a.adapter.load()` to resolve.
    expect(fresh.$myRobot.get()).toEqual(ROBOT_A);
  });

  test('a failed remote load leaves the learner with the robot adopted from the local copy', async () => {
    localStorage.setItem(MY_ROBOT_STORAGE_KEY, JSON.stringify({ owner: 'owner-a', spec: ROBOT_A }));
    vi.resetModules();
    const fresh = await import('./myRobot');
    const adapter: RobotPersistence = {
      ownerId: 'owner-a',
      load: vi.fn().mockRejectedValue(new Error('sin red')),
      save: vi.fn().mockResolvedValue(undefined),
    };

    await fresh.configureMyRobotPersistence(adapter);

    expect(fresh.$myRobot.get()).toEqual(ROBOT_A);
    expect(storedRobot()).toEqual({ owner: 'owner-a', spec: ROBOT_A });
  });
});
