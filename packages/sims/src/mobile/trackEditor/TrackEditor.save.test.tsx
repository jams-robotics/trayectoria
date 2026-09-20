import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from '@trayectoria/i18n';
import type { Track } from '@trayectoria/sim-core';
import { describe, expect, test, vi } from 'vitest';

import { TrackEditor } from './TrackEditor';

// F4-06 (#191, decisions 3 and 6): «Guardar» of the editor. What is checked is the contract with
// the page — no button without the prop, an empty name never saves, and the callback gets the
// name and the track the editor has — and not where the page then writes it, which is the job of
// the hook and the adapter.

const LINE_TRACK: Track = {
  segments: [{ type: 'line', from: [0, 0], to: [0.2, 0] }],
  lineWidth_m: 0.02,
};

describe('TrackEditor · Guardar (F4-06)', () => {
  test('shows no «Guardar» button without onSaveTrack', () => {
    render(<TrackEditor initialTrack={LINE_TRACK} />);
    expect(screen.queryByTestId('track-editor-save-track')).not.toBeInTheDocument();
    // The file buttons keep their new names in both layouts (decision 3).
    expect(
      screen.getByRole('button', { name: t('sims.trackEditor.exportJson') }),
    ).toBeInTheDocument();
  });

  test('calls onSaveTrack with the name and the track of the editor', async () => {
    const user = userEvent.setup();
    const onSaveTrack = vi.fn<(name: string, track: Track) => Promise<void>>(() => Promise.resolve());
    render(<TrackEditor initialTrack={LINE_TRACK} onSaveTrack={onSaveTrack} />);
    await user.click(screen.getByTestId('track-editor-save-track'));
    await user.type(screen.getByTestId('track-editor-save-name'), 'Mi óvalo');
    await user.click(screen.getByTestId('track-editor-save-track-confirm'));
    expect(onSaveTrack).toHaveBeenCalledTimes(1);
    expect(onSaveTrack).toHaveBeenCalledWith('Mi óvalo', LINE_TRACK);
    // The field closes after saving, so the bar goes back to its single «Guardar».
    expect(screen.queryByTestId('track-editor-save-name')).not.toBeInTheDocument();
  });

  test('does not save an empty name and keeps the field open', async () => {
    const user = userEvent.setup();
    const onSaveTrack = vi.fn<(name: string, track: Track) => Promise<void>>(() => Promise.resolve());
    render(<TrackEditor initialTrack={LINE_TRACK} onSaveTrack={onSaveTrack} />);
    await user.click(screen.getByTestId('track-editor-save-track'));
    const confirm = screen.getByTestId('track-editor-save-track-confirm');
    expect(confirm).toBeDisabled();
    await user.type(screen.getByTestId('track-editor-save-name'), '   ');
    expect(confirm).toBeDisabled();
    expect(onSaveTrack).not.toHaveBeenCalled();
    expect(screen.getByTestId('track-editor-save-name')).toBeInTheDocument();
  });

  test('Enter saves and Esc closes the field without saving', async () => {
    const user = userEvent.setup();
    const onSaveTrack = vi.fn<(name: string, track: Track) => Promise<void>>(() => Promise.resolve());
    render(<TrackEditor initialTrack={LINE_TRACK} onSaveTrack={onSaveTrack} />);
    await user.click(screen.getByTestId('track-editor-save-track'));
    await user.type(screen.getByTestId('track-editor-save-name'), 'Con Enter{Enter}');
    expect(onSaveTrack).toHaveBeenCalledWith('Con Enter', LINE_TRACK);

    await user.click(screen.getByTestId('track-editor-save-track'));
    await user.type(screen.getByTestId('track-editor-save-name'), 'Descartada{Escape}');
    expect(onSaveTrack).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('track-editor-save-name')).not.toBeInTheDocument();
  });

  test('caps the name at the length the tracks table accepts', async () => {
    const user = userEvent.setup();
    const onSaveTrack = vi.fn<(name: string, track: Track) => Promise<void>>(() => Promise.resolve());
    render(<TrackEditor initialTrack={LINE_TRACK} onSaveTrack={onSaveTrack} />);
    await user.click(screen.getByTestId('track-editor-save-track'));
    const field = screen.getByTestId('track-editor-save-name');
    expect(field).toHaveAttribute('maxLength', '80');
  });
});
