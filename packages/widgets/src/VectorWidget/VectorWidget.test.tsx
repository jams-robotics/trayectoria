import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { createTransform, worldToPx } from '../Scene2D/transform';
import { VIEW_ASPECT, VIEW_CENTER, viewWidth } from './compute';
import { VectorWidget } from './VectorWidget';

/** Props of the «Explora» of T-0.2 (docs/CURRICULUM.md), the case the story captures. */
function renderCurriculum(): void {
  render(
    <VectorWidget
      initialA={[0.433, 0.25]}
      initialB={[0.2, -0.1]}
      show={['components', 'sum', 'angle', 'dot']}
      unit="m/s"
    />,
  );
}

/** The value of one row of the values panel, by the text of its term. */
function valueOf(term: string): string {
  const panel = screen.getByTestId('readout-panel');
  const dt = within(panel).getByText(term);
  return dt.nextElementSibling?.textContent ?? '';
}

describe('VectorWidget (F2-03)', () => {
  test('shows the components, magnitude and angle of T-0.2 for the initial vectors', () => {
    renderCurriculum();

    expect(valueOf('Componentes de a')).toBe('(0.433 m/s, 0.250 m/s)');
    expect(valueOf('Magnitud de a')).toBe('0.500 m/s');
    expect(valueOf('Ángulo de a')).toBe('30.00°');
  });

  test('shows the sum, the dot product and the angle between the two vectors', () => {
    renderCurriculum();

    expect(valueOf('Componentes de a + b')).toBe('(0.633 m/s, 0.150 m/s)');
    expect(valueOf('Magnitud de a + b')).toBe('0.651 m/s');
    expect(valueOf('Producto escalar a · b')).toBe('0.0616 (m/s)²');
    expect(valueOf('Ángulo entre a y b')).toBe('56.57°');
  });

  test('a keyboard arrow moves a tip by 0.1 and updates magnitude and angle', async () => {
    const user = userEvent.setup();
    render(<VectorWidget initialA={[0.3, 0.4]} show={['components', 'angle']} unit="m" />);

    expect(valueOf('Magnitud de a')).toBe('0.500 m');
    expect(valueOf('Ángulo de a')).toBe('53.13°');

    await user.tab();
    expect(screen.getByRole('button', { name: 'Punta del vector a' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');

    expect(valueOf('Componentes de a')).toBe('(0.400 m, 0.400 m)');
    expect(valueOf('Magnitud de a')).toBe('0.566 m');
    expect(valueOf('Ángulo de a')).toBe('45.00°');
  });

  test('Shift and an arrow move a tip by 1.0 instead of 0.1', async () => {
    const user = userEvent.setup();
    render(<VectorWidget initialA={[0.3, 0.4]} show={['components']} unit="m" />);

    screen.getByRole('button', { name: 'Punta del vector a' }).focus();
    await user.keyboard('{Shift>}{ArrowUp}{/Shift}');

    expect(valueOf('Componentes de a')).toBe('(0.300 m, 1.40 m)');
  });

  test('the four arrows move the tip in the four directions of the world', async () => {
    const user = userEvent.setup();
    render(<VectorWidget initialA={[0.5, 0.5]} show={['components']} unit="m" />);

    const tip = screen.getByRole('button', { name: 'Punta del vector a' });
    tip.focus();
    await user.keyboard('{ArrowLeft}{ArrowDown}');

    expect(valueOf('Componentes de a')).toBe('(0.400 m, 0.400 m)');
  });

  test('both tips are focusable controls with a translated name', () => {
    renderCurriculum();

    const handles = screen.getAllByRole('button');
    expect(handles.map((handle) => handle.getAttribute('aria-label'))).toEqual([
      'Punta del vector a',
      'Punta del vector b',
    ]);
  });

  test('`show` selects what the panel lists: without `dot` and `angle` neither appears', () => {
    render(<VectorWidget initialA={[0.3, 0.4]} show={['components']} unit="m" />);

    expect(screen.queryByText('Producto escalar a · b')).not.toBeInTheDocument();
    expect(screen.queryByText('Ángulo entre a y b')).not.toBeInTheDocument();
    expect(screen.queryByText('Magnitud de a + b')).not.toBeInTheDocument();
    expect(screen.getByText('Magnitud de a')).toBeInTheDocument();
  });

  test('describes its state in an `aria-live` region and names the scene', () => {
    renderCurriculum();

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Dos vectores arrastrables desde el origen, con su suma',
    );
  });

  test('b defaults to the zero vector when the topic gives only a', () => {
    render(<VectorWidget initialA={[0.3, 0.4]} show={['sum', 'angle']} unit="m" />);

    expect(valueOf('Magnitud de b')).toBe('0.00 m');
    expect(valueOf('Magnitud de a + b')).toBe('0.500 m');
    // The zero vector has no direction, so the angle against it is reported as zero, not NaN.
    expect(valueOf('Ángulo entre a y b')).toBe('0.00°');
  });
});

/** Width the fake `ResizeObserver` reports, so the scene has a real mapping in jsdom. */
const WIDTH_PX = 400;
/** Height of the scene of the widget, in CSS pixels. */
const HEIGHT_PX = WIDTH_PX / VIEW_ASPECT;

/** jsdom has no layout: the scene is faked as a 400 px wide box at the top left corner. */
function installLayout(): void {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: () => void) {}
      observe(): void {
        this.callback();
      }
      disconnect(): void {
        // Nothing to release: the fake never subscribes to anything.
      }
    },
  );
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(WIDTH_PX);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    width: WIDTH_PX,
    height: HEIGHT_PX,
    top: 0,
    left: 0,
    right: WIDTH_PX,
    bottom: HEIGHT_PX,
    toJSON: () => ({}),
  });
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => true);
}

/** Half the side of the hit area of a handle, in CSS pixels (DESIGN.md §5 Slider). */
const HANDLE_HALF_PX = 12;

/** Components of a vector as the panel shows them, `(x unit, y unit)`. */
function componentsIn(term: string): [number, number] {
  const [x, y] = (valueOf(term).match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  return [x ?? NaN, y ?? NaN];
}

/** Where the canvas draws the tip of `a`, in CSS pixels, for the view fitted to the tips. */
function drawnTip(a: [number, number], b: [number, number]): [number, number] {
  const sum: [number, number] = [a[0] + b[0], a[1] + b[1]];
  const transform = createTransform({
    widthPx: WIDTH_PX,
    heightPx: HEIGHT_PX,
    worldWidth_m: viewWidth([a, b, sum], VIEW_ASPECT),
    center_m: VIEW_CENTER,
    dpr: 1,
  });
  return worldToPx(transform, a[0], a[1]);
}

/** Centre of a handle over the scene, in CSS pixels, from its absolute placement. */
function centreOf(handle: HTMLElement): [number, number] {
  const side_px = parseFloat(handle.style.width);
  return [parseFloat(handle.style.left) + side_px / 2, parseFloat(handle.style.top) + side_px / 2];
}

describe('VectorWidget · view fit (#285)', () => {
  beforeEach(installLayout);
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test('dragging a straight up to the top edge, again and again, keeps its tip in reach', () => {
    renderCurriculum();
    // The y axis, where a vertical tip is the tallest it can be for its length.
    const axis_px = WIDTH_PX / 2;
    const tip = screen.getByRole('button', { name: 'Punta del vector a' });

    let previousY = 0;
    for (let drag = 0; drag < 5; drag += 1) {
      const [x_px, y_px] = centreOf(tip);
      act(() => {
        fireEvent.pointerDown(tip, { clientX: x_px, clientY: y_px, pointerId: 1 });
        fireEvent.pointerMove(tip, { clientX: axis_px, clientY: 1, pointerId: 1 });
        fireEvent.pointerUp(tip, { clientX: axis_px, clientY: 1, pointerId: 1 });
      });

      const a = componentsIn('Componentes de a');
      const [drawnX_px, drawnY_px] = drawnTip(a, [0.2, -0.1]);
      const [handleX_px, handleY_px] = centreOf(tip);
      // The tip is drawn with room for its whole handle, and the handle sits on it.
      expect(drawnY_px).toBeGreaterThan(HANDLE_HALF_PX);
      expect(drawnY_px).toBeLessThan(HEIGHT_PX - HANDLE_HALF_PX);
      expect(drawnX_px).toBeGreaterThan(HANDLE_HALF_PX);
      expect(drawnX_px).toBeLessThan(WIDTH_PX - HANDLE_HALF_PX);
      expect(handleX_px).toBeCloseTo(drawnX_px, 0);
      expect(handleY_px).toBeCloseTo(drawnY_px, 0);
      // Each drag stretches a further: the edge keeps moving away.
      expect(a[1]).toBeGreaterThan(previousY);
      previousY = a[1];
    }
  });
});
