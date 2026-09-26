import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from '@trayectoria/i18n';
import type { Track } from '@trayectoria/sim-core';
import { describe, expect, test } from 'vitest';

import { TrackEditor } from './TrackEditor';

// #190 (decisions 1 and 2): «Nueva» in the bar and the «Vacía» option of the preset selector leave
// the canvas without segments. Both ask first if there is anything to lose, and the emptying goes through the
// history, so «Deshacer» brings back the track that was there.
//
// As in `TrackEditor.test.tsx`, jsdom does no layout and `Scene2D` never measures: what is checked
// here is the bar and the segment list of the panel, not the drawing.

const LINE_TRACK: Track = {
  segments: [{ type: 'line', from: [0, 0], to: [0.3, 0] }],
  lineWidth_m: 0.02,
};

/** The segments the panel lists; none when the track is empty. */
function segmentCount(): number {
  return screen.queryAllByRole('button', { name: /^Segmento \d+: / }).length;
}

describe('«Nueva» y la pista vacía (#190)', () => {
  test('«Nueva» over an empty canvas empties it without asking', async () => {
    const user = userEvent.setup();
    render(<TrackEditor />);
    await user.click(screen.getByRole('button', { name: t('sims.trackEditor.newTrack') }));
    expect(screen.queryByText(t('sims.trackEditor.newConfirm'))).toBeNull();
    expect(segmentCount()).toBe(0);
  });

  test('«Nueva» over a track asks first and cancelling keeps the track', async () => {
    const user = userEvent.setup();
    render(<TrackEditor initialTrack={LINE_TRACK} />);
    expect(segmentCount()).toBe(1);
    await user.click(screen.getByRole('button', { name: t('sims.trackEditor.newTrack') }));
    expect(screen.getByText(t('sims.trackEditor.newConfirm'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('sims.trackEditor.newConfirmCancel') }));
    expect(screen.queryByText(t('sims.trackEditor.newConfirm'))).toBeNull();
    expect(segmentCount()).toBe(1);
  });

  test('confirming «Nueva» empties the canvas and keeps the line width', async () => {
    const user = userEvent.setup();
    const changes: Track[] = [];
    render(<TrackEditor initialTrack={LINE_TRACK} onChange={(track) => changes.push(track)} />);
    await user.click(screen.getByRole('button', { name: t('sims.trackEditor.newTrack') }));
    await user.click(screen.getByRole('button', { name: t('sims.trackEditor.newConfirmAccept') }));
    await waitFor(() => {
      expect(segmentCount()).toBe(0);
    });
    // The line width is the one that was in use, not that of the default preset.
    expect(changes.at(-1)).toEqual({ segments: [], lineWidth_m: LINE_TRACK.lineWidth_m });
  });

  test('«Deshacer» after «Nueva» brings the track back', async () => {
    const user = userEvent.setup();
    render(<TrackEditor initialTrack={LINE_TRACK} />);
    await user.click(screen.getByRole('button', { name: t('sims.trackEditor.newTrack') }));
    await user.click(screen.getByRole('button', { name: t('sims.trackEditor.newConfirmAccept') }));
    await waitFor(() => {
      expect(segmentCount()).toBe(0);
    });
    // Emptying is one more edit: it goes through the history and «Deshacer» reverts it (decision 1).
    const undoButton = screen.getByRole('button', { name: t('sims.trackEditor.undo') });
    expect(undoButton).toBeEnabled();
    await user.click(undoButton);
    await waitFor(() => {
      expect(segmentCount()).toBe(1);
    });
  });

  test('the «Vacía» option of the preset picker asks the same and empties the canvas', async () => {
    const user = userEvent.setup();
    render(<TrackEditor initialTrack={LINE_TRACK} />);
    await user.selectOptions(screen.getByLabelText(t('sims.trackEditor.preset')), 'empty');
    expect(screen.getByText(t('sims.trackEditor.newConfirm'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('sims.trackEditor.newConfirmAccept') }));
    await waitFor(() => {
      expect(segmentCount()).toBe(0);
    });
  });
});
