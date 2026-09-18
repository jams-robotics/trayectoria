import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { Formula, HIGHLIGHT_CLASS } from './Formula';

// F2-01a: the only wrapper around katex (docs/ARCHITECTURE.md §3.4).
const V = 'v = \\omega \\cdot r';

describe('F2-01a Formula', () => {
  test('renders the latex with KaTeX', () => {
    const { container } = render(<Formula latex={V} />);
    expect(container.querySelector('.katex')).not.toBeNull();
    expect(container.textContent).toContain('ω');
  });

  test('is inline by default and a block when asked', () => {
    const { container } = render(<Formula latex={V} />);
    expect(container.querySelector('[data-block="false"]')).not.toBeNull();
    const block = render(<Formula latex={V} block />);
    expect(block.container.querySelector('[data-block="true"]')).not.toBeNull();
  });

  test('labels the rendered formula for assistive technology', () => {
    render(<Formula latex={V} />);
    expect(screen.getByRole('math', { name: 'Fórmula' })).toBeInTheDocument();
  });

  test('highlight marks only the requested variable', () => {
    const { container } = render(<Formula latex={V} highlight="r" />);
    const marked = container.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
    expect(marked).toHaveLength(1);
    expect(marked[0]?.textContent).toBe('r');
  });

  test('highlight of a greek variable marks its symbol', () => {
    const { container } = render(<Formula latex={V} highlight={'\\omega'} />);
    const marked = container.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
    expect(marked).toHaveLength(1);
    expect(marked[0]?.textContent).toBe('ω');
  });

  test('a variable that is absent from the latex highlights nothing', () => {
    const { container } = render(<Formula latex={V} highlight="a" />);
    expect(container.querySelectorAll(`.${HIGHLIGHT_CLASS}`)).toHaveLength(0);
  });

  test('without highlight nothing is marked', () => {
    const { container } = render(<Formula latex={V} />);
    expect(container.querySelectorAll(`.${HIGHLIGHT_CLASS}`)).toHaveLength(0);
  });

  test('substituted renders a second formula under the first', () => {
    const { container } = render(<Formula latex={V} block substituted="v = 20.9 \\cdot 0.033" />);
    expect(container.querySelectorAll('.katex').length).toBe(2);
    expect(screen.getByText('Con tus valores')).toBeInTheDocument();
  });

  test('without substituted there is only one formula', () => {
    const { container } = render(<Formula latex={V} />);
    expect(container.querySelectorAll('.katex')).toHaveLength(1);
  });

  test('invalid latex renders the error instead of throwing (throwOnError: false)', () => {
    const { container } = render(<Formula latex={'\\frac{1}'} />);
    expect(container.querySelector('.katex-error')).not.toBeNull();
  });
});
