import { renderToStaticMarkup } from 'react-dom/server';
import type { JSX } from 'react';
import { describe, expect, test, vi } from 'vitest';

import { useApiStore } from './apiStore';
import { useEditorPanelStore } from './editorPanelStore';
import { ViewerBox } from './ViewerBox';
import type { usePageState } from './useMobileSimState';

// #528: the left column (viewer and «Gráficas») used to be sticky with a screen-capped height and
// its own scroll (`max-h-screen` + `overflow-y-auto` from `lg`), which clipped «Gráficas» to its
// title with no visible sign that it continued. This guards that the column no longer caps its
// height or scrolls on its own, so the page can grow and show the four plots in full.
//
// `apps/web` has no component-rendering test library among its dependencies (`@testing-library/*`
// is only wired for `packages/widgets` and `packages/sims`, and a ticket cannot add one,
// docs/STANDARDS.md §8/§10); `react-dom/server` is already a direct dependency, so the column's
// classes are checked on its static markup instead.

/** A minimal `usePageState` result: only what `ViewerBox` reads. */
function createPage(): ReturnType<typeof usePageState> {
  return {
    view: 'sim',
    closeEditor: vi.fn(),
    editorTrack: null,
    onTrack: vi.fn(),
  } as unknown as ReturnType<typeof usePageState>;
}

/** Renders `ViewerBox` with the real store hooks and the rest of its props stubbed. */
function Harness(): JSX.Element {
  const store = useApiStore();
  const panels = useEditorPanelStore();
  return (
    <ViewerBox
      viewer={<div data-testid="viewer">viewer</div>}
      page={createPage()}
      store={store}
      panels={panels}
      onEmptyTrack={vi.fn()}
      onSaveTrack={vi.fn()}
    />
  );
}

/** The `class` attribute of the element with `data-testid="sim-left-column"` in `html`. */
function leftColumnClass(html: string): string {
  const match = /data-testid="sim-left-column"[^>]*class="([^"]*)"/.exec(html);
  if (match?.[1] !== undefined) return match[1];
  // The attribute order react-dom emits is not guaranteed; try `class` before `data-testid` too.
  const reversed = /class="([^"]*)"[^>]*data-testid="sim-left-column"/.exec(html);
  if (reversed?.[1] === undefined) throw new Error('sim-left-column not found in markup');
  return reversed[1];
}

describe('ViewerBox (#528)', () => {
  test('the left column has no capped height and no scroll of its own', () => {
    const html = renderToStaticMarkup(<Harness />);
    const columnClass = leftColumnClass(html);

    expect(columnClass).not.toMatch(/max-h-screen/);
    expect(columnClass).not.toMatch(/overflow-y-auto/);
  });

  test('the column is not sticky and keeps its layout classes', () => {
    const html = renderToStaticMarkup(<Harness />);
    const columnClass = leftColumnClass(html);

    expect(columnClass).not.toMatch(/\bsticky\b/);
    expect(columnClass).toContain('flex');
    expect(columnClass).toContain('flex-col');
  });
});
