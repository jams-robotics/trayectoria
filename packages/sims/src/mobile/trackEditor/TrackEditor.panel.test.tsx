import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from '@trayectoria/i18n';
import type { Track } from '@trayectoria/sim-core';
import { describe, expect, test } from 'vitest';

import { TrackEditor } from './TrackEditor';

// #189 (decisiones 1 y 4): la prop `renderPanel` del editor —el mismo patrón que ya tienen
// `LineFollowerWidget` y `ArmViewer`— y la barra compacta del segmento. jsdom no hace maquetación,
// así que lo que se comprueba aquí es dónde cae cada nodo y cómo está etiquetado; los anchos y el
// scroll van al e2e de `apps/web/e2e/sim-movil.spec.ts`.

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

describe('TrackEditor · renderPanel (#189, decisión 1)', () => {
  test('sin `renderPanel` el panel numérico se renderiza en su columna de siempre', () => {
    render(<TrackEditor initialTrack={LINE_TRACK} />);
    const editor = screen.getByTestId('track-editor');
    expect(within(editor).getByTestId('track-editor-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-wrapper')).toBeNull();
  });

  test('con `renderPanel` la página decide dónde coloca el panel numérico', () => {
    render(
      <TrackEditor
        initialTrack={LINE_TRACK}
        renderPanel={(panel) => <div data-testid="panel-wrapper">{panel}</div>}
      />,
    );
    const wrapper = screen.getByTestId('panel-wrapper');
    expect(wrapper.querySelector('[data-testid="track-editor-panel"]')).not.toBeNull();
    // Y sigue siendo el panel del editor: edita el mismo segmento, no una copia.
    expect(
      within(wrapper).getByRole('button', { name: t('sims.trackEditor.segmentLine', { index: 1 }) }),
    ).toBeInTheDocument();
  });

  test('con `renderPanel` el panel entregado sigue editando la pista', async () => {
    const user = userEvent.setup();
    const changes: Track[] = [];
    render(
      <TrackEditor
        initialTrack={ARC_TRACK}
        onChange={(track) => changes.push(track)}
        renderPanel={(panel) => <div data-testid="panel-wrapper">{panel}</div>}
      />,
    );
    const wrapper = screen.getByTestId('panel-wrapper');
    await user.click(
      within(wrapper).getByRole('button', { name: t('sims.trackEditor.segmentArc', { index: 1 }) }),
    );
    await user.click(
      within(wrapper).getByRole('radio', { name: t('sims.trackEditor.directionCcw') }),
    );
    const last = changes[changes.length - 1]?.segments[0];
    if (last?.type !== 'arc') throw new Error('expected an arc');
    expect(last.ccw).toBe(true);
  });

  test('el lienzo y la barra de herramientas siguen dentro del editor con `renderPanel`', () => {
    render(
      <TrackEditor
        initialTrack={LINE_TRACK}
        renderPanel={(panel) => <div data-testid="panel-wrapper">{panel}</div>}
      />,
    );
    const editor = screen.getByTestId('track-editor');
    expect(within(editor).getByTestId('track-editor-toolbar')).toBeInTheDocument();
    expect(
      within(editor).getByRole('img', { name: t('sims.trackEditor.scene') }),
    ).toBeInTheDocument();
    // Y el panel está donde lo puso la página, no en la columna de 280 px de siempre.
    const panel = screen.getByTestId('track-editor-panel');
    expect(screen.getByTestId('panel-wrapper')).toContainElement(panel);
  });
});

describe('SegmentBar compacta (#189, decisión 4)', () => {
  /** Selecciona el primer segmento por la lista del panel, que es la ruta de teclado. */
  async function selectFirst(
    user: ReturnType<typeof userEvent.setup>,
    kind: 'Line' | 'Arc',
  ): Promise<void> {
    await user.click(
      screen.getByRole('button', { name: t(`sims.trackEditor.segment${kind}`, { index: 1 }) }),
    );
  }

  test('los botones son de icono: nombrados por `aria-label` y con infobulo', async () => {
    const user = userEvent.setup();
    render(<TrackEditor initialTrack={ARC_TRACK} />);
    await selectFirst(user, 'Arc');
    const bar = screen.getByTestId('track-editor-segment-bar');
    for (const key of ['flipArc', 'deleteSegment'] as const) {
      const label = t(`sims.trackEditor.${key}`);
      const button = within(bar).getByRole('button', { name: label });
      expect(button).toHaveAttribute('title', label);
      // El rótulo largo ya no se pinta: lo que se ve es el glifo, y el glifo no nombra nada.
      expect(button).not.toHaveTextContent(label);
      expect(within(button).getByText(/\S/)).toHaveAttribute('aria-hidden', 'true');
    }
  });

  test('el campo de radio está etiquetado y lleva infobulo', async () => {
    const user = userEvent.setup();
    render(<TrackEditor initialTrack={ARC_TRACK} />);
    await selectFirst(user, 'Arc');
    const bar = screen.getByTestId('track-editor-segment-bar');
    const field = within(bar).getByLabelText(t('sims.trackEditor.field.radius'));
    expect(field).toHaveAttribute('title', t('sims.trackEditor.field.radius'));
    // Cuatro cifras: el radio del arco dorado, «0.125».
    expect(field).toHaveValue('0.125');
  });

  // #189, decision 4 left the bar visible with every tool while the human had not yet seen it;
  // #180, decision 1 reserves it for «Seleccionar». Visibility per tool is now checked in
  // SegmentBar.test.tsx.
});
