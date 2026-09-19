import type { JSX } from 'react';

import { ExerciseWidget } from './ExerciseWidget';
import { componentsExercise, trackTimeExercise } from './demo';

// `order` fixes the story sequence rendered by the /dev/widgets playground explicitly,
// independent of module export iteration order (docs/audits F2-01a: hydration mismatch).
export default { title: 'ExerciseWidget', order: ['Scalar', 'Vector', 'Anonymous'] };

// Fixed seeds so the stories, the visual snapshots and the e2e always show the same numbers.
// They are not exported: a stories module may only export stories (`StoriesModule` of
// dev/StoryGallery.tsx), and the e2e reads the values from the rendered statement.
const SCALAR_SEED = 2;
const VECTOR_SEED = 5;

/**
 * T-1.1 e1 with a fixed seed: a track of 7.608 m at 0.3925 m/s, expected answer **19.38 s**
 * (#94, decision 7; the value for QA to type).
 */
export function Scalar(): JSX.Element {
  return (
    <ExerciseWidget
      exercise={trackTimeExercise}
      topicId="ruta-1/m01-t01"
      index={1}
      required
      seed={SCALAR_SEED}
    />
  );
}

/**
 * T-0.2 e1 with a fixed seed: 1.066 m/s at 69.55°, two fields. Expected answer **0.3724 m/s**
 * and **0.9985 m/s** (#94, decision 7; the values for QA to type).
 */
export function Vector(): JSX.Element {
  return (
    <ExerciseWidget
      exercise={componentsExercise}
      topicId="ruta-1/m00-t02"
      index={2}
      seed={VECTOR_SEED}
    />
  );
}

/** No session and no fixed seed: the instance is drawn at random per mount (#94, decision 2). */
export function Anonymous(): JSX.Element {
  return <ExerciseWidget exercise={trackTimeExercise} topicId="ruta-1/m01-t01" />;
}
