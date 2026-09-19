/**
 * «Mi robot»: the one `RobotSpec` every widget of the platform reads (docs/ROBOT-SPEC.md §3).
 * This module is the only place in `packages/widgets` that touches `localStorage`
 * (docs/STANDARDS.md); remote persistence is injected, because widgets may not import
 * `@trayectoria/auth` or `@trayectoria/db` (dependency rule of `eslint.config.js`).
 */
import { atom } from 'nanostores';
import { parseRobotSpec, referenceMobile } from '@trayectoria/robot-spec';
import type { RobotSpec, ValidationError } from '@trayectoria/robot-spec';

/** Key of the browser copy of «Mi robot» (#95, decision 2). */
export const MY_ROBOT_STORAGE_KEY = 'trayectoria.myRobot';

export type SaveResult =
  | { readonly ok: true; readonly value: RobotSpec }
  | { readonly ok: false; readonly errors: readonly ValidationError[] };

/**
 * How the store reaches a durable copy of the robot. `apps/web` injects the Supabase adapter
 * (`src/stores/robotPersistence.ts`); with none, «Mi robot» lives only in this browser.
 */
export interface RobotPersistence {
  load: () => Promise<RobotSpec | null>;
  save: (spec: RobotSpec) => Promise<void>;
}

const REFERENCE = parseRobotSpec(referenceMobile);

/** The reference robot of docs/ROBOT-SPEC.md §3, validated once at module load. */
export function referenceRobot(): RobotSpec {
  if (!REFERENCE.ok) throw new Error('El robot de referencia de robot-spec no es válido');
  return REFERENCE.value;
}

// Astro renders islands on the server too, where there is no `localStorage`; the store then
// holds the reference robot, which is what the server markup shows.
function storage(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

/**
 * Validates a spec that came from storage — the browser copy or the remote row — and hands it
 * back, or `null` when it is not a valid `RobotSpec`. The injected adapter uses it so that
 * `apps/web` never has to parse a spec itself.
 */
export function parseStoredRobot(input: unknown): RobotSpec | null {
  const parsed = parseRobotSpec(input);
  return parsed.ok ? parsed.value : null;
}

/** The stored robot, or the reference one when nothing valid is stored (#95, decision 2). */
export function readStoredRobot(): RobotSpec {
  const raw = storage()?.getItem(MY_ROBOT_STORAGE_KEY);
  if (raw === null || raw === undefined) return referenceRobot();
  try {
    const parsed = parseRobotSpec(JSON.parse(raw));
    return parsed.ok ? parsed.value : referenceRobot();
  } catch {
    return referenceRobot();
  }
}

/** The robot every widget reads; always a valid spec. */
export const $myRobot = atom<RobotSpec>(readStoredRobot());

let persistence: RobotPersistence | null = null;

function writeStoredRobot(spec: RobotSpec | null): void {
  const store = storage();
  if (store === null) return;
  if (spec === null) store.removeItem(MY_ROBOT_STORAGE_KEY);
  else store.setItem(MY_ROBOT_STORAGE_KEY, JSON.stringify(spec));
}

/**
 * Validates `input`, applies it and persists it: to `localStorage` always, and to the remote
 * adapter when one is configured. An invalid spec changes nothing and comes back as errors.
 */
export function setMyRobot(input: unknown): SaveResult {
  const parsed = parseRobotSpec(input);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  $myRobot.set(parsed.value);
  writeStoredRobot(parsed.value);
  // A failed remote save does not undo the local one: the robot stays applied in this browser
  // and the next save retries (#95, decision 2).
  void persistence?.save(parsed.value).catch(() => undefined);
  return { ok: true, value: parsed.value };
}

/**
 * Back to the reference robot of docs/ROBOT-SPEC.md §3, locally and remotely. It cannot fail,
 * so it hands the spec back directly instead of a `SaveResult`.
 */
export function resetMyRobot(): RobotSpec {
  const spec = referenceRobot();
  $myRobot.set(spec);
  writeStoredRobot(null);
  void persistence?.save(spec).catch(() => undefined);
  return spec;
}

/**
 * Attaches the remote adapter (or detaches it with `null`) and adopts the robot it holds: a
 * valid remote spec replaces the local one, so a learner signing in on another device gets
 * their own robot back (#95, decision 2).
 */
export async function configureMyRobotPersistence(adapter: RobotPersistence | null): Promise<void> {
  persistence = adapter;
  if (adapter === null) return;
  const remote = await adapter.load().catch(() => null);
  if (remote === null) return;
  const parsed = parseRobotSpec(remote);
  if (!parsed.ok) return;
  $myRobot.set(parsed.value);
  writeStoredRobot(parsed.value);
}
