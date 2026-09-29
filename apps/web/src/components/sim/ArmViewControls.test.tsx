import { renderToStaticMarkup } from 'react-dom/server';
import { t } from '@trayectoria/i18n';
import { describe, expect, test, vi } from 'vitest';

import { ViewControls, viewSummary } from './ArmViewControls';
import type { ViewLayers } from './ArmViewControls';

// #537 and #542: the three view toggles are one segmented group, with the same active style,
// and on mobile the accordion header shows the state instead of repeating its title. Static
// markup, as in `BottomBar.test.tsx`: `apps/web` has no component-rendering test library.

const GROUP = { openId: 'view' as const, setOpenId: vi.fn() };
const ONLY_FRAMES: ViewLayers = { workspace: false, matrices: false, frames: true };

/** The static markup of the controls. */
function markup(mobile: boolean, layers: ViewLayers = ONLY_FRAMES): string {
  return renderToStaticMarkup(
    <ViewControls mobile={mobile} group={GROUP} layers={layers} onLayer={vi.fn()} />,
  );
}

/** The opening tag of the button with `testId`. */
function buttonTag(html: string, testId: string): string {
  return html.match(new RegExp(`<button[^>]*data-testid="${testId}"[^>]*>`))?.[0] ?? '';
}

describe('viewSummary (#542)', () => {
  test('lists the layers that are on, in the order of the group', () => {
    expect(viewSummary(ONLY_FRAMES, t)).toBe('Marcos');
    expect(viewSummary({ workspace: true, matrices: true, frames: true }, t)).toBe(
      'Espacio de trabajo · Matrices · Marcos',
    );
  });

  test('says that no layer is on, and never repeats the title', () => {
    const none = viewSummary({ workspace: false, matrices: false, frames: false }, t);
    expect(none).toBe(t('sims.armPage.viewNone'));
    expect(none).not.toBe(t('sims.armPage.view'));
  });
});

describe('ViewControls (#537)', () => {
  test('the three toggles, «Marcos» included, are one group in one row', () => {
    const html = markup(false);
    expect(html.match(/role="group"/g)).toHaveLength(1);
    const order = [...html.matchAll(/data-testid="([a-z]+-toggle)"/g)].map((match) => match[1]);
    expect(order).toEqual(['workspace-toggle', 'matrices-toggle', 'frames-toggle']);
    const group = html.match(/<div[^>]*role="group"[^>]*>/)?.[0] ?? '';
    expect(group).toContain('divide-x');
    expect(group).not.toContain('flex-wrap');
  });

  test('an active toggle is filled with `primary`, whichever it is', () => {
    const html = markup(false, { workspace: true, matrices: false, frames: true });
    for (const testId of ['workspace-toggle', 'frames-toggle']) {
      expect(buttonTag(html, testId)).toContain('aria-pressed="true"');
      expect(buttonTag(html, testId)).toContain('bg-primary');
    }
    expect(buttonTag(html, 'matrices-toggle')).toContain('aria-pressed="false"');
    expect(buttonTag(html, 'matrices-toggle')).not.toContain('bg-primary');
  });

  test('on mobile «Marcos» is inside the accordion, whose header shows the state (#542)', () => {
    const html = markup(true);
    expect(html).toContain('data-testid="sim-accordion"');
    const header = html.match(/<button[^>]*aria-expanded[^>]*>(.*?)<\/button>/)?.[1] ?? '';
    // The title appears once in the header, followed by the state.
    expect(header.split(t('sims.armPage.view'))).toHaveLength(2);
    expect(header).toContain('Marcos');
    // «Marcos» renders after the header, inside the accordion panel.
    expect(html.indexOf('data-testid="frames-toggle"')).toBeGreaterThan(html.indexOf(header));
    // 44 px touch targets on mobile (docs/DESIGN.md §9.3).
    expect(buttonTag(html, 'frames-toggle')).toContain('h-11');
  });
});
