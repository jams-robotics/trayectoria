import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from '@trayectoria/i18n';
import type { Track } from '@trayectoria/sim-core';
import { describe, expect, test, vi } from 'vitest';

import { TrackEditor } from './TrackEditor';

// F4-01b: lo que el puntero dibuja sobre el lienzo. Va aparte de TrackEditor.test.tsx, que
// cubre el panel numérico y la barra, para no pasar de 300 líneas por archivo
// (docs/STANDARDS.md §4).
const LINE_TRACK: Track = {
  segments: [{ type: 'line', from: [0, 0], to: [0.3, 0] }],
  lineWidth_m: 0.02,
};

describe('TrackEditor con el puntero (F4-01b)', () => {
  // jsdom gives every element a zero-sized box, so `createTransform` would map nothing: the
  // canvas is given a 720 × 405 box, which over `worldWidth_m = 1.8` makes 1 m exactly 400 px.
  // `SCENE_CENTER_M` = (0.475, 0.05) sits at the centre of that box, (360, 202.5), and every
  // metre is 400 px from there. The drawing itself is exercised end to end against a real
  // browser in apps/web/e2e/track-editor.spec.ts.
  const CANVAS_BOX = {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 720,
    bottom: 405,
    width: 720,
    height: 405,
  };

  /** Píxeles del lienzo del punto `p_m`, con el mismo mapeo que usa el editor. */
  function px(p_m: readonly [number, number]): { clientX: number; clientY: number } {
    return {
      clientX: 360 + (p_m[0] - 0.475) * 400,
      clientY: 202.5 - (p_m[1] - 0.05) * 400,
    };
  }

  /** Lays out the canvas of the editor and returns the container the pointer events go to. */
  function layOutCanvas(): HTMLElement {
    const canvas = screen.getByRole('img', { name: t('sims.trackEditor.scene') });
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      ...CANVAS_BOX,
      toJSON: () => CANVAS_BOX,
    });
    const host = canvas.closest('[data-testid="scene2d"]')?.parentElement;
    if (host === null || host === undefined) throw new Error('no pointer host');
    host.setPointerCapture = () => undefined;
    host.releasePointerCapture = () => undefined;
    return host;
  }

  test('drawing a straight with the pointer adds it to the track', async () => {
    const changes: Track[] = [];
    render(<TrackEditor onChange={(track) => changes.push(track)} />);
    const host = layOutCanvas();
    // (0,0) is the centre of the 560 × 315 box; 0.2 m to the right is 80 px.
    // Sin herramienta de dibujo, «Seleccionar» no añade nada.
    fireEvent.pointerDown(host, { pointerId: 1, ...px([0, 0]) });
    fireEvent.pointerMove(host, { pointerId: 1, ...px([0.2, 0]) });
    fireEvent.pointerUp(host, { pointerId: 1, ...px([0.2, 0]) });
    expect(changes).toEqual([]);
    await userEvent
      .setup()
      .click(screen.getByRole('radio', { name: t('sims.trackEditor.tool.line') }));
    fireEvent.pointerDown(host, { pointerId: 1, ...px([0, 0]) });
    fireEvent.pointerMove(host, { pointerId: 1, ...px([0.2, 0]) });
    fireEvent.pointerUp(host, { pointerId: 1, ...px([0.2, 0]) });
    const segment = changes[changes.length - 1]?.segments[0];
    if (segment?.type !== 'line') throw new Error('expected a straight segment');
    expect(segment.from[0]).toBeCloseTo(0, 9);
    expect(segment.to[0]).toBeCloseTo(0.2, 9);
  });

  test('drawing an arc above the chord applies the golden radius of the ticket', async () => {
    const changes: Track[] = [];
    render(<TrackEditor onChange={(track) => changes.push(track)} />);
    const host = layOutCanvas();
    await userEvent
      .setup()
      .click(screen.getByRole('radio', { name: t('sims.trackEditor.tool.arc') }));
    // El arrastre dorado del ticket: (0,0) → (0.2,0) pasando por encima de la cuerda.
    fireEvent.pointerDown(host, { pointerId: 1, ...px([0, 0]) });
    fireEvent.pointerMove(host, { pointerId: 1, ...px([0.1, 0.05]) });
    fireEvent.pointerUp(host, { pointerId: 1, ...px([0.2, 0]) });
    const segment = changes[changes.length - 1]?.segments[0];
    if (segment?.type !== 'arc') throw new Error('expected an arc');
    expect(segment.radius_m).toBeCloseTo(0.125, 9);
    expect(segment.ccw).toBe(true);
  });

  // #160: el segmento seleccionado debe distinguirse en el lienzo. El marcado que lo prueba es
  // `data-selected` en su elemento de la lista; el resaltado del lienzo es canvas y se cubre con
  // la captura visual `TrackEditor-selected.png`.
  test('clicking a segment marks it as selected and clicking away unmarks it', () => {
    render(<TrackEditor initialTrack={LINE_TRACK} />);
    const host = layOutCanvas();
    const segment = screen.getByRole('button', {
      name: t('sims.trackEditor.segmentLine', { index: 1 }),
    });
    expect(segment).not.toHaveAttribute('data-selected');

    // La recta va de (0,0) a (0.3,0): un clic sobre ella la selecciona.
    fireEvent.pointerDown(host, { pointerId: 1, ...px([0.15, 0]) });
    fireEvent.pointerUp(host, { pointerId: 1, ...px([0.15, 0]) });
    expect(segment).toHaveAttribute('data-selected', 'true');

    // Un clic lejos de la pista la deselecciona.
    fireEvent.pointerDown(host, { pointerId: 1, ...px([0.15, 0.4]) });
    fireEvent.pointerUp(host, { pointerId: 1, ...px([0.15, 0.4]) });
    expect(segment).not.toHaveAttribute('data-selected');
  });

  test('the panel title names the selected segment and its kind', () => {
    render(<TrackEditor initialTrack={LINE_TRACK} />);
    const host = layOutCanvas();
    const panel = screen.getByTestId('track-editor-panel');
    expect(within(panel).getByRole('heading')).toHaveTextContent(t('sims.trackEditor.segment'));
    fireEvent.pointerDown(host, { pointerId: 1, ...px([0.15, 0]) });
    fireEvent.pointerUp(host, { pointerId: 1, ...px([0.15, 0]) });
    expect(within(panel).getByRole('heading')).toHaveTextContent(
      t('sims.trackEditor.segmentTitle.line', { index: 1 }),
    );
  });

  test('a pointer event before the canvas has a box draws nothing', () => {
    const changes: Track[] = [];
    render(<TrackEditor onChange={(track) => changes.push(track)} />);
    const host = screen
      .getByRole('img', { name: t('sims.trackEditor.scene') })
      .closest('[data-testid="scene2d"]')?.parentElement;
    if (host === null || host === undefined) throw new Error('no pointer host');
    host.setPointerCapture = () => undefined;
    host.releasePointerCapture = () => undefined;
    fireEvent.pointerDown(host, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(host, { pointerId: 1, clientX: 40, clientY: 10 });
    expect(changes).toEqual([]);
  });
});
