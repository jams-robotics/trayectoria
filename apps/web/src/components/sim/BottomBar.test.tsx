import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';

import { BOTTOM_BAR_HEIGHT_PX, BottomBar } from './BottomBar';
import type { SimulationDriver } from '@trayectoria/widgets';

// #531: the bar was `position: fixed`, so its 56 px had to be reserved as padding elsewhere; the
// layout's own footer never received it and ended up hidden behind the bar. This guards that the
// bar now sits in the normal flow (no `fixed`) and only pins its bottom edge with
// `position: sticky`, with the safe-area inset added as bottom padding so a device notch does not
// crowd the buttons. It also guards that «Paso» is back (#128, decision 4 dropped it on mobile;
// superseded here) and that «Reproducir» no longer forces the bar to spread with `flex-1`, which
// is what made room for the fourth button.
//
// `apps/web` has no component-rendering test library among its dependencies (`@testing-library/*`
// is only wired for `packages/widgets` and `packages/sims`, and a ticket cannot add one,
// docs/STANDARDS.md §8/§10); `react-dom/server` is already a direct dependency, so the bar's
// classes and buttons are checked on its static markup instead.

/** A driver whose actions are spies, so the test sees exactly which one a button fires. */
function createDriver(
  overrides: Partial<SimulationDriver<unknown>> = {},
): SimulationDriver<unknown> {
  return {
    state: null,
    t_s: 0,
    running: false,
    play: vi.fn(),
    pause: vi.fn(),
    step: vi.fn(),
    reset: vi.fn(),
    speed: 1,
    setSpeed: vi.fn(),
    ...overrides,
  };
}

/** The `class` attribute of the element with `data-testid="sim-bottom-bar"` in `html`. */
function barClass(html: string): string {
  const match = /data-testid="sim-bottom-bar"[^>]*class="([^"]*)"/.exec(html);
  if (match?.[1] !== undefined) return match[1];
  const reversed = /class="([^"]*)"[^>]*data-testid="sim-bottom-bar"/.exec(html);
  if (reversed?.[1] === undefined) throw new Error('sim-bottom-bar not found in markup');
  return reversed[1];
}

describe('BottomBar (#531)', () => {
  test('sits in the flow, sticky to the bottom edge, not fixed', () => {
    const html = renderToStaticMarkup(<BottomBar driver={createDriver()} />);
    const barClasses = barClass(html);

    expect(barClasses).not.toMatch(/\bfixed\b/);
    expect(barClasses).toMatch(/\bsticky\b/);
    expect(barClasses).toMatch(/\bbottom-0\b/);
  });

  test('reserves the safe-area inset as bottom padding', () => {
    const html = renderToStaticMarkup(<BottomBar driver={createDriver()} />);
    expect(html).toContain('padding-bottom:env(safe-area-inset-bottom)');
  });

  test('shows the four buttons in order, including «Paso», and the speed select', () => {
    const html = renderToStaticMarkup(<BottomBar driver={createDriver()} />);
    const labels = [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);

    expect(labels).toEqual(['Reproducir', 'Pausa', 'Paso', 'Reiniciar']);
    expect(html).toContain('<select');
  });

  test('«Reproducir» is no longer flex-1', () => {
    const html = renderToStaticMarkup(<BottomBar driver={createDriver()} />);
    const match = /<button[^>]*class="([^"]*)"[^>]*>Reproducir<\/button>/.exec(html);
    expect(match?.[1]).not.toMatch(/\bflex-1\b/);
  });

  test('each button height stays 44 px and the bar is 56 px tall', () => {
    const html = renderToStaticMarkup(<BottomBar driver={createDriver()} />);
    // #531 (correction round): `h-11` is 80 px in this repo's remapped spacing scale
    // (tokens.css `--space-11`), not 44 px; the true 44 px minimum touch target is `h-[44px]`.
    expect(html).toMatch(/class="[^"]*h-\[44px\][^"]*"[^>]*>Reproducir/);
    expect(BOTTOM_BAR_HEIGHT_PX).toBe(56);
  });

  test('breaks out of the page’s padded column with a viewport-relative margin (#531)', () => {
    // The bar sits inside `movil.astro`'s padded `<section>`; a plain in-flow width matches that
    // column, not the viewport, and the correction round found it ~36 px short on each side at
    // 390 px. `calc((100% - 100vw) / 2)` is the padding's width whatever it is, so a negative
    // margin of that size pushes the bar out to the viewport edges regardless of the column.
    const html = renderToStaticMarkup(<BottomBar driver={createDriver()} />);
    expect(html).toContain('margin-left:calc((100% - 100vw) / 2)');
    expect(html).toContain('margin-right:calc((100% - 100vw) / 2)');
  });

  test('every control keeps a 44 px minimum width for touch, not only height', () => {
    const html = renderToStaticMarkup(<BottomBar driver={createDriver()} />);
    const controlClasses = [
      ...[...html.matchAll(/<button[^>]*class="([^"]*)"/g)].map((m) => m[1]),
      /<select[^>]*class="([^"]*)"/.exec(html)?.[1],
    ];
    for (const classes of controlClasses) {
      expect(classes).toMatch(/min-w-\[44px\]/);
    }
  });
});
