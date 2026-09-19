import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';

import { GearWidget } from './GearWidget';

/** The «Explora» of T-4.4: the two stage train of the motor of the profile. */
const TWO_STAGE = {
  z1: 12,
  z2: 60,
  z3: 10,
  z4: 50,
  nIn_rpm: 6000,
  torqueIn_Nm: 0.012,
  efficiency: 0.6,
} as const;

/** The single stage case of the golden values: `i = 30` from 12 and 360 teeth. */
const ONE_STAGE = { z1: 12, z2: 360, nIn_rpm: 6000, torqueIn_Nm: 0.012, efficiency: 0.6 } as const;

/** The value of one row of the values panel, by the text of its term. */
function valueOf(term: string): string {
  const panel = screen.getAllByTestId('readout-panel')[0];
  if (panel === undefined) return '';
  return within(panel).getByText(term).nextElementSibling?.textContent ?? '';
}

/** The labels of the parameter sliders rendered inside `container`, in order. */
function sliderLabels(container: HTMLElement): readonly (string | null)[] {
  return within(container)
    .getAllByRole('region', { name: 'Parámetros' })
    .flatMap((panel) => within(panel).getAllByRole('slider'))
    .map((slider) => slider.getAttribute('aria-label'));
}

/** The slider whose accessible name starts with `label`. */
function sliderFor(label: string): HTMLElement {
  return screen.getByRole('slider', { name: new RegExp(`^${label}`) });
}

describe('GearWidget (F2-08)', () => {
  test('una etapa con i = 30 da 200 rpm y τ_out = 0.216 N·m (e1 y e2 de T-4.4)', () => {
    render(<GearWidget stages={1} initial={ONE_STAGE} />);

    expect(valueOf('Relación total')).toBe('30.0');
    expect(valueOf('Velocidad de salida')).toBe('200 rpm');
    expect(valueOf('Torque de salida')).toBe('0.216 N·m');
  });

  test('el tren 12:60 y 10:50 da i_total = 25 y n_out = 240 rpm (e3 de T-4.4)', () => {
    render(<GearWidget stages={2} initial={TWO_STAGE} />);

    expect(valueOf('Relación de la primera etapa')).toBe('5.00');
    expect(valueOf('Relación de la segunda etapa')).toBe('5.00');
    expect(valueOf('Relación total')).toBe('25.0');
    expect(valueOf('Velocidad de salida')).toBe('240 rpm');
  });

  test('P_out = P_in · η en el panel (T-4.4)', () => {
    render(<GearWidget stages={2} initial={TWO_STAGE} />);

    // P_in = 0.012 · 628.3 = 7.54 W; P_out = 7.54 · 0.6 = 4.52 W.
    expect(valueOf('Potencia de entrada')).toBe('7.54 W');
    expect(valueOf('Potencia de salida')).toBe('4.52 W');
  });

  test('con una etapa la salida gira en sentido contrario (signo de ω_out)', () => {
    render(<GearWidget stages={1} initial={ONE_STAGE} />);

    expect(valueOf('Velocidad angular de salida')).toBe('-20.9 rad/s');
    expect(valueOf('Sentido de salida')).toBe('contrario a la entrada');
  });

  test('con dos etapas la salida gira en el mismo sentido que la entrada', () => {
    render(<GearWidget stages={2} initial={TWO_STAGE} />);

    expect(valueOf('Velocidad angular de salida')).toBe('25.1 rad/s');
    expect(valueOf('Sentido de salida')).toBe('el mismo que la entrada');
  });

  test('la eficiencia por defecto es 1: la potencia de salida es la de entrada', () => {
    render(<GearWidget stages={1} initial={{ z1: 12, z2: 60, nIn_rpm: 6000, torqueIn_Nm: 0.012 }} />);

    expect(valueOf('Potencia de entrada')).toBe('7.54 W');
    expect(valueOf('Potencia de salida')).toBe('7.54 W');
    expect(sliderFor('Eficiencia')).toHaveAttribute('aria-valuenow', '1');
  });

  test('una etapa solo ofrece z1 y z2; dos etapas añaden z3 y z4 (decisión 5)', () => {
    const one = render(<GearWidget stages={1} initial={ONE_STAGE} />);

    expect(sliderLabels(one.container)).toEqual([
      'Dientes del engranaje de entrada en ',
      'Dientes del segundo engranaje en ',
      'Velocidad de entrada en rpm',
      'Torque de entrada en N·m',
      'Eficiencia en ',
    ]);

    const two = render(<GearWidget stages={2} initial={TWO_STAGE} />);
    expect(sliderLabels(two.container)).toEqual([
      'Dientes del engranaje de entrada en ',
      'Dientes del segundo engranaje en ',
      'Dientes del tercer engranaje en ',
      'Dientes del engranaje de salida en ',
      'Velocidad de entrada en rpm',
      'Torque de entrada en N·m',
      'Eficiencia en ',
    ]);
  });

  test('los deslizadores de dientes usan el rango [8, 80] con paso 1 (decisión 5)', () => {
    render(<GearWidget stages={2} initial={TWO_STAGE} />);

    const z1 = sliderFor('Dientes del engranaje de entrada');
    expect(z1).toHaveAttribute('min', '8');
    expect(z1).toHaveAttribute('max', '80');
    expect(z1).toHaveAttribute('step', '1');
  });

  test('cambiar z2 con el teclado recalcula la relación total (experimento 1 de T-4.4)', async () => {
    const user = userEvent.setup();
    render(<GearWidget stages={2} initial={{ ...TWO_STAGE, z2: 59 }} />);

    const z2 = sliderFor('Dientes del segundo engranaje');
    await user.click(z2);
    await user.keyboard('{ArrowRight}');

    expect(z2).toHaveAttribute('aria-valuenow', '60');
    expect(valueOf('Relación total')).toBe('25.0');
  });

  test('describe el estado del tren en una región aria-live', () => {
    render(<GearWidget stages={2} initial={TWO_STAGE} />);

    // `SimControls` tiene su propia región de estado, así que se busca la del tren por su texto.
    const status = screen
      .getAllByRole('status')
      .find((region) => region.textContent?.includes('relación total') === true);
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent(/25\.0/);
    expect(status).toHaveTextContent(/240 rpm/);
    expect(status).toHaveTextContent(/el mismo que la entrada/);
  });

  test('la leyenda muestra el factor con el que se dibuja la animación (decisión 4)', () => {
    render(<GearWidget stages={2} initial={TWO_STAGE} />);

    // 6000 rpm son 100 vueltas/s: el dibujo va a ×1/100 para no pasar de una vuelta por segundo.
    expect(screen.getByText('Dibujo a ×1/100 de la velocidad real')).toBeInTheDocument();
  });

  test('«Paso» adelanta el reloj de la reproducción', async () => {
    const user = userEvent.setup();
    render(<GearWidget stages={2} initial={TWO_STAGE} />);

    expect(screen.getByTestId('sim-clock')).toHaveTextContent('00.00');
    await user.click(screen.getByRole('button', { name: /paso/i }));

    expect(screen.getByTestId('sim-clock')).not.toHaveTextContent('00.00');
  });

  test('initialTime_s abre el widget en un instante fijo y «Reiniciar» lo devuelve a cero', async () => {
    const user = userEvent.setup();
    render(<GearWidget stages={2} initial={TWO_STAGE} initialTime_s={0.5} />);

    expect(screen.getByTestId('sim-clock')).toHaveTextContent('00.50');

    await user.click(screen.getByRole('button', { name: 'Reiniciar' }));

    expect(screen.getByTestId('sim-clock')).toHaveTextContent('00.00');
  });

  test('«Reproducir» desde un instante fijo devuelve el tiempo al reproductor', async () => {
    const user = userEvent.setup();
    render(<GearWidget stages={2} initial={TWO_STAGE} initialTime_s={0.5} />);

    await user.click(screen.getByRole('button', { name: 'Reproducir' }));

    // El reloj pasa a seguir al reproductor, que arranca desde cero.
    expect(screen.getByRole('button', { name: 'Pausa' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Pausa' }));
  });
});
