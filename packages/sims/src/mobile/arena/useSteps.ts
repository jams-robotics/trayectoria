import { useCallback, useMemo, useState } from 'react';
import type { MobileSpec } from '@trayectoria/robot-spec';

import type { FreeDriver } from './freeRace';
import { stepsLayout } from './stepGoals';
import type { StepGoal } from './stepGoals';
import { createStepRunner } from './stepRunner';
import type { RunStatus, StepRunner } from './stepRunner';
import { MIN_REPEAT, addStep, expand, moveStep, removeAt, removeLast } from './steps';
import type { Program, Step } from './steps';

export interface StepsApi {
  readonly program: Program;
  /** The `n` of the next «Repetir ×n». */
  readonly repeatN: number;
  readonly setRepeatN: (n: number) => void;
  readonly add: (step: Step) => void;
  readonly undo: () => void;
  /** Takes out the button at `index` (a «Repetir» or «Fin» with its partner). */
  readonly remove: (index: number) => void;
  /** Moves the button at `index` one place up (−1) or down (+1) when the program stays valid. */
  readonly move: (index: number, by: -1 | 1) => void;
  readonly clear: () => void;
  /** Builds the runner of the program for a robot at the start; the caller restarts the race. */
  readonly run: () => void;
  /** Forgets the run: the robot stops being driven. */
  readonly stop: () => void;
  /** Number of the current run, to tell one celebration from the next. */
  readonly runId: number;
  /** The wheel driver of the current run, for the free race. */
  readonly driver: FreeDriver | null;
  /** Where the run is, or `null` before the first one. */
  readonly status: RunStatus | null;
}

/** The program of the «Pasos» mode and the runner that executes it on the robot. */
export function useSteps(spec: MobileSpec, goal: StepGoal | null): StepsApi {
  const [program, setProgram] = useState<Program>([]);
  const [repeatN, setRepeatN] = useState(MIN_REPEAT + 2);
  const [run, setRun] = useState<{ id: number; runner: StepRunner } | null>(null);
  const [lastId, setLastId] = useState(0);
  const stop = useCallback(() => setRun(null), []);
  // Editing the program ends the run: the highlighted step would no longer be the one in the list.
  const edit = useCallback((change: (current: Program) => Program) => {
    setProgram(change);
    setRun(null);
  }, []);
  const driver = useMemo<FreeDriver | null>(
    () => (run === null ? null : (pose, bumped) => run.runner.drive(pose, bumped)),
    [run],
  );
  return {
    program,
    repeatN,
    setRepeatN,
    add: (step) => edit((current) => addStep(current, step)),
    undo: () => edit(removeLast),
    remove: (index) => edit((current) => removeAt(current, index)),
    move: (index, by) => edit((current) => moveStep(current, index, by)),
    clear: () => edit(() => []),
    run() {
      setLastId(lastId + 1);
      const runner = createStepRunner(spec, stepsLayout(goal).start, expand(program));
      setRun({ id: lastId + 1, runner });
    },
    stop,
    runId: run?.id ?? 0,
    driver,
    status: run?.runner.status() ?? null,
  };
}
