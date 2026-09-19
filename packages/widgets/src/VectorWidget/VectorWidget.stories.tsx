import type { JSX } from 'react';

import { VectorWidget } from './VectorWidget';

// `order` fixes the story sequence rendered by the /dev/widgets playground explicitly,
// independent of module export iteration order (docs/audits F2-01a: hydration mismatch).
export default { title: 'VectorWidget', order: ['Curriculum'] };

/**
 * The exact props of the «Explora» of T-0.2 (docs/CURRICULUM.md). This is the case captured in
 * `VectorWidget.png` (#86, decision 7).
 */
export function Curriculum(): JSX.Element {
  return (
    <VectorWidget
      initialA={[0.433, 0.25]}
      initialB={[0.2, -0.1]}
      show={['components', 'sum', 'angle', 'dot']}
      unit="m/s"
    />
  );
}
