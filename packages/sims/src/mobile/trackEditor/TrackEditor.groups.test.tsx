import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from '@trayectoria/i18n';
import { presets } from '@trayectoria/sim-core';
import type { Track } from '@trayectoria/sim-core';
import { describe, expect, test } from 'vitest';

import { TrackEditor } from './TrackEditor';

// #552: the bar in three groups, the segments as a selectable list with the continuity notice
// in its block, and the canvas framed on the track it opens with. jsdom does no layout, so the
// heights and the grid of the «Pista» panel are checked by eye in the PR captures.

const LINE_TRACK: Track = {
  segments: [{ type: 'line', from: [0, 0], to: [0.3, 0] }],
  lineWidth_m: 0.02,
};

describe('Toolbar en tres grupos (#552)', () => {
  test('herramientas, historial y archivo son tres grupos con nombre', () => {
    render(<TrackEditor onSaveTrack={() => Promise.resolve()} />);
    const bar = screen.getByTestId('track-editor-toolbar');
    const tools = within(bar).getByRole('radiogroup', { name: t('sims.trackEditor.tools') });
    const history = within(bar).getByRole('group', { name: t('sims.trackEditor.historyGroup') });
    const file = within(bar).getByRole('group', { name: t('sims.trackEditor.fileGroup') });
    expect(within(tools).getAllByRole('radio')).toHaveLength(4);
    expect(within(history).getByRole('button', { name: t('sims.trackEditor.undo') })).toBeVisible();
    expect(within(history).getByRole('button', { name: t('sims.trackEditor.redo') })).toBeVisible();
    for (const key of ['exportJson', 'save.open', 'newTrack'] as const) {
      expect(
        within(file).getByRole('button', { name: t(`sims.trackEditor.${key}`) }),
      ).toBeVisible();
    }
    expect(within(file).getByLabelText(t('sims.trackEditor.preset'))).toBeVisible();
    // Nothing of the bar is left outside a group.
    expect(bar.children).toHaveLength(3);
  });
});

describe('Bloque de segmentos (#552)', () => {
  test('la nota de continuidad va dentro del bloque de segmentos del panel', () => {
    render(
      <TrackEditor
        initialTrack={LINE_TRACK}
        renderPanel={(panel) => <div data-testid="panel-wrapper">{panel}</div>}
      />,
    );
    const block = within(screen.getByTestId('panel-wrapper')).getByTestId('track-editor-segments');
    expect(within(block).getByRole('list', { name: t('sims.trackEditor.segments') })).toBeVisible();
    expect(within(block).getByTestId('track-editor-continuity')).toHaveTextContent(
      t('sims.trackEditor.continuity.open'),
    );
    // And it is no longer loose under the canvas.
    expect(screen.getAllByTestId('track-editor-continuity')).toHaveLength(1);
  });

  test('la fila seleccionada lo dice con `aria-pressed`, no solo con el fondo', async () => {
    const user = userEvent.setup();
    render(<TrackEditor initialTrack={presets.oval} />);
    const rows = screen.getAllByRole('button', { name: /^Segmento \d+: / });
    expect(rows).toHaveLength(4);
    await user.click(rows[1] as HTMLElement);
    expect(rows[1]).toHaveAttribute('aria-pressed', 'true');
    expect(rows[1]).toHaveAttribute('data-selected', 'true');
    expect(rows[0]).toHaveAttribute('aria-pressed', 'false');
  });
});
