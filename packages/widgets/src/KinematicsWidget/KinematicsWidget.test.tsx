import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { KinematicsWidget } from './KinematicsWidget';

// uPlot paints on a canvas, which jsdom does not implement (F2-01b, decision 4 of #83). The
// widget still renders its cards, markers, panel and controls without it.
vi.mock('uplot/dist/uPlot.min.css', () => ({}));

/** The value of one row of the values panel, by the text of its term. */
function valueOf(term: string): string {
  const panel = screen.getByTestId('readout-panel');
  return within(panel).getByText(term).nextElementSibling?.textContent ?? '';
}

describe('KinematicsWidget (F2-04)', () => {
  test('con el marcador en t = 2 s muestra los valores de T-0.3 (v0 = 0.5, a = 0.2)', () => {
    render(
      <KinematicsWidget
        initial={{ x0_m: 0, v0_mps: 0.5, a_mps2: 0.2 }}
        editable={['v0', 'a']}
        duration_s={5}
        showTangent
        initialTime_s={2}
      />,
    );

    expect(valueOf('Tiempo')).toBe('2.00 s');
    // x(2) = 0.5·2 + ½·0.2·4 = 1.4 m; v(2) = 0.5 + 0.2·2 = 0.9 m/s.
    expect(valueOf('Posición')).toBe('1.40 m');
    expect(valueOf('Velocidad')).toBe('0.900 m/s');
    expect(valueOf('Aceleración')).toBe('0.200 m/s²');
    // La pendiente de la tangente es exactamente v(t) (criterio del ticket).
    expect(valueOf('Pendiente de la tangente')).toBe('0.900 m/s');
  });

  test('mueve el marcador con el teclado y los tres `Plot` y la partícula lo siguen', async () => {
    const user = userEvent.setup();
    render(
      <KinematicsWidget
        initial={{ x0_m: 0, v0_mps: 0.4, a_mps2: 0 }}
        editable={['x0', 'v0']}
        duration_s={10}
      />,
    );

    const markers = screen.getAllByTestId('plot-marker');
    expect(markers).toHaveLength(3);
    const first = markers[0];
    if (first === undefined) throw new Error('the x–t plot has no marker');
    first.focus();
    // Un paso de flecha es el 2 % del rango visible: 0.2 s sobre 10 s.
    await user.keyboard('{ArrowRight}');

    expect(valueOf('Tiempo')).toBe('0.200 s');
    expect(valueOf('Posición')).toBe('0.0800 m');
    for (const marker of screen.getAllByTestId('plot-marker')) {
      expect(marker).toHaveAttribute('aria-valuenow', '0.2');
    }
  });

  test('el marcador no sale de [0, duration_s]', async () => {
    const user = userEvent.setup();
    render(
      <KinematicsWidget
        initial={{ x0_m: 0, v0_mps: 0, a_mps2: 0.4 }}
        editable={['a']}
        duration_s={4}
      />,
    );

    const first = screen.getAllByTestId('plot-marker')[0];
    if (first === undefined) throw new Error('the x–t plot has no marker');
    first.focus();
    await user.keyboard('{ArrowLeft}');
    expect(valueOf('Tiempo')).toBe('0.00 s');
  });

  test('sin `showTangent` el panel no muestra la pendiente', () => {
    render(
      <KinematicsWidget
        initial={{ x0_m: 0, v0_mps: 0.4, a_mps2: 0 }}
        editable={['v0']}
        duration_s={10}
      />,
    );

    expect(screen.queryByText('Pendiente de la tangente')).not.toBeInTheDocument();
    expect(screen.getByText('Velocidad')).toBeInTheDocument();
  });

  test('sólo los valores de `editable` tienen deslizador, con su unidad', () => {
    render(
      <KinematicsWidget
        initial={{ x0_m: 0, v0_mps: 0.5, a_mps2: 0.2 }}
        editable={['v0', 'a']}
        duration_s={5}
      />,
    );

    const labels = screen
      .getAllByRole('slider')
      .map((slider) => slider.getAttribute('aria-label'))
      .filter((label) => label !== 'Marcador de tiempo');
    expect(labels).toEqual(['Velocidad inicial en m/s', 'Aceleración en m/s²']);
  });

  test('cambiar `a` con el deslizador recalcula la posición en el instante del marcador', async () => {
    const user = userEvent.setup();
    render(
      <KinematicsWidget
        initial={{ x0_m: 0, v0_mps: 0, a_mps2: 0.4 }}
        editable={['a']}
        duration_s={4}
        initialTime_s={1.5}
      />,
    );

    // Experimento 1 de T-1.2: x(1.5) = 0.45 m; al duplicar a se duplica a 0.90 m.
    expect(valueOf('Posición')).toBe('0.450 m');
    const slider = screen.getByRole('slider', { name: 'Aceleración en m/s²' });
    slider.focus();
    for (let press = 0; press < 4; press++) await user.keyboard('{ArrowRight}');

    expect(valueOf('Aceleración')).toBe('0.800 m/s²');
    expect(valueOf('Posición')).toBe('0.900 m');
  });

  test('expone los controles de simulación y una descripción del estado', () => {
    render(
      <KinematicsWidget
        initial={{ x0_m: 0, v0_mps: 0.5, a_mps2: 0.2 }}
        editable={['v0']}
        duration_s={5}
        initialTime_s={2}
      />,
    );

    const controls = screen.getByRole('group', { name: 'Controles de simulación' });
    for (const name of ['Reproducir', 'Pausa', 'Paso', 'Reiniciar']) {
      expect(within(controls).getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Partícula sobre un eje horizontal, con su vector velocidad',
    );
  });
});
