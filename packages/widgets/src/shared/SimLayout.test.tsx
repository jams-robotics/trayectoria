import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { ParamGrid, SceneBox, SimLayout } from './SimLayout';

/** The regions of the layout, in DOM order. */
function regionOrder(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[data-sim-region]')).map(
    (node) => node.getAttribute('data-sim-region') ?? '',
  );
}

function regionOf(container: HTMLElement, name: string): HTMLElement {
  return container.querySelector(`[data-sim-region="${name}"]`) as HTMLElement;
}

const STICKY = '[@media(min-height:640px)]:sticky';

describe('SimLayout (docs/DESIGN.md §6)', () => {
  test('keeps the mobile order: viewer, values, then the parameters', () => {
    const { container } = render(
      <SimLayout viewer={<i />} values={<i />} params={<i data-testid="params" />} />,
    );
    expect(regionOrder(container)).toEqual(['viewer', 'values', 'params']);
    expect(regionOf(container, 'values')).toHaveClass('max-lg:order-4');
    expect(regionOf(container, 'params')).toHaveClass('max-lg:order-5');
  });

  test('puts viewer and values in a top row that is sticky from the breakpoint', () => {
    const { container } = render(<SimLayout viewer={<i />} values={<i />} params={<i />} />);
    const top = container.querySelector('[data-sim-row="top"]') as HTMLElement;
    expect(top).toContainElement(regionOf(container, 'viewer'));
    expect(top).toContainElement(regionOf(container, 'values'));
    expect(top).not.toContainElement(regionOf(container, 'params'));
    expect(top).toHaveClass(
      'max-lg:contents',
      'lg:grid',
      `lg:${STICKY}`,
      'lg:[@media(min-height:640px)]:top-0',
      'lg:[@media(min-height:640px)]:bg-bg',
      'lg:[@media(min-height:640px)]:pb-3',
    );
  });

  test('caps the viewer at 50vh · 16/9 wide, centred in its column', () => {
    const { container } = render(<SimLayout viewer={<i />} values={<i />} />);
    expect(regionOf(container, 'viewer')).toHaveClass('lg:mx-auto', 'lg:max-w-[calc(50vh*16/9)]');
  });

  test('lets the values grow the row up to 50vh and scroll only beyond it (#386)', () => {
    const { container } = render(<SimLayout viewer={<i />} values={<i data-testid="v" />} />);
    const values = regionOf(container, 'values');
    expect(values).toHaveClass('lg:w-panel');
    expect(values).not.toHaveClass('lg:relative');
    const box = screen.getByTestId('v').parentElement;
    expect(box).toHaveClass('lg:max-h-[50vh]', 'lg:overflow-y-auto');
    expect(box).not.toHaveClass('lg:absolute', 'lg:inset-0');
  });

  test('applies the same values cap from md when the layout splits at md', () => {
    const { container } = render(
      <SimLayout from="md" viewer={<i />} values={<i data-testid="v" />} />,
    );
    expect(regionOf(container, 'values')).toHaveClass('md:w-panel');
    expect(screen.getByTestId('v').parentElement).toHaveClass(
      'md:max-h-[50vh]',
      'md:overflow-y-auto',
    );
  });

  test('lays the parameters out full width in 2 columns, with a scroll margin', () => {
    const { container } = render(<SimLayout viewer={<i />} values={<i />} params={<i />} />);
    const params = regionOf(container, 'params');
    expect(params.parentElement).toBe(container.firstChild);
    expect(params).toHaveClass(
      'lg:grid',
      'lg:grid-cols-2',
      'lg:[&>[data-param-grid]]:contents',
      'lg:[&>[data-layout=stack]:only-child:has(>div>:nth-child(4))]:col-span-2',
      'lg:[&>:only-child:not([data-param-grid]):has([data-layout=stack]>div>:nth-child(4))]:col-span-2',
      'lg:[&:has(>:only-child:not([data-param-grid]))_[data-layout=stack]>div:has(>:nth-child(4))]:grid-cols-2',
      'lg:[@media(min-height:640px)]:[&_:is(input,select,button)]:scroll-mt-[calc(50vh+64px)]',
    );
  });

  test('without parameters renders only viewer and values', () => {
    const { container } = render(<SimLayout viewer={<i />} values={<i />} />);
    expect(regionOrder(container)).toEqual(['viewer', 'values']);
  });

  test('can switch to two columns from the md breakpoint', () => {
    const { container } = render(
      <SimLayout from="md" viewer={<i />} values={<i />} params={<i />} />,
    );
    expect(regionOf(container, 'values')).toHaveClass('md:w-panel');
    expect(container.querySelector('[data-sim-row="top"]')).toHaveClass(`md:${STICKY}`);
    expect(regionOf(container, 'params')).toHaveClass('md:grid-cols-2');
  });
});

describe('SimLayout with extras (docs/DESIGN.md §6, point 3)', () => {
  const extras = [
    { key: 'chart', node: <i data-testid="chart" />, mobile: 'afterViewer' as const },
    { key: 'panel', node: <i data-testid="panel" />, mobile: 'end' as const },
  ];

  test('renders the extras below the parameters, full width, in their order', () => {
    const { container } = render(
      <SimLayout viewer={<i />} values={<i />} params={<i />} extras={extras} />,
    );
    expect(regionOrder(container)).toEqual(['viewer', 'values', 'params', 'extras']);
    const region = regionOf(container, 'extras');
    expect(region.parentElement).toBe(container.firstChild);
    expect(region).toHaveClass('max-lg:contents');
    expect(screen.getByTestId('chart').parentElement?.nextElementSibling).toContainElement(
      screen.getByTestId('panel'),
    );
  });

  test('on mobile puts each extra at its anchor', () => {
    render(<SimLayout viewer={<i />} values={<i />} params={<i />} extras={extras} />);
    expect(screen.getByTestId('chart').parentElement).toHaveClass('max-lg:order-3', 'max-lg:-mt-1');
    expect(screen.getByTestId('panel').parentElement).toHaveClass('max-lg:order-6');
  });

  test('splits the viewer only for an extra anchored after its first child', () => {
    const first = render(<SimLayout viewer={<i />} values={<i />} extras={extras} />);
    expect(regionOf(first.container, 'viewer')).not.toHaveClass('max-lg:contents');
    const split = render(
      <SimLayout
        viewer={<i />}
        values={<i />}
        extras={[{ key: 'c', node: <i data-testid="c" />, mobile: 'afterViewerFirst' }]}
      />,
    );
    expect(regionOf(split.container, 'viewer')).toHaveClass(
      'max-lg:contents',
      'max-lg:[&>*:not(:first-child)]:order-2',
    );
    expect(screen.getByTestId('c').parentElement).toHaveClass('max-lg:order-1');
  });
});

describe('ParamGrid (docs/DESIGN.md §6, A/B)', () => {
  test('lays the A/B panels side by side when each gets at least 280 px', () => {
    render(
      <ParamGrid>
        <i data-testid="A" />
        <i data-testid="B" />
      </ParamGrid>,
    );
    const grid = screen.getByTestId('A').parentElement;
    expect(grid).toHaveClass('grid', 'grid-cols-[repeat(auto-fit,minmax(280px,1fr))]');
    expect(grid).toHaveAttribute('data-param-grid');
  });
});

describe('SceneBox (docs/DESIGN.md §6, QA #378)', () => {
  test('fixes the height from lg to a 16/9 viewer capped at 50vh, whatever the aspect', () => {
    const { container } = render(
      <SceneBox aspect={1.2}>
        <i data-testid="scene" />
      </SceneBox>,
    );
    expect(container.firstChild).toHaveClass('lg:@container');
    expect(container.querySelector('[data-scene-box]')).toHaveClass(
      'lg:h-[min(calc(100cqw*9/16),50vh)]',
    );
    const fit = screen.getByTestId('scene').parentElement as HTMLElement;
    expect(fit).toHaveClass(
      'lg:mx-auto',
      'lg:w-[min(100%,calc(min(100cqw*9/16,50vh)*var(--scene-aspect)))]',
    );
    expect(fit.style.getPropertyValue('--scene-aspect')).toBe('1.2');
  });
});
