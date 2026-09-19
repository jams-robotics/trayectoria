import type { JSX } from 'react';

import { DiffDriveWidget } from '../DiffDriveWidget';
import { MyRobotWidget } from './MyRobotWidget';

// `order` fixes the story sequence rendered by the /dev/widgets playground explicitly,
// independent of module export iteration order (docs/audits F2-01a: hydration mismatch).
export default { title: 'MyRobotWidget', order: ['Form', 'Card', 'Live'] };

/** The editable form, the case captured in `MyRobotWidget-form.png` (#95, decision 8). */
export function Form(): JSX.Element {
  return <MyRobotWidget mode="form" />;
}

/** The read-only summary, the case captured in `MyRobotWidget-card.png` (#95, decision 8). */
export function Card(): JSX.Element {
  return <MyRobotWidget mode="card" />;
}

/**
 * Form and `DiffDriveWidget` side by side on the same store: saving a new wheel radius moves
 * the `v` of the simulator without a reload. This is the story the e2e of #95 drives
 * (decisions 8 and 9).
 */
export function Live(): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <MyRobotWidget mode="form" />
      <DiffDriveWidget
        mode="forward"
        show={['trace']}
        initial={{ omegaL_radps: 10, omegaR_radps: 10 }}
      />
    </div>
  );
}
