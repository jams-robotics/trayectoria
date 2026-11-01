import type { ControllerId } from '../lineFollower/controllers';
import type { ArenaTrackId } from './arenaTracks';
import type { Racer } from './race';

// Challenges of the arena. Each one sets up the track, the controller and the ghost, and is
// checked on the racers' states only, so passing one is a fact of the simulation. The targets
// were calibrated on the reference robot (see `challenges.test.ts`): every challenge has a
// known solution, and the default gains of its controller do not pass the hard ones.

export type ChallengeId =
  | 'firstLap'
  | 'onoffOval'
  | 'cleanS'
  | 'tightP'
  | 'beatGhost'
  | 'ovalSprint'
  | 'cleanCircuit'
  | 'pilot';

export interface Challenge {
  readonly id: ChallengeId;
  /** 1 to 3; only orders the list and paints the badge. */
  readonly level: 1 | 2 | 3;
  readonly track: ArenaTrackId;
  /** Controller the challenge opens with; `null` leaves the learner's choice. */
  readonly controller: ControllerId | null;
  readonly ghost: boolean;
  /** Whether the run passes, given the learner's controller and both racers. */
  passed(run: ChallengeRun): boolean;
}

export interface ChallengeRun {
  readonly controller: ControllerId;
  readonly you: Racer;
  readonly ghost: Racer | null;
  /** False when the rival is not the reference PID; `beatGhost` then does not count. */
  readonly rivalIsReference?: boolean;
}

/** Target lap of «Sprint en el óvalo», in seconds: the reference PID does 8.4 s. */
export const OVAL_SPRINT_S = 5.5;
/** Target average lap of «Circuito limpio», in seconds: the reference PID does 18.2 s. */
export const CLEAN_CIRCUIT_S = 12;
/** Target lap of «Piloto», in seconds, driving by hand on the oval. */
export const PILOT_S = 10;

function laps(run: ChallengeRun, count: number): boolean {
  return run.you.laps_s.length >= count && !run.you.derailed;
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function beatsGhost({ you, ghost, rivalIsReference = true }: ChallengeRun): boolean {
  if (!rivalIsReference) return false;
  const mine = you.laps_s[0];
  if (mine === undefined || ghost === null) return false;
  const theirs = ghost.laps_s[0];
  return theirs === undefined || mine < theirs;
}

export const CHALLENGES: readonly Challenge[] = [
  {
    id: 'firstLap',
    level: 1,
    track: 'oval',
    controller: 'pid',
    ghost: false,
    passed: (run) => run.controller !== 'manual' && laps(run, 1),
  },
  {
    id: 'onoffOval',
    level: 1,
    track: 'oval',
    controller: 'onoff',
    ghost: false,
    passed: (run) => run.controller === 'onoff' && laps(run, 3),
  },
  {
    id: 'tightP',
    level: 1,
    track: 'tight',
    controller: 'p',
    ghost: false,
    passed: (run) => run.controller === 'p' && laps(run, 2),
  },
  {
    id: 'cleanS',
    level: 2,
    track: 's',
    controller: 'onoff',
    ghost: false,
    passed: (run) => run.controller !== 'manual' && laps(run, 3) && run.you.lostCount === 0,
  },
  {
    id: 'beatGhost',
    level: 2,
    track: 'circuit',
    controller: 'pid',
    ghost: true,
    passed: (run) => run.controller !== 'manual' && beatsGhost(run),
  },
  {
    id: 'pilot',
    level: 2,
    track: 'oval',
    controller: 'manual',
    ghost: false,
    passed: (run) => run.controller === 'manual' && run.you.laps_s.some((lap) => lap < PILOT_S),
  },
  {
    id: 'ovalSprint',
    level: 3,
    track: 'oval',
    controller: 'pid',
    ghost: false,
    passed: (run) =>
      run.controller !== 'manual' && run.you.laps_s.some((lap) => lap < OVAL_SPRINT_S),
  },
  {
    id: 'cleanCircuit',
    level: 3,
    track: 'circuit',
    controller: 'pid',
    ghost: false,
    passed: (run) =>
      run.controller !== 'manual' &&
      laps(run, 3) &&
      run.you.lostCount === 0 &&
      average(run.you.laps_s) < CLEAN_CIRCUIT_S,
  },
];

export function challengeOf(id: ChallengeId): Challenge {
  const found = CHALLENGES.find((challenge) => challenge.id === id);
  if (found === undefined) throw new Error(`Reto desconocido: ${id}`);
  return found;
}
