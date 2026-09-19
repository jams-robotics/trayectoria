import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';

import { tokenColor } from '../shared/theme';
import { Frame } from './Frame';
import { Scene3D } from './Scene3D';

// `order` fixes the story sequence rendered by the /dev/widgets playground explicitly,
// independent of module export iteration order (docs/audits F2-01a: hydration mismatch).
export default { title: 'Scene3D', order: ['Basic', 'YUp'] };

/** Side of the demo box, in metres. */
const BOX_SIDE_M = 0.25;
/** Arm length of the triad of the stories, in metres. */
const FRAME_LENGTH_M = 0.35;

/** Colour token of the demo box: `--sim-robot`, the `physical` accent of docs/DESIGN.md §6. */
const BOX_TOKEN = 'sim-robot';

/** The box colour resolved from the tokens; three.js parses a colour value, never a `var()`. */
function boxColor(): string {
  return tokenColor(typeof document === 'undefined' ? null : document.documentElement, BOX_TOKEN);
}

/**
 * The approved case of F2-12 (#96, decision 7): grid, the triad of the origin with its label and
 * a box, with the default `up: 'z'`. This is the case captured in `Scene3D.png`.
 */
export function Basic(): JSX.Element {
  const t = useT();
  return (
    <Scene3D description={t('widgets.Scene3D.basic')}>
      <Frame length_m={FRAME_LENGTH_M} label={t('widgets.Scene3D.originLabel')} />
      <mesh position={[0.45, 0.35, BOX_SIDE_M / 2]}>
        <boxGeometry args={[BOX_SIDE_M, BOX_SIDE_M, BOX_SIDE_M]} />
        <meshStandardMaterial color={boxColor()} />
      </mesh>
    </Scene3D>
  );
}

/** The same scene with `up: 'y'` and no grid, the other configuration of the props. */
export function YUp(): JSX.Element {
  const t = useT();
  return (
    <Scene3D up="y" showGrid={false} description={t('widgets.Scene3D.yUp')}>
      <Frame length_m={FRAME_LENGTH_M} label={t('widgets.Scene3D.originLabel')} />
    </Scene3D>
  );
}
