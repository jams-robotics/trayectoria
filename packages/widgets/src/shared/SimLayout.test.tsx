import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { ParamGrid, SimLayout } from './SimLayout';

/** The three regions of the layout, in DOM order, as their test ids. */
function regionOrder(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[data-sim-region]')).map(
    (node) => node.getAttribute('data-sim-region') ?? '',
  );
}

describe('SimLayout (docs/DESIGN.md §6)', () => {
  test('keeps the mobile order: viewer, values, then the parameters', () => {
    const { container } = render(
      <SimLayout
        viewer={<i data-testid="viewer" />}
        values={<i data-testid="values" />}
        params={<i data-testid="params" />}
      />,
    );
    expect(regionOrder(container)).toEqual(['viewer', 'values', 'params']);
  });

  test('on desktop puts viewer and parameters in the left column, values on the right', () => {
    const { container } = render(
      <SimLayout
        viewer={<i data-testid="viewer" />}
        values={<i data-testid="values" />}
        params={<i data-testid="params" />}
      />,
    );
    const region = (name: string): HTMLElement =>
      container.querySelector(`[data-sim-region="${name}"]`) as HTMLElement;
    expect(region('viewer')).toHaveClass('lg:col-start-1', 'lg:row-start-1');
    expect(region('params')).toHaveClass('lg:col-start-1', 'lg:row-start-2');
    expect(region('values')).toHaveClass('lg:col-start-2', 'lg:row-span-2', 'lg:w-panel');
  });

  test('without parameters renders only viewer and values', () => {
    const { container } = render(
      <SimLayout viewer={<i data-testid="viewer" />} values={<i data-testid="values" />} />,
    );
    expect(regionOrder(container)).toEqual(['viewer', 'values']);
    expect(screen.queryByTestId('params')).toBeNull();
  });

  test('can switch to two columns from the md breakpoint', () => {
    const { container } = render(
      <SimLayout
        from="md"
        viewer={<i data-testid="viewer" />}
        values={<i data-testid="values" />}
        params={<i data-testid="p" />}
      />,
    );
    const values = container.querySelector('[data-sim-region="values"]');
    expect(values).toHaveClass('md:col-start-2', 'md:w-panel');
  });
});

describe('SimLayout with content after the parameters (QA #365)', () => {
  test('on desktop orders the left column viewer, parameters, then the extra content', () => {
    const { container } = render(
      <SimLayout
        viewer={<i data-testid="viewer" />}
        values={<i data-testid="values" />}
        params={<i data-testid="params" />}
        after={<i data-testid="after" />}
      />,
    );
    const region = (name: string): HTMLElement =>
      container.querySelector(`[data-sim-region="${name}"]`) as HTMLElement;
    expect(regionOrder(container)).toEqual(['viewer', 'values', 'params', 'after']);
    expect(region('params')).toHaveClass('lg:row-start-2');
    expect(region('after')).toHaveClass('lg:col-start-1', 'lg:row-start-3');
    expect(region('values')).toHaveClass('lg:row-span-3');
  });

  test('on mobile keeps the extra content right after the first child of the viewer', () => {
    const { container } = render(
      <SimLayout
        viewer={<i data-testid="viewer" />}
        values={<i data-testid="values" />}
        params={<i data-testid="params" />}
        after={<i data-testid="after" />}
      />,
    );
    const region = (name: string): HTMLElement =>
      container.querySelector(`[data-sim-region="${name}"]`) as HTMLElement;
    expect(region('viewer')).toHaveClass('max-lg:contents');
    expect(region('after')).toHaveClass('max-lg:order-1');
    expect(region('values')).toHaveClass('max-lg:order-3');
    expect(region('params')).toHaveClass('max-lg:order-3');
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
  });
});
