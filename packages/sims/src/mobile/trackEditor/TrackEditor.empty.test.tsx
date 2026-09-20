import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from '@trayectoria/i18n';
import type { Track } from '@trayectoria/sim-core';
import { describe, expect, test } from 'vitest';

import { TrackEditor } from './TrackEditor';

// #190 (decisiones 1 y 2): «Nueva» en la barra y la opción «Vacía» del selector de preset dejan
// el lienzo sin segmentos. Ambas preguntan antes si hay algo que perder, y el vaciado pasa por el
// historial, así que «Deshacer» devuelve la pista que había.
//
// Como en `TrackEditor.test.tsx`, jsdom no maqueta y `Scene2D` nunca mide: lo que se comprueba
// aquí es la barra y la lista de segmentos del panel, no el dibujo.

const LINE_TRACK: Track = {
  segments: [{ type: 'line', from: [0, 0], to: [0.3, 0] }],
  lineWidth_m: 0.02,
};

/** Los segmentos que el panel lista; ninguno cuando la pista está vacía. */
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
    // El ancho de línea es el que se estaba usando, no el del preset por defecto.
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
    // Vaciar es una edición más: pasa por el historial y «Deshacer» la revierte (decisión 1).
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
