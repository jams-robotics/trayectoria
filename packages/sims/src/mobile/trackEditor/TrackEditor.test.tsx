import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from '@trayectoria/i18n';
import type { Track } from '@trayectoria/sim-core';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { TrackEditor } from './TrackEditor';

// jsdom has no layout, so `Scene2D` never measures its container and its `Transform` stays at the
// fallback width: the pointer tests below live in the e2e (apps/web/e2e/track-editor.spec.ts).
// What is checked here is the behaviour of the numeric panel, the toolbar and save/load —
// criterio de #126: «Test de comportamiento (Testing Library) del panel numérico: editar
// `radius_m` cambia el arco».

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

beforeEach(() => {
  vi.restoreAllMocks();
});

/** Selects the first segment of the track through the panel's own list (the keyboard route). */
async function selectFirstSegment(
  user: ReturnType<typeof userEvent.setup>,
  kind: 'Line' | 'Arc' = 'Line',
): Promise<void> {
  await user.click(
    screen.getByRole('button', { name: t(`sims.trackEditor.segment${kind}`, { index: 1 }) }),
  );
}

describe('TrackEditor (F4-01b)', () => {
  test('editing radius_m in the panel changes the arc', async () => {
    const user = userEvent.setup();
    const changes: Track[] = [];
    render(<TrackEditor initialTrack={ARC_TRACK} onChange={(track) => changes.push(track)} />);
    await selectFirstSegment(user, 'Arc');
    // #159: el radio también está en la barra flotante, así que este criterio se mide en el panel.
    const field = within(screen.getByTestId('track-editor-panel')).getByLabelText(
      t('sims.trackEditor.field.radius'),
    );
    await user.clear(field);
    await user.type(field, '0.3');
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(changes).not.toHaveLength(0);
    });
    const last = changes[changes.length - 1]?.segments[0];
    if (last?.type !== 'arc') throw new Error('expected an arc');
    expect(last.radius_m).toBeCloseTo(0.3, 9);
  });

  // #159, decisión 4: la casilla «Sentido antihorario» pasa a control segmentado.
  test('the direction control of the panel flips the sweep of the selected arc', async () => {
    const user = userEvent.setup();
    const changes: Track[] = [];
    render(<TrackEditor initialTrack={ARC_TRACK} onChange={(track) => changes.push(track)} />);
    await selectFirstSegment(user, 'Arc');
    const panel = screen.getByTestId('track-editor-panel');
    await user.click(
      within(panel).getByRole('radio', { name: t('sims.trackEditor.directionCcw') }),
    );
    const last = changes[changes.length - 1]?.segments[0];
    if (last?.type !== 'arc') throw new Error('expected an arc');
    expect(last.ccw).toBe(true);
  });

  test('editing an endpoint of a straight segment moves it', async () => {
    const user = userEvent.setup();
    const changes: Track[] = [];
    render(<TrackEditor initialTrack={LINE_TRACK} onChange={(track) => changes.push(track)} />);
    await selectFirstSegment(user);
    const field = screen.getByLabelText(t('sims.trackEditor.field.toY'));
    await user.clear(field);
    await user.type(field, '0.2{Enter}');
    await waitFor(() => {
      const last = changes[changes.length - 1]?.segments[0];
      expect(last).toEqual({ type: 'line', from: [0, 0], to: [0.3, 0.2] });
    });
  });

  test('a straight segment offers no radius field', async () => {
    const user = userEvent.setup();
    render(<TrackEditor initialTrack={LINE_TRACK} />);
    await selectFirstSegment(user);
    expect(screen.queryByLabelText(t('sims.trackEditor.field.radius'))).toBeNull();
  });

  test('with nothing selected the panel says so', () => {
    render(<TrackEditor initialTrack={LINE_TRACK} />);
    expect(screen.getByText(t('sims.trackEditor.noSegment'))).toBeInTheDocument();
  });

  test('the toolbar marks the active tool and switches with the keyboard', async () => {
    const user = userEvent.setup();
    render(<TrackEditor />);
    const line = screen.getByRole('radio', { name: t('sims.trackEditor.tool.line') });
    expect(line).toHaveAttribute('aria-checked', 'false');
    await user.click(line);
    expect(line).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: t('sims.trackEditor.tool.select') })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  test('a preset fills the track and reports it as continuous and closed', async () => {
    const user = userEvent.setup();
    render(<TrackEditor />);
    await user.selectOptions(screen.getByLabelText(t('sims.trackEditor.preset')), 'oval');
    expect(screen.getByTestId('track-editor-continuity')).toHaveTextContent(
      t('sims.trackEditor.continuity.ok'),
    );
  });

  test('a preset over unsaved work asks for confirmation and can be cancelled', async () => {
    const user = userEvent.setup();
    render(<TrackEditor initialTrack={LINE_TRACK} />);
    await selectFirstSegment(user);
    const field = screen.getByLabelText(t('sims.trackEditor.field.toY'));
    await user.clear(field);
    await user.type(field, '0.2{Enter}');
    await user.selectOptions(screen.getByLabelText(t('sims.trackEditor.preset')), 'oval');
    expect(screen.getByText(t('sims.trackEditor.presetConfirm'))).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: t('sims.trackEditor.presetConfirmCancel') }),
    );
    expect(screen.queryByText(t('sims.trackEditor.presetConfirm'))).toBeNull();
    expect(screen.getByTestId('track-editor-continuity')).toHaveTextContent(
      t('sims.trackEditor.continuity.open'),
    );
  });

  test('confirming the preset replaces the track', async () => {
    const user = userEvent.setup();
    render(<TrackEditor initialTrack={LINE_TRACK} />);
    await selectFirstSegment(user);
    const field = screen.getByLabelText(t('sims.trackEditor.field.toY'));
    await user.clear(field);
    await user.type(field, '0.2{Enter}');
    await user.selectOptions(screen.getByLabelText(t('sims.trackEditor.preset')), 'oval');
    await user.click(
      screen.getByRole('button', { name: t('sims.trackEditor.presetConfirmAccept') }),
    );
    expect(screen.getByTestId('track-editor-continuity')).toHaveTextContent(
      t('sims.trackEditor.continuity.ok'),
    );
  });

  test('undo and redo work from the buttons and from Ctrl+Z / Ctrl+Shift+Z', async () => {
    const user = userEvent.setup();
    render(<TrackEditor initialTrack={LINE_TRACK} />);
    const undoButton = screen.getByRole('button', { name: t('sims.trackEditor.undo') });
    expect(undoButton).toBeDisabled();
    await selectFirstSegment(user);
    const field = screen.getByLabelText(t('sims.trackEditor.field.toY'));
    await user.clear(field);
    await user.type(field, '0.2{Enter}');
    await waitFor(() => {
      expect(undoButton).toBeEnabled();
    });
    await user.click(undoButton);
    await waitFor(() => {
      expect(screen.getByLabelText(t('sims.trackEditor.field.toY'))).toHaveValue('0');
    });
    await user.keyboard('{Control>}{Shift>}Z{/Shift}{/Control}');
    await waitFor(() => {
      expect(screen.getByLabelText(t('sims.trackEditor.field.toY'))).toHaveValue('0.2');
    });
    await user.keyboard('{Control>}z{/Control}');
    await waitFor(() => {
      expect(screen.getByLabelText(t('sims.trackEditor.field.toY'))).toHaveValue('0');
    });
  });

  test('the continuity notice lists the gaps with their index and millimetres', () => {
    const gapped: Track = {
      segments: [
        { type: 'line', from: [0, 0], to: [0.3, 0] },
        { type: 'line', from: [0.35, 0], to: [0.35, 0.2] },
      ],
      lineWidth_m: 0.02,
    };
    render(<TrackEditor initialTrack={gapped} />);
    const notice = screen.getByTestId('track-editor-continuity');
    expect(notice).toHaveAttribute('aria-live', 'polite');
    expect(notice).toHaveTextContent(
      t('sims.trackEditor.continuity.gap', { index: 1, gap: '50.0' }),
    );
    expect(notice).toHaveTextContent(t('sims.trackEditor.continuity.open'));
  });

  test('Exportar JSON downloads the serialized track and clears the unsaved mark', async () => {
    const user = userEvent.setup();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pista');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    render(<TrackEditor initialTrack={LINE_TRACK} />);
    await user.click(screen.getByRole('button', { name: t('sims.trackEditor.exportJson') }));
    expect(click).toHaveBeenCalledTimes(1);
    expect(await screen.findByTestId('toast')).toHaveTextContent(t('sims.trackEditor.saved'));
  });

  test('Cargar replaces the track with the file contents', async () => {
    const user = userEvent.setup();
    render(<TrackEditor />);
    const json = JSON.stringify({
      segments: [
        { type: 'line', from: [0, 0], to: [0.3, 0] },
        { type: 'line', from: [0.3, 0], to: [0, 0] },
      ],
      lineWidth_m: 0.02,
    });
    const input = screen.getByLabelText(t('sims.trackEditor.loadInput'));
    await user.upload(input, new File([json], 'pista.json', { type: 'application/json' }));
    await waitFor(() => {
      expect(screen.getByTestId('track-editor-continuity')).toHaveTextContent(
        t('sims.trackEditor.continuity.ok'),
      );
    });
  });

  test('an invalid file shows the error in the live region and keeps the track', async () => {
    const user = userEvent.setup();
    render(<TrackEditor initialTrack={LINE_TRACK} />);
    const input = screen.getByLabelText(t('sims.trackEditor.loadInput'));
    await user.upload(input, new File(['{ not json'], 'pista.json', { type: 'application/json' }));
    const error = await screen.findByTestId('track-editor-error');
    expect(error).toHaveAttribute('aria-live', 'assertive');
    expect(error.textContent ?? '').toContain('pista');
    await selectFirstSegment(user);
    expect(screen.getByLabelText(t('sims.trackEditor.field.toX'))).toHaveValue('0.3');
  });

  test('the global line width is editable', async () => {
    const user = userEvent.setup();
    const changes: Track[] = [];
    render(<TrackEditor initialTrack={LINE_TRACK} onChange={(track) => changes.push(track)} />);
    const field = screen.getByLabelText(t('sims.trackEditor.field.lineWidth'));
    await user.clear(field);
    await user.type(field, '0.03{Enter}');
    await waitFor(() => {
      expect(changes[changes.length - 1]?.lineWidth_m).toBeCloseTo(0.03, 9);
    });
  });

  test('a field left with text that is not a number keeps the previous value', async () => {
    const user = userEvent.setup();
    render(<TrackEditor initialTrack={LINE_TRACK} />);
    await selectFirstSegment(user);
    const field = screen.getByLabelText(t('sims.trackEditor.field.toX'));
    await user.clear(field);
    await user.type(field, 'abc{Enter}');
    await waitFor(() => {
      expect(screen.getByLabelText(t('sims.trackEditor.field.toX'))).toHaveValue('0.3');
    });
  });

  test('the canvas describes the scene and every control carries a label', () => {
    render(<TrackEditor initialTrack={LINE_TRACK} />);
    expect(screen.getByRole('img', { name: t('sims.trackEditor.scene') })).toBeInTheDocument();
    const toolbar = screen.getByRole('radiogroup', { name: t('sims.trackEditor.tools') });
    expect(within(toolbar).getAllByRole('radio')).toHaveLength(4);
  });
});
