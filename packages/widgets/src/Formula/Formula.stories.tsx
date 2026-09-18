import type { JSX } from 'react';

import { Formula } from './Formula';

export default { title: 'Formula' };

const WHEEL_SPEED = 'v = \\omega \\cdot r';
const DIFF_DRIVE = 'v = \\frac{v_R + v_L}{2} \\qquad \\omega = \\frac{v_R - v_L}{L}';

/** The formula inside a line of text. */
export function Inline(): JSX.Element {
  return (
    <p className="max-w-[72ch]">
      <Formula latex={WHEEL_SPEED} />
    </p>
  );
}

/** The formula block of docs/DESIGN.md §5. */
export function Block(): JSX.Element {
  return <Formula latex={DIFF_DRIVE} block />;
}

/** The radius highlighted in the primary color. */
export function Highlighted(): JSX.Element {
  return <Formula latex={WHEEL_SPEED} block highlight="r" />;
}

/** The formula with the values of the reference robot underneath. */
export function Substituted(): JSX.Element {
  return (
    <Formula
      latex={WHEEL_SPEED}
      block
      highlight={'\\omega'}
      substituted={'v = 20{,}9 \\cdot 0{,}033 = 0{,}69'}
    />
  );
}
