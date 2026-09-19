import { defineExercise } from '@trayectoria/sim-core';
import type { Exercise } from '@trayectoria/sim-core';

/**
 * The two exercises the `/dev/widgets` stories show (#94, decision 6). They live here, not in a
 * topic, because `packages/widgets` has no content: they are the demo instances of the widget.
 */

/** Values of the scalar demo: a track of `D` m travelled at `v` m/s. */
export interface TrackTime {
  readonly distance_m: number;
  readonly speed_mps: number;
}

/** Values of the vector demo: a speed `v` at an angle `θ`. */
export interface SpeedComponents {
  readonly speed_mps: number;
  readonly angle_deg: number;
}

const DEG_TO_RAD = Math.PI / 180;

/** T-1.1 e1 of docs/CURRICULUM.md: «pista de D m a v m/s: tiempo», D ∈ [1, 10], v ∈ [0.1, 1]. */
export const trackTimeExercise: Exercise<TrackTime> = defineExercise<TrackTime>({
  id: 'e1',
  generate: (rng) => {
    const distance_m = 1 + rng.next() * 9;
    const speed_mps = 0.1 + rng.next() * 0.9;
    return {
      values: { distance_m, speed_mps },
      answer: distance_m / speed_mps,
      unit: 's',
    };
  },
  statement: () => 'widgets.ExerciseWidget.demo.trackTime',
  tolerance: { type: 'relative', value: 0.02 },
});

/** T-0.2 e1 of docs/CURRICULUM.md: «v = v m/s a θ°: componentes», v ∈ [0.1, 1.5], θ ∈ [0°, 90°]. */
export const componentsExercise: Exercise<SpeedComponents> = defineExercise<SpeedComponents>({
  id: 'e1',
  generate: (rng) => {
    const speed_mps = 0.1 + rng.next() * 1.4;
    const angle_deg = rng.next() * 90;
    const angle_rad = angle_deg * DEG_TO_RAD;
    return {
      values: { speed_mps, angle_deg },
      answer: [speed_mps * Math.cos(angle_rad), speed_mps * Math.sin(angle_rad)],
      unit: 'm/s',
    };
  },
  statement: () => 'widgets.ExerciseWidget.demo.components',
  tolerance: { type: 'relative', value: 0.02 },
});
