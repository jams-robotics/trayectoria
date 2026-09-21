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

/** Activates one of the toolbar tools by its label, as a learner would. */
async function useTool(
  user: ReturnType<typeof userEvent.setup>,
  tool: 'select' | 'line' | 'arc' | 'erase',
): Promise<void> {
  await user.click(screen.getByRole('radio', { name: t(`sims.trackEditor.tool.${tool}`) }));
}

/** The `ccw` of the first segment of the last notified change; throws when it is not an arc. */
function lastArcCcw(changes: readonly Track[]): boolean {
  const last = changes[changes.length - 1]?.segments[0];
  if (last?.type !== 'arc') throw new Error('expected an arc');
  return last.ccw;
}

describe('TrackEditor · barra del segmento (#159)', () => {
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
    expect(lastArcCcw(changes)).toBe(true);
  });

  test('the F key flips the selected arc and undo takes it back', async () => {
    const user = userEvent.setup();
    const changes: Track[] = [];
    render(<TrackEditor initialTrack={ARC_TRACK} onChange={(track) => changes.push(track)} />);
    await selectFirstSegment(user, 'Arc');
    await user.keyboard('f');
    expect(lastArcCcw(changes)).toBe(true);
    await user.click(screen.getByRole('button', { name: t('sims.trackEditor.undo') }));
    await waitFor(() => {
      expect(lastArcCcw(changes)).toBe(false);
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
    expect(lastArcCcw(changes)).toBe(true);
    await waitFor(() => {
      expect(
        within(
          screen.getByRole('radiogroup', { name: t('sims.trackEditor.direction') }),
        ).getByRole('radio', { name: t('sims.trackEditor.directionCcw') }),
      ).toHaveAttribute('aria-checked', 'true');
    });
  });
});

// #180 (decisions 1 and 2): the floating bar belongs to «Seleccionar». With a drawing tool active
// it would sit over the very corner the learner is drawing on, so it is not rendered; the
// selection itself is untouched, and the F/Supr shortcuts keep working whatever the tool.
describe('TrackEditor · la barra solo con «Seleccionar» (#180)', () => {
  test('a drawing tool hides the bar and «Seleccionar» brings it back', async () => {
    const user = userEvent.setup();
    render(<TrackEditor initialTrack={LINE_TRACK} />);
    await selectFirstSegment(user);
    expect(screen.getByTestId('track-editor-segment-bar')).toBeInTheDocument();

    // None of the three drawing tools renders the bar, and the selection survives each of them:
    // the segment stays marked in the list, so «Seleccionar» needs no reselection.
    for (const tool of ['line', 'arc', 'erase'] as const) {
      await useTool(user, tool);
      expect(screen.queryByTestId('track-editor-segment-bar')).toBeNull();
      expect(
        screen.getByRole('button', { name: t('sims.trackEditor.segmentLine', { index: 1 }) }),
      ).toHaveAttribute('data-selected', 'true');
    }

    await useTool(user, 'select');
    expect(screen.getByTestId('track-editor-segment-bar')).toBeInTheDocument();
  });

  test('Supr removes the selected segment with the bar hidden by «Recta»', async () => {
    const user = userEvent.setup();
    const changes: Track[] = [];
    render(<TrackEditor initialTrack={LINE_TRACK} onChange={(track) => changes.push(track)} />);
    await selectFirstSegment(user);
    await useTool(user, 'line');
    expect(screen.queryByTestId('track-editor-segment-bar')).toBeNull();

    await user.keyboard('{Delete}');
    expect(changes[changes.length - 1]?.segments).toHaveLength(0);
  });

  test('F flips the selected arc with the bar hidden by «Arco»', async () => {
    const user = userEvent.setup();
    const changes: Track[] = [];
    render(<TrackEditor initialTrack={ARC_TRACK} onChange={(track) => changes.push(track)} />);
    await selectFirstSegment(user, 'Arc');
    await useTool(user, 'arc');
    expect(screen.queryByTestId('track-editor-segment-bar')).toBeNull();

    await user.keyboard('f');
    expect(lastArcCcw(changes)).toBe(true);
  });
});
