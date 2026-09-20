import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from '@trayectoria/i18n';
import type { Track } from '@trayectoria/sim-core';
import { describe, expect, test } from 'vitest';

import { TrackEditor } from './TrackEditor';

// #159: la barra flotante del segmento seleccionado, sus atajos de teclado y el control
// segmentado de sentido que sustituye a la casilla «invertir» del panel numérico. Como en
// TrackEditor.test.tsx, jsdom no hace layout: lo que se comprueba aquí es el comportamiento de
// los controles, no su posición sobre el lienzo (eso va al visual de apps/web).

const ARC_TRACK: Track = {
  segments: [
    {
      type: 'arc',
      center: [0.1, 0],
      radius_m: 0.125,
      startAngle_rad: Math.PI,
      endAngle_rad: 0,
      ccw: false,
    },
  ],
  lineWidth_m: 0.02,
};

const LINE_TRACK: Track = {
  segments: [{ type: 'line', from: [0, 0], to: [0.3, 0] }],
  lineWidth_m: 0.02,
};

/** Selects the first segment of the track through the panel's own list (the keyboard route). */
async function selectFirstSegment(
  user: ReturnType<typeof userEvent.setup>,
  kind: 'Line' | 'Arc' = 'Line',
): Promise<void> {
  await user.click(
    screen.getByRole('button', { name: t(`sims.trackEditor.segment${kind}`, { index: 1 }) }),
  );
}

describe('TrackEditor · barra del segmento (#159)', () => {
  /** El `ccw` del primer segmento del último cambio notificado; falla si no es un arco. */
  function lastCcw(changes: readonly Track[]): boolean {
    const last = changes[changes.length - 1]?.segments[0];
    if (last?.type !== 'arc') throw new Error('expected an arc');
    return last.ccw;
  }

  test('with nothing selected the floating bar is not rendered', () => {
    render(<TrackEditor initialTrack={ARC_TRACK} />);
    expect(screen.queryByTestId('track-editor-segment-bar')).toBeNull();
  });

  test('selecting a segment shows the floating bar', async () => {
    const user = userEvent.setup();
    render(<TrackEditor initialTrack={ARC_TRACK} />);
    await selectFirstSegment(user, 'Arc');
    expect(screen.getByTestId('track-editor-segment-bar')).toBeInTheDocument();
  });

  test('«Invertir sentido» in the bar negates ccw of the selected arc', async () => {
    const user = userEvent.setup();
    const changes: Track[] = [];
    render(<TrackEditor initialTrack={ARC_TRACK} onChange={(track) => changes.push(track)} />);
    await selectFirstSegment(user, 'Arc');
    const bar = screen.getByTestId('track-editor-segment-bar');
    await user.click(within(bar).getByRole('button', { name: t('sims.trackEditor.flipArc') }));
    expect(lastCcw(changes)).toBe(true);
  });

  test('the F key flips the selected arc and undo takes it back', async () => {
    const user = userEvent.setup();
    const changes: Track[] = [];
    render(<TrackEditor initialTrack={ARC_TRACK} onChange={(track) => changes.push(track)} />);
    await selectFirstSegment(user, 'Arc');
    await user.keyboard('f');
    expect(lastCcw(changes)).toBe(true);
    await user.click(screen.getByRole('button', { name: t('sims.trackEditor.undo') }));
    await waitFor(() => {
      expect(lastCcw(changes)).toBe(false);
    });
  });

  test('a straight segment offers no flip button and F does nothing', async () => {
    const user = userEvent.setup();
    const changes: Track[] = [];
    render(<TrackEditor initialTrack={LINE_TRACK} onChange={(track) => changes.push(track)} />);
    await selectFirstSegment(user);
    const bar = screen.getByTestId('track-editor-segment-bar');
    expect(within(bar).queryByRole('button', { name: t('sims.trackEditor.flipArc') })).toBeNull();
    const before = changes.length;
    await user.keyboard('f');
    expect(changes).toHaveLength(before);
  });

  test('«Borrar» in the bar removes the selected segment', async () => {
    const user = userEvent.setup();
    const changes: Track[] = [];
    render(<TrackEditor initialTrack={LINE_TRACK} onChange={(track) => changes.push(track)} />);
    await selectFirstSegment(user);
    const bar = screen.getByTestId('track-editor-segment-bar');
    await user.click(
      within(bar).getByRole('button', { name: t('sims.trackEditor.deleteSegment') }),
    );
    expect(changes[changes.length - 1]?.segments).toHaveLength(0);
    expect(screen.getByText(t('sims.trackEditor.noSegments'))).toBeInTheDocument();
  });

  test('Supr removes the selected segment and undo brings it back', async () => {
    const user = userEvent.setup();
    const changes: Track[] = [];
    render(<TrackEditor initialTrack={LINE_TRACK} onChange={(track) => changes.push(track)} />);
    await selectFirstSegment(user);
    await user.keyboard('{Delete}');
    expect(changes[changes.length - 1]?.segments).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: t('sims.trackEditor.undo') }));
    await waitFor(() => {
      expect(changes[changes.length - 1]?.segments).toHaveLength(1);
    });
  });

  test('Supr with the focus in a numeric field does not remove the segment', async () => {
    const user = userEvent.setup();
    const changes: Track[] = [];
    render(<TrackEditor initialTrack={LINE_TRACK} onChange={(track) => changes.push(track)} />);
    await selectFirstSegment(user);
    const field = screen.getByLabelText(t('sims.trackEditor.field.toX'));
    await user.click(field);
    const before = changes.length;
    await user.keyboard('{Delete}');
    expect(changes).toHaveLength(before);
    expect(screen.getByTestId('track-editor-segment-bar')).toBeInTheDocument();
  });

  test('the radius field of the bar edits the selected arc', async () => {
    const user = userEvent.setup();
    const changes: Track[] = [];
    render(<TrackEditor initialTrack={ARC_TRACK} onChange={(track) => changes.push(track)} />);
    await selectFirstSegment(user, 'Arc');
    const bar = screen.getByTestId('track-editor-segment-bar');
    const field = within(bar).getByLabelText(t('sims.trackEditor.field.radius'));
    await user.clear(field);
    await user.type(field, '0.4{Enter}');
    await waitFor(() => {
      const last = changes[changes.length - 1]?.segments[0];
      if (last?.type !== 'arc') throw new Error('expected an arc');
      expect(last.radius_m).toBeCloseTo(0.4, 9);
    });
  });

  test('the direction radiogroup reflects ccw and sets it', async () => {
    const user = userEvent.setup();
    const changes: Track[] = [];
    render(<TrackEditor initialTrack={ARC_TRACK} onChange={(track) => changes.push(track)} />);
    await selectFirstSegment(user, 'Arc');
    const group = screen.getByRole('radiogroup', { name: t('sims.trackEditor.direction') });
    const cw = within(group).getByRole('radio', { name: t('sims.trackEditor.directionCw') });
    const ccw = within(group).getByRole('radio', { name: t('sims.trackEditor.directionCcw') });
    expect(cw).toHaveAttribute('aria-checked', 'true');
    expect(ccw).toHaveAttribute('aria-checked', 'false');
    await user.click(ccw);
    expect(lastCcw(changes)).toBe(true);
    await waitFor(() => {
      expect(
        within(
          screen.getByRole('radiogroup', { name: t('sims.trackEditor.direction') }),
        ).getByRole('radio', { name: t('sims.trackEditor.directionCcw') }),
      ).toHaveAttribute('aria-checked', 'true');
    });
  });
});
