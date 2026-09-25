import { defineExercise } from '@trayectoria/sim-core';
import type { SeededRng } from '@trayectoria/sim-core';

// Verifica of T-4.1 (docs/CURRICULUM.md § T-4.1). Each exercise returns only the key of its
// statement; the text lives in packages/i18n/locales/es/content.json (ARCHITECTURE §3.3).
//
// Values are drawn as integers (rpm and seconds), so the statement shows them exactly.

const TOPIC_ID = 'ruta-1/m04-t01';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;

const SECONDS_PER_MINUTE = 60;
const RPM_TO_RADPS = (2 * Math.PI) / SECONDS_PER_MINUTE;

interface Range {
  readonly min: number;
  readonly max: number;
}

/** Generation ranges of the spec (#301): n for e1–e4, t for e3 and e4. */
export const SPEED_RPM: Range = { min: 30, max: 600 };
export const T_S: Range = { min: 1, max: 60 };

function statementKey(exerciseId: string): string {
  return `content.${TOPIC_ID}.${exerciseId}`;
}

interface Speed {
  readonly speed_rpm: number;
}

interface SpeedDuring {
  readonly speed_rpm: number;
  readonly t_s: number;
}

/** e1: `ω = n · 2π/60`. */
const e1 = defineExercise<Speed>({
  id: 'e1',
  generate: (rng) => {
    const speed_rpm = rng.nextInt(SPEED_RPM.min, SPEED_RPM.max);
    return { values: { speed_rpm }, answer: speed_rpm * RPM_TO_RADPS, unit: 'rad/s' };
  },
  statement: () => statementKey('e1'),
  tolerance: RELATIVE_2_PERCENT,
});

/** e2: one turn takes `T = 60/n` s. */
const e2 = defineExercise<Speed>({
  id: 'e2',
  generate: (rng) => {
    const speed_rpm = rng.nextInt(SPEED_RPM.min, SPEED_RPM.max);
    return { values: { speed_rpm }, answer: SECONDS_PER_MINUTE / speed_rpm, unit: 's' };
  },
  statement: () => statementKey('e2'),
  tolerance: RELATIVE_2_PERCENT,
});

function drawSpeedDuring(rng: SeededRng): SpeedDuring {
  const speed_rpm = rng.nextInt(SPEED_RPM.min, SPEED_RPM.max);
  const t_s = rng.nextInt(T_S.min, T_S.max);
  return { speed_rpm, t_s };
}

/** e3: turns in t, `n · t/60`; a count, so no unit. */
const e3 = defineExercise<SpeedDuring>({
  id: 'e3',
  generate: (rng) => {
    const values = drawSpeedDuring(rng);
    return { values, answer: (values.speed_rpm * values.t_s) / SECONDS_PER_MINUTE, unit: '' };
  },
  statement: () => statementKey('e3'),
  tolerance: RELATIVE_2_PERCENT,
});

/** e4 (optional): angle turned from θ₀ = 0, `θ = ω · t`. */
const e4 = defineExercise<SpeedDuring>({
  id: 'e4',
  generate: (rng) => {
    const values = drawSpeedDuring(rng);
    return { values, answer: values.speed_rpm * RPM_TO_RADPS * values.t_s, unit: 'rad' };
  },
  statement: () => statementKey('e4'),
  tolerance: RELATIVE_2_PERCENT,
});

/** The exercises of T-4.1, in the order of Verifica; e1–e3 are required. */
export const exercises = [e1, e2, e3, e4] as const;
