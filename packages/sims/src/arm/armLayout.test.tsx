import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { ArmColumns } from './armLayout';
import type { ArmViewerPanel } from './armPanels';

/** A stub panel whose content is a marker with the panel id. */
function panel(id: ArmViewerPanel['id']): ArmViewerPanel {
  return { id, title: id, summary: id, content: <div data-testid={`stub-${id}`} /> };
}

const ALL: readonly ArmViewerPanel[] = [
  panel('joints'),
  panel('effector'),
  panel('matrices'),
  panel('workspace'),
];

/** Ids of the stub panels inside an element, in DOM order. */
function idsIn(element: HTMLElement): string[] {
  return [...element.querySelectorAll('[data-testid^="stub-"]')].map((node) =>
    (node.getAttribute('data-testid') ?? '').replace('stub-', ''),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ArmColumns (#375)', () => {
  test('in one column the matrices panel keeps its place after the effector', () => {
    render(
      <ArmColumns scene={<div data-testid="stub-scene" />} panels={ALL} renderPanel={undefined} />,
    );
    expect(screen.getByTestId('arm-viewer')).toHaveAttribute('data-split', 'false');
    expect(idsIn(screen.getByTestId('arm-viewer-left'))).toEqual(['scene']);
    expect(idsIn(screen.getByTestId('arm-viewer'))).toEqual([
      'scene',
      'joints',
      'effector',
      'matrices',
      'workspace',
    ]);
  });

  test('split in two, the matrices panel goes under the scene in the sticky left column', () => {
    // The `md` sentinel is displayed: jsdom has no CSS, so its client rects are stubbed.
    vi.spyOn(HTMLSpanElement.prototype, 'getClientRects').mockReturnValue([
      new DOMRect(0, 0, 1, 1),
    ] as unknown as DOMRectList);
    render(
      <ArmColumns scene={<div data-testid="stub-scene" />} panels={ALL} renderPanel={undefined} />,
    );
    const left = screen.getByTestId('arm-viewer-left');
    expect(screen.getByTestId('arm-viewer')).toHaveAttribute('data-split', 'true');
    expect(idsIn(left)).toEqual(['scene', 'matrices']);
    expect(left.className).toContain('[@media(min-width:768px)_and_(min-height:640px)]:sticky');
    expect(left.className).toContain(
      '[@media(min-width:768px)_and_(min-height:640px)]:max-h-screen',
    );
    expect(left.className).toContain(
      '[@media(min-width:768px)_and_(min-height:640px)]:overflow-y-auto',
    );
  });

  test('renderPanel is still called once per panel, in order', () => {
    const seen: string[] = [];
    render(
      <ArmColumns
        scene={<div />}
        panels={ALL}
        renderPanel={(p) => {
          seen.push(p.id);
          return p.content;
        }}
      />,
    );
    expect(seen.slice(0, ALL.length)).toEqual(['joints', 'effector', 'matrices', 'workspace']);
    expect(screen.getByTestId('arm-viewer')).toHaveAttribute('data-compact', 'false');
  });
});
