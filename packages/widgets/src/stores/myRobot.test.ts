import { beforeEach, describe, expect, test, vi } from 'vitest';
import { parseRobotSpec, referenceMobile } from '@trayectoria/robot-spec';
import type { RobotSpec } from '@trayectoria/robot-spec';

import {
  MY_ROBOT_STORAGE_KEY,
  $myRobot,
  configureMyRobotPersistence,
  hydrateMyRobot,
  readStoredRobot,
  robotSpecToJson,
  resetMyRobot,
  setMyRobot,
} from './myRobot';
import type { RobotPersistence } from './myRobot';

function reference(): RobotSpec {
  const parsed = parseRobotSpec(referenceMobile);
  if (!parsed.ok) throw new Error('referenceMobile must be valid');
  return parsed.value;
}

/** The reference robot with a different wheel radius, the field the golden values exercise. */
function withWheelRadius(wheelRadius_m: number): RobotSpec {
  const spec = reference();
  if (spec.mobile === undefined) throw new Error('referenceMobile has a mobile profile');
  return { ...spec, mobile: { ...spec.mobile, wheelRadius_m } };
}

beforeEach(() => {
  void configureMyRobotPersistence(null);
  localStorage.clear();
  resetMyRobot();
  hydrateMyRobot();
});

describe('$myRobot (F2-11)', () => {
  test('starts from the reference robot of docs/ROBOT-SPEC.md §3', () => {
    expect($myRobot.get()).toEqual(reference());
  });

  // The server renders islands too, so the atom must not read `localStorage` before the
  // island is hydrated: it starts from the reference robot, the same one the server rendered,
  // and `hydrateMyRobot` adopts the stored one from an effect (docs/audits F2-01a).
  test('starts from the reference robot and adopts the stored one on hydration', async () => {
    const spec = withWheelRadius(0.05);
    localStorage.setItem(MY_ROBOT_STORAGE_KEY, JSON.stringify(spec));
    vi.resetModules();
    const fresh = await import('./myRobot');

    expect(fresh.$myRobot.get()).toEqual(reference());

    fresh.hydrateMyRobot();

    expect(fresh.$myRobot.get()).toEqual(spec);
  });

  test('hydrating twice reads the stored robot only once', async () => {
    vi.resetModules();
    const fresh = await import('./myRobot');
    fresh.hydrateMyRobot();
    fresh.setMyRobot(withWheelRadius(0.06));

    fresh.hydrateMyRobot();

    expect(fresh.$myRobot.get()).toEqual(withWheelRadius(0.06));
  });

  test('hydrating with no document (SSR) keeps the reference robot', async () => {
    localStorage.setItem(MY_ROBOT_STORAGE_KEY, JSON.stringify(withWheelRadius(0.05)));
    const realDocument = globalThis.document;
    vi.resetModules();
    // @ts-expect-error the server has no `document`; this reproduces that environment.
    delete globalThis.document;
    try {
      const fresh = await import('./myRobot');
      fresh.hydrateMyRobot();
      expect(fresh.$myRobot.get()).toEqual(reference());
    } finally {
      Object.defineProperty(globalThis, 'document', { value: realDocument, configurable: true });
    }
  });

  test('falls back to the reference robot when localStorage holds an invalid spec', () => {
    localStorage.setItem(MY_ROBOT_STORAGE_KEY, JSON.stringify({ name: 'roto' }));
    expect(readStoredRobot()).toEqual(reference());
  });

  test('falls back to the reference robot when localStorage holds unparseable JSON', () => {
    localStorage.setItem(MY_ROBOT_STORAGE_KEY, 'no es json');
    expect(readStoredRobot()).toEqual(reference());
  });

  test('reads back a valid stored spec', () => {
    const spec = withWheelRadius(0.05);
    localStorage.setItem(MY_ROBOT_STORAGE_KEY, JSON.stringify(spec));
    expect(readStoredRobot()).toEqual(spec);
  });

  test('setMyRobot rejects a wheel radius of 0.5 m and keeps the stored robot', () => {
    const result = setMyRobot(withWheelRadius(0.5));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('0.5 m is out of the [0.005, 0.3] range of MobileSpec');
    expect(result.errors.map((error) => error.path)).toContain('mobile.wheelRadius_m');
    expect($myRobot.get()).toEqual(reference());
    expect(localStorage.getItem(MY_ROBOT_STORAGE_KEY)).toBeNull();
  });

  test('setMyRobot stores a valid spec and publishes it', () => {
    const spec = withWheelRadius(0.05);
    const result = setMyRobot(spec);

    expect(result.ok).toBe(true);
    expect($myRobot.get()).toEqual(spec);
    expect(JSON.parse(localStorage.getItem(MY_ROBOT_STORAGE_KEY) ?? 'null')).toEqual(spec);
  });

  test('resetMyRobot returns to the reference robot and clears the stored one', () => {
    setMyRobot(withWheelRadius(0.05));
    resetMyRobot();

    expect($myRobot.get()).toEqual(reference());
    expect(localStorage.getItem(MY_ROBOT_STORAGE_KEY)).toBeNull();
  });
});

describe('robotSpecToJson (F2-11)', () => {
  test('hands the spec over as plain JSON data, losing nothing', () => {
    const spec = withWheelRadius(0.05);

    const json = robotSpecToJson(spec);

    expect(json).toEqual(spec);
    // It is data, not the spec object: the row written to the jsonb column is independent.
    expect(json).not.toBe(spec);
  });

  test('round-trips back through parseRobotSpec', () => {
    const spec = withWheelRadius(0.05);

    expect(parseRobotSpec(robotSpecToJson(spec))).toEqual({ ok: true, value: spec });
  });
});

describe('$myRobot without a DOM (F2-11)', () => {
  // Astro renders islands on the server too, where there is no `localStorage`: the store must
  // then fall back to the reference robot instead of throwing (#95, decision 2).
  test('falls back to the reference robot when there is no localStorage', () => {
    const real = globalThis.localStorage;
    // @ts-expect-error the server has no `localStorage`; this reproduces that environment.
    delete globalThis.localStorage;
    try {
      expect(readStoredRobot()).toEqual(reference());
      expect(setMyRobot(withWheelRadius(0.05)).ok).toBe(true);
      expect(resetMyRobot()).toEqual(reference());
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { value: real, configurable: true });
    }
  });
});

describe('remote persistence of $myRobot (F2-11)', () => {
  test('a remote spec replaces the local one when the adapter is configured', async () => {
    const remote = withWheelRadius(0.04);
    const adapter: RobotPersistence = {
      load: vi.fn().mockResolvedValue(remote),
      save: vi.fn().mockResolvedValue(undefined),
    };

    await configureMyRobotPersistence(adapter);

    expect($myRobot.get()).toEqual(remote);
    expect(JSON.parse(localStorage.getItem(MY_ROBOT_STORAGE_KEY) ?? 'null')).toEqual(remote);
  });

  test('an empty or invalid remote spec leaves the local robot in place', async () => {
    setMyRobot(withWheelRadius(0.05));
    const adapter: RobotPersistence = {
      load: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    };

    await configureMyRobotPersistence(adapter);

    expect($myRobot.get()).toEqual(withWheelRadius(0.05));
  });

  test('setMyRobot forwards the saved spec to the adapter', async () => {
    const adapter: RobotPersistence = {
      load: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    };
    await configureMyRobotPersistence(adapter);

    const spec = withWheelRadius(0.06);
    setMyRobot(spec);

    expect(adapter.save).toHaveBeenCalledWith(spec);
  });

  test('a rejected save leaves the local robot applied', async () => {
    const adapter: RobotPersistence = {
      load: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockRejectedValue(new Error('sin red')),
    };
    await configureMyRobotPersistence(adapter);

    const spec = withWheelRadius(0.06);
    expect(setMyRobot(spec).ok).toBe(true);
    await Promise.resolve();

    expect($myRobot.get()).toEqual(spec);
  });

  test('an invalid remote spec is ignored', async () => {
    const adapter: RobotPersistence = {
      load: vi.fn().mockResolvedValue({ name: 'roto' }),
      save: vi.fn().mockResolvedValue(undefined),
    };

    await configureMyRobotPersistence(adapter);

    expect($myRobot.get()).toEqual(reference());
  });

  test('a rejected load leaves the local robot in place', async () => {
    setMyRobot(withWheelRadius(0.05));
    const adapter: RobotPersistence = {
      load: vi.fn().mockRejectedValue(new Error('sin red')),
      save: vi.fn().mockResolvedValue(undefined),
    };

    await configureMyRobotPersistence(adapter);

    expect($myRobot.get()).toEqual(withWheelRadius(0.05));
  });

  test('resetMyRobot pushes the reference robot to the adapter too', async () => {
    const adapter: RobotPersistence = {
      load: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    };
    await configureMyRobotPersistence(adapter);

    resetMyRobot();

    expect(adapter.save).toHaveBeenCalledWith(reference());
  });

  test('configuring `null` detaches the adapter', async () => {
    const adapter: RobotPersistence = {
      load: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    };
    await configureMyRobotPersistence(adapter);
    void configureMyRobotPersistence(null);

    setMyRobot(withWheelRadius(0.06));

    expect(adapter.save).not.toHaveBeenCalled();
  });
});
